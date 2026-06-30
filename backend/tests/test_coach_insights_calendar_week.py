"""Coach insights — verifies calendar-week counting (Mon-Sun) not rolling-7-day."""
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


async def _register(client: httpx.AsyncClient, email: str, name: str = "CoachInsight"):
    r = await client.post(f"{API_URL}/auth/register", json={"email": email, "password": "Test1234!", "name": name})
    r.raise_for_status()
    return r.json()


def _hdr(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


def _week_start():
    """Current ISO Monday 00:00 UTC."""
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return today - timedelta(days=today.weekday())


@pytest.mark.asyncio
async def test_coach_uses_calendar_week_not_rolling_7d():
    """Sessions in the previous calendar week must NOT count as 'this week'."""
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv
    load_dotenv(os.path.join(ROOT, ".env"))
    mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = mongo[os.environ["DB_NAME"]]

    async with httpx.AsyncClient(timeout=15) as cx:
        u = await _register(cx, f"ci_{uuid.uuid4().hex[:8]}@example.com")
        uid = u["user"]["id"]
        week_start = _week_start()
        # 3 sessions LAST calendar week
        for i in range(3):
            d = week_start - timedelta(days=2 + i)
            await db.workout_sessions.insert_one({
                "id": str(uuid.uuid4()), "user_id": uid, "status": "completed",
                "started_at": d.isoformat(), "completed_at": d.isoformat(),
                "day_index": i + 1, "logged_sets": [],
            })
        # 1 session THIS calendar week
        d_this = week_start + timedelta(hours=10)
        await db.workout_sessions.insert_one({
            "id": str(uuid.uuid4()), "user_id": uid, "status": "completed",
            "started_at": d_this.isoformat(), "completed_at": d_this.isoformat(),
            "day_index": 1, "logged_sets": [],
        })
        r = await cx.get(f"{API_URL}/coach/insights", headers=_hdr(u["token"]))
        ins = r.json().get("insights", [])
        workouts_card = next((i for i in ins if i.get("type") == "workouts"), None)
        assert workouts_card is not None
        # MUST report 1 (calendar week), not 4 (rolling)
        assert "1 Workout" in workouts_card["title"], f"Expected 1, got: {workouts_card['title']}"
        # And "letzte Woche: 3" should appear
        assert "Letzte Woche: 3" in workouts_card["text"], f"Got: {workouts_card['text']}"

        # Cleanup
        await db.users.delete_one({"id": uid})
        await db.workout_sessions.delete_many({"user_id": uid})
    mongo.close()


@pytest.mark.asyncio
async def test_coach_zero_workouts_message():
    async with httpx.AsyncClient(timeout=10) as cx:
        u = await _register(cx, f"ci2_{uuid.uuid4().hex[:8]}@example.com")
        r = await cx.get(f"{API_URL}/coach/insights", headers=_hdr(u["token"]))
        ins = r.json().get("insights", [])
        workouts_card = next((i for i in ins if i.get("type") == "workouts"), None)
        assert workouts_card is not None
        assert "0 Workouts" in workouts_card["title"]


@pytest.mark.asyncio
async def test_coach_volume_uses_calendar_week():
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv
    load_dotenv(os.path.join(ROOT, ".env"))
    mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = mongo[os.environ["DB_NAME"]]
    async with httpx.AsyncClient(timeout=15) as cx:
        u = await _register(cx, f"ci3_{uuid.uuid4().hex[:8]}@example.com")
        uid = u["user"]["id"]
        ws = _week_start()
        # Last week: 1 session with 100kg * 10 reps = 1000 kg
        last_session_date = ws - timedelta(days=3)
        await db.workout_sessions.insert_one({
            "id": str(uuid.uuid4()), "user_id": uid, "status": "completed",
            "started_at": last_session_date.isoformat(),
            "completed_at": last_session_date.isoformat(),
            "day_index": 1,
            "logged_sets": [{"reps": 10, "weight_kg": 100, "exercise_index": 0, "set_index": 0}],
        })
        # This week: 1 session with 50kg * 10 reps = 500 kg → -50% volume
        this_session_date = ws + timedelta(hours=8)
        await db.workout_sessions.insert_one({
            "id": str(uuid.uuid4()), "user_id": uid, "status": "completed",
            "started_at": this_session_date.isoformat(),
            "completed_at": this_session_date.isoformat(),
            "day_index": 1,
            "logged_sets": [{"reps": 10, "weight_kg": 50, "exercise_index": 0, "set_index": 0}],
        })
        r = await cx.get(f"{API_URL}/coach/insights", headers=_hdr(u["token"]))
        ins = r.json().get("insights", [])
        vol_card = next((i for i in ins if i.get("type") == "volume"), None)
        # Should detect -50% volume (calendar week comparison, not rolling)
        assert vol_card is not None
        assert "-50" in vol_card["title"] or "50.0%" in vol_card["title"], f"Got: {vol_card['title']}"
        await db.users.delete_one({"id": uid})
        await db.workout_sessions.delete_many({"user_id": uid})
    mongo.close()
