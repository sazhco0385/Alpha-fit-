"""Funnel attribution tracking tests.

Verifies:
  1. /api/track/funnel records click + sets user.last_funnel_source
  2. /api/payments/checkout attaches attribution from last_funnel_source
  3. /api/admin/funnel/trial-reminder returns correct stage counts + rates
"""
import os
import sys
import uuid

import httpx
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

API_URL = os.environ.get("BACKEND_URL", "http://localhost:8001/api")


async def _register(client: httpx.AsyncClient, email: str, name: str = "Funnel Test"):
    r = await client.post(f"{API_URL}/auth/register", json={"email": email, "password": "Test1234!", "name": name})
    r.raise_for_status()
    return r.json()


def _hdr(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


@pytest.mark.asyncio
async def test_track_funnel_records_click_and_sets_source():
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv
    load_dotenv(os.path.join(ROOT, ".env"))
    mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = mongo[os.environ["DB_NAME"]]

    async with httpx.AsyncClient(timeout=15) as cx:
        email = f"funnel_{uuid.uuid4().hex[:8]}@example.com"
        u = await _register(cx, email)
        tok = u["token"]
        uid = u["user"]["id"]

        r = await cx.post(f"{API_URL}/track/funnel", headers=_hdr(tok),
                          json={"event": "trial_reminder_click", "source": "trial_reminder"})
        assert r.status_code == 200
        assert r.json()["source"] == "trial_reminder"

        user_doc = await db.users.find_one({"id": uid})
        assert user_doc["last_funnel_source"] == "trial_reminder"
        ev = await db.funnel_events.find_one({"user_id": uid})
        assert ev is not None
        assert ev["source"] == "trial_reminder"

        await db.users.delete_one({"id": uid})
        await db.funnel_events.delete_many({"user_id": uid})

    mongo.close()


@pytest.mark.asyncio
async def test_checkout_attaches_attribution():
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv
    load_dotenv(os.path.join(ROOT, ".env"))
    mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = mongo[os.environ["DB_NAME"]]

    async with httpx.AsyncClient(timeout=30) as cx:
        email = f"funnelpay_{uuid.uuid4().hex[:8]}@example.com"
        u = await _register(cx, email)
        tok = u["token"]
        uid = u["user"]["id"]

        # Track funnel click first
        await cx.post(f"{API_URL}/track/funnel", headers=_hdr(tok),
                      json={"event": "trial_reminder_click", "source": "trial_reminder"})

        # Now start checkout
        r = await cx.post(f"{API_URL}/payments/checkout", headers=_hdr(tok),
                          json={"plan": "monthly", "origin_url": "https://alpha-fit.fitness"})
        assert r.status_code == 200

        tx = await db.payment_transactions.find_one({"user_id": uid})
        assert tx is not None
        assert tx["attribution"] == "trial_reminder", f"Expected attribution, got: {tx}"

        await db.users.delete_one({"id": uid})
        await db.payment_transactions.delete_many({"user_id": uid})
        await db.funnel_events.delete_many({"user_id": uid})

    mongo.close()


@pytest.mark.asyncio
async def test_admin_funnel_aggregation():
    """The admin funnel endpoint returns stage counts + rates."""
    async with httpx.AsyncClient(timeout=15) as cx:
        admin = await cx.post(f"{API_URL}/auth/login", json={
            "email": os.environ.get("ADMIN_EMAIL", "sazhco0385@gmail.com"),
            "password": os.environ.get("ADMIN_PASSWORD", "Bellakiki1"),
        })
        admin_tok = admin.json()["token"]

        r = await cx.get(f"{API_URL}/admin/funnel/trial-reminder", headers=_hdr(admin_tok))
        assert r.status_code == 200
        body = r.json()
        # All keys must be present and numeric
        for k in ("emails_sent", "emails_sent_48h", "emails_sent_24h", "clicks_total",
                  "clicks_unique", "checkouts_started", "purchases", "revenue",
                  "rate_click_through", "rate_checkout", "rate_purchase", "rate_overall"):
            assert k in body, f"Missing key: {k}"
            assert isinstance(body[k], (int, float)), f"{k} not numeric: {body[k]}"


@pytest.mark.asyncio
async def test_admin_funnel_blocks_non_admin():
    async with httpx.AsyncClient(timeout=15) as cx:
        email = f"nonadm_{uuid.uuid4().hex[:8]}@example.com"
        u = await _register(cx, email)
        r = await cx.get(f"{API_URL}/admin/funnel/trial-reminder", headers=_hdr(u["token"]))
        assert r.status_code == 403
