"""Test: _maybe_trigger_auto_plan_adjust sweeps orphaned pending jobs (>5 min).

Focuses purely on the sweep logic ported from routers/coach.py to routers/sessions.py.
Uses in-process import + direct DB manipulation. Monkeypatches asyncio.create_task
so no real LLM is invoked.
"""
import os
import sys
import uuid
import asyncio
from datetime import datetime, timezone, timedelta

import pytest
import pytest_asyncio

# Ensure /app/backend on sys.path so `from server import ...` works
BACKEND_DIR = "/app/backend"
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

ADMIN_EMAIL = "sazhco0385@gmail.com"


@pytest.fixture
def sessions_mod():
    # Import server first to break circular import (server imports sessions & coach)
    import server  # noqa: F401
    from routers import sessions as s  # noqa
    return s


@pytest_asyncio.fixture(loop_scope="session")
async def admin_user(sessions_mod):
    # Use a fresh motor client bound to the currently-running test loop.
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "alphafit_db")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    # Swap into module so the function under test uses the loop-bound client
    sessions_mod.db = db
    user = await db.users.find_one({"email": ADMIN_EMAIL}, {"_id": 0})
    assert user is not None, "admin user not found"
    assert user.get("current_plan_id"), "admin has no current_plan_id"
    plan = await db.training_plans.find_one({"id": user["current_plan_id"]}, {"_id": 0})
    assert plan and plan.get("days"), "admin plan has no days"
    return user


@pytest_asyncio.fixture(loop_scope="session")
async def cleanup_jobs(sessions_mod, admin_user):
    """Snapshot & restore plan_adjust_jobs and last_auto_adjust_at for admin."""
    db = sessions_mod.db
    uid = admin_user["id"]
    before_jobs = await db.plan_adjust_jobs.find({"user_id": uid}, {"_id": 0}).to_list(1000)
    before_last = admin_user.get("last_auto_adjust_at")
    yield
    # Cleanup any TEST_ jobs created during test
    await db.plan_adjust_jobs.delete_many({"user_id": uid, "id": {"$regex": "^TEST_"}})
    # Restore original state of any jobs we mutated (only ones we inserted are TEST_)
    # Restore last_auto_adjust_at
    await db.users.update_one({"id": uid}, {"$set": {"last_auto_adjust_at": before_last}})
    _ = before_jobs  # kept for debug


async def _seed_recent_completed_sessions(db, user_id, plan_days):
    """Ensure the trigger conditions can be met by inserting TEST_ sessions."""
    # Insert 4 completed sessions across distinct day_indices in the last 3 days
    now = datetime.now(timezone.utc)
    day_indices = [d.get("day_index") for d in plan_days if d.get("day_index") is not None][:4]
    # Pad if not enough
    while len(day_indices) < 4:
        day_indices.append(day_indices[-1] if day_indices else 0)
    for i, di in enumerate(day_indices):
        await db.workout_sessions.insert_one({
            "id": f"TEST_sess_{uuid.uuid4()}",
            "user_id": user_id,
            "status": "completed",
            "completed_at": (now - timedelta(days=i)).isoformat(),
            "day_index": di,
            "_test_seed": True,
        })


async def _cleanup_test_sessions(db, user_id):
    await db.workout_sessions.delete_many({"user_id": user_id, "_test_seed": True})


