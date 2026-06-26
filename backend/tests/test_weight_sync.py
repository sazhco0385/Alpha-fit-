"""Body-weight + plan auto-adjust integration tests."""
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


async def _register(client: httpx.AsyncClient, email: str, name: str = "BW Test"):
    r = await client.post(f"{API_URL}/auth/register", json={"email": email, "password": "Test1234!", "name": name})
    r.raise_for_status()
    return r.json()


def _hdr(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


@pytest.mark.asyncio
async def test_weight_log_updates_weight_trend_immediately():
    """Bug fix: after /body-weight/log, /profile/weight-trend must show the new value."""
    async with httpx.AsyncClient(timeout=15) as cx:
        u = await _register(cx, f"bw_{uuid.uuid4().hex[:8]}@example.com")
        tok = u["token"]
        # Baseline
        before = (await cx.get(f"{API_URL}/profile/weight-trend", headers=_hdr(tok))).json()
        # Log new weight
        r = await cx.post(f"{API_URL}/body-weight/log", headers=_hdr(tok), json={"weight_kg": 78.5})
        assert r.status_code == 200
        # weight-trend must reflect it
        after = (await cx.get(f"{API_URL}/profile/weight-trend", headers=_hdr(tok))).json()
        assert after["current_kg"] == 78.5
        assert len(after["points"]) > len(before.get("points") or [])
        # Last point matches what we just logged
        assert after["points"][-1]["weight_kg"] == 78.5


@pytest.mark.asyncio
async def test_weight_log_syncs_profile_weight():
    """After /body-weight/log, the user.profile.weight_kg must be in sync."""
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv
    load_dotenv(os.path.join(ROOT, ".env"))
    mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = mongo[os.environ["DB_NAME"]]

    async with httpx.AsyncClient(timeout=15) as cx:
        u = await _register(cx, f"bw2_{uuid.uuid4().hex[:8]}@example.com")
        uid = u["user"]["id"]
        await cx.post(f"{API_URL}/body-weight/log", headers=_hdr(u["token"]), json={"weight_kg": 77.0})
        user_doc = await db.users.find_one({"id": uid})
        assert (user_doc.get("profile") or {}).get("weight_kg") == 77.0
        assert (user_doc.get("profile") or {}).get("weight_updated_at") is not None
    mongo.close()


@pytest.mark.asyncio
async def test_weight_trend_merges_logs_and_scans_sorted():
    """Both manual logs and body-scan weights appear in points, sorted ascending."""
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv
    load_dotenv(os.path.join(ROOT, ".env"))
    mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = mongo[os.environ["DB_NAME"]]
    async with httpx.AsyncClient(timeout=15) as cx:
        u = await _register(cx, f"bw3_{uuid.uuid4().hex[:8]}@example.com")
        uid = u["user"]["id"]
        # Seed: body_scan from 10 days ago, body_weight_log from 2 days ago + today
        now_utc = datetime.now(timezone.utc)
        await db.body_scans.insert_one({
            "id": str(uuid.uuid4()), "user_id": uid,
            "created_at": (now_utc - timedelta(days=10)).isoformat(),
            "weight_kg_at_scan": 85.0,
        })
        await db.body_weight_logs.insert_one({
            "id": str(uuid.uuid4()), "user_id": uid,
            "logged_at": (now_utc - timedelta(days=2)).isoformat(),
            "weight_kg": 83.5, "created_at": now_iso_str(),
        })
        await cx.post(f"{API_URL}/body-weight/log", headers=_hdr(u["token"]), json={"weight_kg": 82.0})
        d = (await cx.get(f"{API_URL}/profile/weight-trend", headers=_hdr(u["token"]))).json()
        assert d["current_kg"] == 82.0
        assert d["earliest_kg"] == 85.0
        assert d["delta_kg"] == -3.0
        assert len(d["points"]) == 3
        # Sorted ascending by date
        dates = [p["date"] for p in d["points"]]
        assert dates == sorted(dates)
        # Cleanup
        await db.users.delete_one({"id": uid})
        await db.body_scans.delete_many({"user_id": uid})
        await db.body_weight_logs.delete_many({"user_id": uid})
    mongo.close()


def now_iso_str():
    return datetime.now(timezone.utc).isoformat()
