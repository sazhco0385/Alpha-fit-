"""Iteration 13 - plan-adjust bugfix verification.

Covers:
- Regex unit tests: version suffix stripping for various raw LLM names.
- Monkeypatch: call_llm raises rate-limit -> job status='error', error contains 'Budget aufgebraucht'.
- Monkeypatch: call_llm returns non-JSON -> job status='error', error contains 'unlesbare Antwort'.
- Real E2E: admin adjust bumps version by +1, plan.name ends with ' v{N}' matching new version, no stray 'v2'.
"""
import os
import re
import sys
import uuid
import asyncio
import time
from datetime import datetime, timezone

import pytest
import requests


@pytest.fixture(scope="module")
def event_loop():
    """Module-scoped event loop so motor's AsyncIOMotorClient (bound to loop on first use)
    stays valid across all async tests in this module."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

# make backend importable
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

# Ensure env is loaded so `from server import db, ...` works
from dotenv import load_dotenv  # noqa: E402
load_dotenv(os.path.join(ROOT, ".env"))

# Import server FIRST to avoid circular import when tests later do `from services import llm_coach`
import server  # noqa: E402,F401

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fitness-ai-premium.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "sazhco0385@gmail.com"
ADMIN_PASSWORD = "Bellakiki1"


# ============================================================
# Regex unit tests (pure — no network / DB)
# ============================================================
STRIP_RE = re.compile(r"\s+v\s*\d+\s*$", re.IGNORECASE)


def _strip(name: str) -> str:
    return STRIP_RE.sub("", str(name)).strip() or "Alpha Plan"


@pytest.mark.parametrize("raw,expected", [
    ("Muscle Plan v2", "Muscle Plan"),
    ("Muscle Plan V 3", "Muscle Plan"),
    ("Muscle Plan", "Muscle Plan"),
    ("Muscle Plan v2 ", "Muscle Plan"),
    ("Progressiver 4-Tage Muskelaufbau Plan v10", "Progressiver 4-Tage Muskelaufbau Plan"),
    ("Alpha Plan V99", "Alpha Plan"),
    ("  ", "Alpha Plan"),   # empty -> fallback
    ("Push Pull Legs", "Push Pull Legs"),
])
def test_version_suffix_regex(raw, expected):
    assert _strip(raw) == expected


# ============================================================
# Monkeypatch tests — direct call into _run_adjust_job
# ============================================================
@pytest.fixture(scope="module")
def admin_user_and_plan():
    """Fetch admin user & current plan directly from Mongo (sync)."""
    from pymongo import MongoClient
    mc = MongoClient(os.environ["MONGO_URL"])
    db = mc[os.environ["DB_NAME"]]
    user = db.users.find_one({"email": ADMIN_EMAIL})
    assert user, "admin user not found"
    plan = db.training_plans.find_one({"id": user.get("current_plan_id")})
    assert plan, "admin current plan not found"
    user.pop("_id", None)
    plan.pop("_id", None)
    yield user, plan, db
    mc.close()


@pytest.mark.asyncio(loop_scope="module")
async def test_llm_rate_limit_produces_budget_error(monkeypatch, admin_user_and_plan):
    user, plan, db_sync = admin_user_and_plan
    from services import llm_coach

    async def fake_llm(*args, **kwargs):
        raise Exception("rate limit exceeded 429")

    monkeypatch.setattr(llm_coach, "call_llm", fake_llm)

    job_id = f"TEST_ratelimit_{uuid.uuid4()}"
    await llm_coach.db.plan_adjust_jobs.insert_one({
        "id": job_id, "user_id": user["id"], "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    try:
        await llm_coach._run_adjust_job(job_id, user, plan)
        job = await llm_coach.db.plan_adjust_jobs.find_one({"id": job_id}, {"_id": 0})
        assert job["status"] == "error", f"expected error, got {job}"
        assert "Budget aufgebraucht" in job.get("error", ""), f"error msg: {job.get('error')}"
    finally:
        await llm_coach.db.plan_adjust_jobs.delete_one({"id": job_id})


@pytest.mark.asyncio(loop_scope="module")
async def test_llm_malformed_response_produces_unlesbar_error(monkeypatch, admin_user_and_plan):
    user, plan, _ = admin_user_and_plan
    from services import llm_coach

    async def fake_llm(*args, **kwargs):
        return "This is not JSON at all!"

    monkeypatch.setattr(llm_coach, "call_llm", fake_llm)

    job_id = f"TEST_badjson_{uuid.uuid4()}"
    await llm_coach.db.plan_adjust_jobs.insert_one({
        "id": job_id, "user_id": user["id"], "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    try:
        await llm_coach._run_adjust_job(job_id, user, plan)
        job = await llm_coach.db.plan_adjust_jobs.find_one({"id": job_id}, {"_id": 0})
        assert job["status"] == "error", f"expected error, got {job}"
        assert "unlesbare Antwort" in job.get("error", ""), f"error msg: {job.get('error')}"
    finally:
        await llm_coach.db.plan_adjust_jobs.delete_one({"id": job_id})


# ============================================================
# Real end-to-end: version bump + clean name suffix
# ============================================================
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def test_real_adjust_bumps_version_and_strips_stray_v_suffix(auth_headers):
    # 1. version before
    r = requests.get(f"{BASE_URL}/api/plans/current", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    plan_before = r.json().get("plan", r.json())
    v_before = int(plan_before.get("version", 0))

    # 2. start adjust
    r = requests.post(f"{BASE_URL}/api/coach/adjust-plan/start", headers=auth_headers, timeout=30)
    assert r.status_code == 200, r.text
    job_id = r.json()["job_id"]

    # 3. poll (max 180s)
    finished = None
    for _ in range(90):
        time.sleep(2)
        rs = requests.get(f"{BASE_URL}/api/coach/adjust-plan/status/{job_id}",
                          headers=auth_headers, timeout=30)
        assert rs.status_code == 200
        j = rs.json()
        if j.get("status") in {"done", "error"}:
            finished = j
            break

    assert finished is not None, "job never finished"
    assert finished["status"] == "done", f"job errored: {finished.get('error')}"
    new_plan = finished["plan"]
    v_new = int(new_plan["version"])

    # Version = previous + 1
    assert v_new == v_before + 1, f"expected {v_before+1}, got {v_new}"

    # Name must end with ' v{N}' (single trailing suffix, no double/stray v2)
    name = new_plan["name"]
    assert name.endswith(f" v{v_new}"), f"name '{name}' does not end with ' v{v_new}'"
    # Guard: name must not contain a stray earlier version like ' v2 ' inside
    # (the base name without the trailing suffix should have no ' vN' left)
    base = STRIP_RE.sub("", name).strip()
    assert not STRIP_RE.search(base), f"stray version suffix still in base name: '{base}'"
    print(f"[E2E] version {v_before} -> {v_new}, name='{name}'")