@pytest.mark.asyncio(loop_scope="session")
async def test_stale_pending_job_swept_and_new_job_spawned(sessions_mod, admin_user, monkeypatch, cleanup_jobs):
    """A pending job older than 5 minutes should be marked 'error' and a fresh job spawned."""
    db = sessions_mod.db
    uid = admin_user["id"]
    plan = await db.training_plans.find_one({"id": admin_user["current_plan_id"]}, {"_id": 0})

    # Monkeypatch asyncio.create_task to a no-op so we don't invoke the LLM
    spawned = {"count": 0}

    def fake_create_task(coro):
        spawned["count"] += 1
        # Close the coroutine so it doesn't warn
        try:
            coro.close()
        except Exception:
            pass
        return None

    monkeypatch.setattr(sessions_mod.asyncio, "create_task", fake_create_task)

    # Ensure user has NOT been auto-adjusted recently (bypass cooldown)
    await db.users.update_one({"id": uid}, {"$set": {"last_auto_adjust_at": (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()}})

    # Ensure any real pending jobs are out of the way (we'll insert our stale one)
    await db.plan_adjust_jobs.update_many(
        {"user_id": uid, "status": "pending"},
        {"$set": {"status": "error", "error": "test_pre_cleanup", "finished_at": sessions_mod.now_iso()}},
    )

    # Seed sessions to satisfy trigger criteria
    try:
        await _seed_recent_completed_sessions(db, uid, plan["days"])

        # Insert a stale pending job (10 minutes ago)
        stale_id = f"TEST_stale_{uuid.uuid4()}"
        stale_created = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
        await db.plan_adjust_jobs.insert_one({
            "id": stale_id,
            "user_id": uid,
            "status": "pending",
            "created_at": stale_created,
            "plan_id": admin_user["current_plan_id"],
            "source": "auto_weekly",
        })

        # Re-fetch fresh user doc (with our updated last_auto_adjust_at)
        fresh_user = await db.users.find_one({"id": uid}, {"_id": 0})

        # Invoke the target function
        await sessions_mod._maybe_trigger_auto_plan_adjust(fresh_user)

        # Assert: stale job now has status 'error' with expected message
        swept = await db.plan_adjust_jobs.find_one({"id": stale_id}, {"_id": 0})
        assert swept is not None, "stale job disappeared"
        assert swept["status"] == "error", f"stale job status={swept.get('status')}, expected error"
        assert "Server-Neustart" in (swept.get("error") or ""), f"unexpected error msg: {swept.get('error')}"
        assert swept.get("finished_at"), "stale job missing finished_at"

        # Assert: a new pending job was spawned
        new_pending = await db.plan_adjust_jobs.find_one(
            {"user_id": uid, "status": "pending", "id": {"$ne": stale_id}}, {"_id": 0}
        )
        assert new_pending is not None, "no fresh pending job was spawned"
        assert new_pending.get("source", "").startswith("auto_"), f"unexpected source: {new_pending.get('source')}"

        # Assert: create_task was called (background worker scheduled)
        assert spawned["count"] == 1, f"expected 1 create_task call, got {spawned['count']}"

        # Cleanup: mark the new pending as error so it doesn't linger
        await db.plan_adjust_jobs.update_one(
            {"id": new_pending["id"]},
            {"$set": {"status": "error", "error": "TEST_cleanup", "finished_at": sessions_mod.now_iso()}},
        )
    finally:
        await _cleanup_test_sessions(db, uid)


@pytest.mark.asyncio(loop_scope="session")
async def test_fresh_pending_job_preserved_idempotent(sessions_mod, admin_user, monkeypatch, cleanup_jobs):
    """A pending job younger than 5 minutes should be left untouched (early return)."""
    db = sessions_mod.db
    uid = admin_user["id"]
    plan = await db.training_plans.find_one({"id": admin_user["current_plan_id"]}, {"_id": 0})

    spawned = {"count": 0}

    def fake_create_task(coro):
        spawned["count"] += 1
        try:
            coro.close()
        except Exception:
            pass
        return None

    monkeypatch.setattr(sessions_mod.asyncio, "create_task", fake_create_task)

    # Bypass cooldown
    await db.users.update_one({"id": uid}, {"$set": {"last_auto_adjust_at": (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()}})

    # Clear stale pending jobs
    await db.plan_adjust_jobs.update_many(
        {"user_id": uid, "status": "pending"},
        {"$set": {"status": "error", "error": "test_pre_cleanup", "finished_at": sessions_mod.now_iso()}},
    )

    try:
        await _seed_recent_completed_sessions(db, uid, plan["days"])

        # Insert a FRESH pending job (30 seconds ago)
        fresh_id = f"TEST_fresh_{uuid.uuid4()}"
        fresh_created = (datetime.now(timezone.utc) - timedelta(seconds=30)).isoformat()
        await db.plan_adjust_jobs.insert_one({
            "id": fresh_id,
            "user_id": uid,
            "status": "pending",
            "created_at": fresh_created,
            "plan_id": admin_user["current_plan_id"],
            "source": "auto_weekly",
        })

        fresh_user = await db.users.find_one({"id": uid}, {"_id": 0})

        await sessions_mod._maybe_trigger_auto_plan_adjust(fresh_user)

        # Assert: fresh job untouched
        still = await db.plan_adjust_jobs.find_one({"id": fresh_id}, {"_id": 0})
        assert still is not None
        assert still["status"] == "pending", f"fresh job was touched: status={still.get('status')}"
        assert still.get("finished_at") is None, "fresh job wrongly finished"

        # Assert: no NEW pending job spawned (only the one we inserted)
        pending_jobs = await db.plan_adjust_jobs.find(
            {"user_id": uid, "status": "pending"}, {"_id": 0}
        ).to_list(10)
        assert len(pending_jobs) == 1, f"expected exactly 1 pending (the fresh one), got {len(pending_jobs)}: {[j['id'] for j in pending_jobs]}"
        assert pending_jobs[0]["id"] == fresh_id

        # Assert: no background task spawned
        assert spawned["count"] == 0, f"expected 0 create_task calls, got {spawned['count']}"

        # Cleanup
        await db.plan_adjust_jobs.update_one(
            {"id": fresh_id},
            {"$set": {"status": "error", "error": "TEST_cleanup", "finished_at": sessions_mod.now_iso()}},
        )
    finally:
        await _cleanup_test_sessions(db, uid)
