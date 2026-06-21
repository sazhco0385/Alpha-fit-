"""Trial-Usage-Reminder email tests.

Verifies:
  1. render_trial_usage_reminder template renders with stats
  2. Dispatcher sends 48h and 24h milestones idempotently
  3. notification_prefs.email.trial_ending=false suppresses sends
  4. Stats are correctly computed from trial-period workouts only
"""
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


async def _register(client: httpx.AsyncClient, email: str, name: str = "Trial Test"):
    r = await client.post(f"{API_URL}/auth/register", json={"email": email, "password": "Test1234!", "name": name})
    r.raise_for_status()
    return r.json()


def _hdr(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


def test_render_template_no_stats():
    """Template renders even when all stats are 0."""
    from email_service import render_trial_usage_reminder
    subject, html = render_trial_usage_reminder("Max", 48, {})
    assert "Max" in html
    assert "Premium" in html
    assert "48" in subject or "48" in html


def test_render_template_full_stats():
    from email_service import render_trial_usage_reminder
    stats = {"workouts": 5, "volume_kg": 14200, "coach_msgs": 12, "body_scans": 2, "prs": 3, "badges": 6}
    subject, html = render_trial_usage_reminder("Max", 24, stats)
    assert "14.200" in html or "14200" in html
    assert "5" in html
    assert "Letzter Tag" in html  # 24h shows urgency label
    assert "Stunden" not in subject or "24" in subject


@pytest.mark.asyncio
async def test_dispatcher_sends_48h_and_24h_milestones():
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv
    load_dotenv(os.path.join(ROOT, ".env"))
    mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = mongo[os.environ["DB_NAME"]]

    async with httpx.AsyncClient(timeout=30) as cx:
        email = f"trial_{uuid.uuid4().hex[:8]}@example.com"
        u = await _register(cx, email, "Trial User")
        uid = u["user"]["id"]
        now_utc = datetime.now(timezone.utc)

        # Setup: trial ends in 30h (within 48h window, not yet 24h window)
        trial_end_48 = now_utc + timedelta(hours=30)
        trial_start = trial_end_48 - timedelta(days=7)
        await db.users.update_one({"id": uid}, {"$set": {
            "is_premium": True,
            "trial_until": trial_end_48.isoformat(),
            "premium_until": trial_end_48.isoformat(),
        }})
        # Seed some workouts during trial
        for i in range(3):
            await db.workout_sessions.insert_one({
                "id": str(uuid.uuid4()), "user_id": uid, "status": "completed",
                "started_at": (trial_start + timedelta(days=i+1)).isoformat(),
                "completed_at": (trial_start + timedelta(days=i+1)).isoformat(),
                "day_index": 1,
                "logged_sets": [{"reps": 10, "weight_kg": 50, "exercise_index": 0, "set_index": 0}] * 4,
            })

        # Run dispatcher via admin endpoint (avoids motor event-loop binding issues)
        admin = await cx.post(f"{API_URL}/auth/login", json={
            "email": os.environ.get("ADMIN_EMAIL", "sazhco0385@gmail.com"),
            "password": os.environ.get("ADMIN_PASSWORD", "Bellakiki1"),
        })
        admin_tok = admin.json()["token"]
        r1 = await cx.post(f"{API_URL}/admin/emails/run-dispatcher", headers=_hdr(admin_tok), timeout=60)
        result1 = r1.json()["result"]
        assert result1.get("trial_usage_48h", 0) >= 1, f"Expected 48h send, got: {result1}"
        assert result1.get("trial_usage_24h", 0) == 0, "Should not yet hit 24h milestone"

        # Verify email_log entry
        log = await db.email_log.find_one({
            "user_id": uid, "template": "trial_usage_reminder", "milestone": "48h",
        })
        assert log is not None
        assert log["stats"]["workouts"] == 3
        assert log["stats"]["volume_kg"] == 3 * 4 * 10 * 50  # 6000 kg

        # Re-run → must NOT resend 48h (idempotent)
        r2 = await cx.post(f"{API_URL}/admin/emails/run-dispatcher", headers=_hdr(admin_tok), timeout=60)
        result2 = r2.json()["result"]
        assert result2.get("trial_usage_48h", 0) == 0, "Re-run must be idempotent"

        # Now shift trial to be 12h away → triggers 24h milestone
        trial_end_24 = now_utc + timedelta(hours=12)
        await db.users.update_one({"id": uid}, {"$set": {
            "trial_until": trial_end_24.isoformat(),
        }})
        r3 = await cx.post(f"{API_URL}/admin/emails/run-dispatcher", headers=_hdr(admin_tok), timeout=60)
        result3 = r3.json()["result"]
        assert result3.get("trial_usage_24h", 0) >= 1, f"Expected 24h send, got: {result3}"

        log24 = await db.email_log.find_one({
            "user_id": uid, "template": "trial_usage_reminder", "milestone": "24h",
        })
        assert log24 is not None

        # Cleanup
        await db.users.delete_one({"id": uid})
        await db.workout_sessions.delete_many({"user_id": uid})
        await db.email_log.delete_many({"user_id": uid})

    mongo.close()


@pytest.mark.asyncio
async def test_dispatcher_respects_notification_pref():
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv
    load_dotenv(os.path.join(ROOT, ".env"))
    mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = mongo[os.environ["DB_NAME"]]

    async with httpx.AsyncClient(timeout=30) as cx:
        email = f"trialoff_{uuid.uuid4().hex[:8]}@example.com"
        u = await _register(cx, email, "Opted Out")
        uid = u["user"]["id"]
        now_utc = datetime.now(timezone.utc)
        trial_end = now_utc + timedelta(hours=30)
        await db.users.update_one({"id": uid}, {"$set": {
            "is_premium": True,
            "trial_until": trial_end.isoformat(),
            "premium_until": trial_end.isoformat(),
            "notification_prefs": {"email": {"trial_ending": False}},
        }})

        # Trigger dispatcher via admin endpoint
        admin = await cx.post(f"{API_URL}/auth/login", json={
            "email": os.environ.get("ADMIN_EMAIL", "sazhco0385@gmail.com"),
            "password": os.environ.get("ADMIN_PASSWORD", "Bellakiki1"),
        })
        admin_tok = admin.json()["token"]
        await cx.post(f"{API_URL}/admin/emails/run-dispatcher", headers=_hdr(admin_tok), timeout=60)
        log = await db.email_log.find_one({"user_id": uid, "template": "trial_usage_reminder"})
        assert log is None, "Should not send when pref is disabled"

        await db.users.delete_one({"id": uid})
        await db.email_log.delete_many({"user_id": uid})

    mongo.close()
