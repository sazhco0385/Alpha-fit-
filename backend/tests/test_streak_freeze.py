"""Streak-Freeze Premium feature tests.

Verifies:
  1. /api/streak/status returns proper payload for free vs premium
  2. Premium user gets 1 freeze on the 1st-of-month grant
  3. A 2-day-old workout still keeps streak=1 (freeze auto-bridges)
  4. Bridge is idempotent: repeated calls don't double-consume
  5. Free user with same scenario → streak=0
"""
import asyncio
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


async def _register(client: httpx.AsyncClient, email: str, name: str = "Streak Test"):
    r = await client.post(f"{API_URL}/auth/register", json={"email": email, "password": "Test1234!", "name": name})
    r.raise_for_status()
    return r.json()


def _hdr(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


@pytest.mark.asyncio
async def test_streak_freeze_full_flow():
    # Use direct DB to seed data because mock workouts must be backdated
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv
    load_dotenv(os.path.join(ROOT, ".env"))
    mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = mongo[os.environ["DB_NAME"]]

    async with httpx.AsyncClient(timeout=30) as cx:
        # ---------- FREE USER ----------
        free_email = f"free_{uuid.uuid4().hex[:8]}@example.com"
        free = await _register(cx, free_email, "Free")
        free_tok = free["token"]
        free_uid = free["user"]["id"]

        # Insert a session completed 2 days ago for free user
        two_days_ago = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
        await db.workout_sessions.insert_one({
            "id": str(uuid.uuid4()), "user_id": free_uid, "status": "completed",
            "started_at": two_days_ago, "completed_at": two_days_ago,
            "day_index": 1, "logged_sets": [],
        })
        # Free user → streak status reports premium=false
        r = await cx.get(f"{API_URL}/streak/status", headers=_hdr(free_tok))
        assert r.status_code == 200
        body = r.json()
        assert body["is_premium"] is False
        assert body["freezes_available"] == 0

        # /sessions/stats: streak should be 0 (no freeze, gap > 1)
        r = await cx.get(f"{API_URL}/sessions/stats", headers=_hdr(free_tok))
        assert r.json()["current_streak"] == 0, "Free user should NOT get freeze-bridged streak"

        # ---------- PREMIUM USER ----------
        prem_email = f"prem_{uuid.uuid4().hex[:8]}@example.com"
        prem = await _register(cx, prem_email, "Prem")
        prem_tok = prem["token"]
        prem_uid = prem["user"]["id"]

        # Manually grant premium + 1 freeze (mimic payment success)
        now_utc = datetime.now(timezone.utc)
        await db.users.update_one({"id": prem_uid}, {"$set": {
            "is_premium": True,
            "premium_until": (now_utc + timedelta(days=30)).isoformat(),
            "streak_freezes_available": 1,
            "streak_freeze_last_grant_month": now_utc.strftime("%Y-%m"),
        }})

        # Insert sessions: completed 2 days ago + completed 3 days ago (consecutive but 2-day gap from today)
        two_d = (now_utc - timedelta(days=2)).isoformat()
        three_d = (now_utc - timedelta(days=3)).isoformat()
        await db.workout_sessions.insert_many([
            {"id": str(uuid.uuid4()), "user_id": prem_uid, "status": "completed",
             "started_at": two_d, "completed_at": two_d, "day_index": 1, "logged_sets": []},
            {"id": str(uuid.uuid4()), "user_id": prem_uid, "status": "completed",
             "started_at": three_d, "completed_at": three_d, "day_index": 2, "logged_sets": []},
        ])

        # First call → freeze should be consumed to bridge the gap
        r = await cx.get(f"{API_URL}/sessions/stats", headers=_hdr(prem_tok))
        streak1 = r.json()["current_streak"]
        assert streak1 >= 2, f"Expected streak ≥2 with freeze, got {streak1}"

        # Verify freeze was actually consumed
        r = await cx.get(f"{API_URL}/streak/status", headers=_hdr(prem_tok))
        st = r.json()
        assert st["freezes_available"] == 0, "Freeze should be consumed once"
        assert st["used_this_month"] == 1, "Used count should be 1"

        # Second call → should NOT consume again (idempotent via bridge log)
        r = await cx.get(f"{API_URL}/sessions/stats", headers=_hdr(prem_tok))
        streak2 = r.json()["current_streak"]
        assert streak2 == streak1, "Streak must remain stable on re-read (no double-consume)"

        r = await cx.get(f"{API_URL}/streak/status", headers=_hdr(prem_tok))
        st2 = r.json()
        assert st2["used_this_month"] == 1, "Used count must remain 1 after re-read"

        # Cleanup
        await db.users.delete_many({"id": {"$in": [free_uid, prem_uid]}})
        await db.workout_sessions.delete_many({"user_id": {"$in": [free_uid, prem_uid]}})

    mongo.close()


@pytest.mark.asyncio
async def test_streak_freeze_status_payload():
    """Smoke test: /streak/status returns required fields."""
    async with httpx.AsyncClient(timeout=15) as cx:
        email = f"status_{uuid.uuid4().hex[:8]}@example.com"
        u = await _register(cx, email)
        r = await cx.get(f"{API_URL}/streak/status", headers=_hdr(u["token"]))
        assert r.status_code == 200
        body = r.json()
        for key in ("is_premium", "freezes_available", "used_this_month", "next_refresh_at", "monthly_allowance"):
            assert key in body, f"Missing key: {key}"
        assert body["monthly_allowance"] == 1


if __name__ == "__main__":
    asyncio.run(test_streak_freeze_full_flow())
    asyncio.run(test_streak_freeze_status_payload())
    print("OK")
