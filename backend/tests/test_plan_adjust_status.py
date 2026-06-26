"""plan-adjust-status endpoint tests."""
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta

import httpx
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

API_URL = os.environ.get("BACKEND_URL", "http://localhost:8001/api")


async def _register(client: httpx.AsyncClient, email: str, name: str = "Status Test"):
    r = await client.post(f"{API_URL}/auth/register", json={"email": email, "password": "Test1234!", "name": name})
    r.raise_for_status()
    return r.json()


def _hdr(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


@pytest.mark.asyncio
async def test_status_no_plan_for_new_user():
    async with httpx.AsyncClient(timeout=10) as cx:
        u = await _register(cx, f"st_{uuid.uuid4().hex[:8]}@example.com")
        r = await cx.get(f"{API_URL}/coach/plan-adjust-status", headers=_hdr(u["token"]))
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "no_plan"
        assert "Plan" in d["message"]


@pytest.mark.asyncio
async def test_status_returns_required_fields_with_plan():
    """User with a plan and recent sessions gets a status payload."""
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv
    load_dotenv(os.path.join(ROOT, ".env"))
    mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = mongo[os.environ["DB_NAME"]]

    async with httpx.AsyncClient(timeout=15) as cx:
        u = await _register(cx, f"st2_{uuid.uuid4().hex[:8]}@example.com")
        uid = u["user"]["id"]
        # Seed a minimal plan + sessions
        plan_id = str(uuid.uuid4())
        await db.training_plans.insert_one({
            "id": plan_id, "user_id": uid, "name": "Test Plan", "days": [
                {"day_index": 1, "name": "A", "exercises": []},
                {"day_index": 2, "name": "B", "exercises": []},
            ],
        })
        await db.users.update_one({"id": uid}, {"$set": {"current_plan_id": plan_id}})

        # Add 2 completed sessions (one of each day)
        now_utc = datetime.now(timezone.utc)
        for di in (1, 2):
            await db.workout_sessions.insert_one({
                "id": str(uuid.uuid4()), "user_id": uid, "status": "completed",
                "day_index": di, "started_at": (now_utc - timedelta(days=1)).isoformat(),
                "completed_at": (now_utc - timedelta(hours=2)).isoformat(),
                "logged_sets": [],
            })

        r = await cx.get(f"{API_URL}/coach/plan-adjust-status", headers=_hdr(u["token"]))
        assert r.status_code == 200
        d = r.json()
        # Full cycle hit → ready
        assert d["status"] == "ready"
        assert d["plan_days_total"] == 2
        assert set(d["plan_days_done"]) == {1, 2}
        assert d["plan_days_missing"] == []
        assert d["sessions_last_7d"] == 2

        # Cleanup
        await db.users.delete_one({"id": uid})
        await db.training_plans.delete_one({"id": plan_id})
        await db.workout_sessions.delete_many({"user_id": uid})

    mongo.close()


@pytest.mark.asyncio
async def test_status_cooldown_when_recent_adjust():
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv
    load_dotenv(os.path.join(ROOT, ".env"))
    mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = mongo[os.environ["DB_NAME"]]
    async with httpx.AsyncClient(timeout=15) as cx:
        u = await _register(cx, f"st3_{uuid.uuid4().hex[:8]}@example.com")
        uid = u["user"]["id"]
        plan_id = str(uuid.uuid4())
        await db.training_plans.insert_one({
            "id": plan_id, "user_id": uid, "name": "P", "days": [{"day_index": 1, "exercises": []}],
        })
        # Adjust 2 days ago → cooldown remaining
        await db.users.update_one({"id": uid}, {"$set": {
            "current_plan_id": plan_id,
            "last_auto_adjust_at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
        }})
        r = await cx.get(f"{API_URL}/coach/plan-adjust-status", headers=_hdr(u["token"]))
        d = r.json()
        assert d["status"] == "cooldown"
        assert d["cooldown_days_left"] == 4
        assert "Cooldown" in d["message"]
        # Cleanup
        await db.users.delete_one({"id": uid})
        await db.training_plans.delete_one({"id": plan_id})
    mongo.close()


@pytest.mark.asyncio
async def test_status_needs_sessions_when_incomplete_cycle():
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv
    load_dotenv(os.path.join(ROOT, ".env"))
    mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = mongo[os.environ["DB_NAME"]]
    async with httpx.AsyncClient(timeout=15) as cx:
        u = await _register(cx, f"st4_{uuid.uuid4().hex[:8]}@example.com")
        uid = u["user"]["id"]
        plan_id = str(uuid.uuid4())
        await db.training_plans.insert_one({
            "id": plan_id, "user_id": uid, "name": "P5", "days": [
                {"day_index": i, "exercises": []} for i in range(1, 6)
            ],
        })
        await db.users.update_one({"id": uid}, {"$set": {"current_plan_id": plan_id}})
        # 1 session done on day 1 → 4 days missing
        await db.workout_sessions.insert_one({
            "id": str(uuid.uuid4()), "user_id": uid, "status": "completed",
            "day_index": 1, "started_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": datetime.now(timezone.utc).isoformat(), "logged_sets": [],
        })
        r = await cx.get(f"{API_URL}/coach/plan-adjust-status", headers=_hdr(u["token"]))
        d = r.json()
        assert d["status"] == "needs_sessions"
        assert d["plan_days_missing"] == [2, 3, 4, 5]
        assert "Trainingstag" in d["message"]
        # Cleanup
        await db.users.delete_one({"id": uid})
        await db.training_plans.delete_one({"id": plan_id})
        await db.workout_sessions.delete_many({"user_id": uid})
    mongo.close()
