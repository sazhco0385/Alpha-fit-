"""Backend tests for muscle-groups statistics endpoint."""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fitness-ai-premium.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "sazhco0385@gmail.com"
ADMIN_PASS = "Bellakiki1"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "alphafit_db")

EXPECTED_ORDER = ["brust", "ruecken", "beine", "schultern", "arme", "bauch", "gesaess"]


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def admin_id(headers):
    r = requests.get(f"{API}/auth/me", headers=headers)
    assert r.status_code == 200
    return r.json()["id"]


@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


def test_endpoint_structure(headers):
    r = requests.get(f"{API}/muscle-groups/stats", headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()
    for k in ["weeks", "baseline_sessions_per_group", "total_sessions", "groups"]:
        assert k in data, f"Missing key {k}"
    assert isinstance(data["groups"], list) and len(data["groups"]) == 7
    keys = [g["key"] for g in data["groups"]]
    assert keys == EXPECTED_ORDER, f"Order mismatch: {keys}"
    for g in data["groups"]:
        for k in ["key", "name", "sessions_hit", "exercises_completed", "percent"]:
            assert k in g


def test_weeks_param_clamp(headers):
    r1 = requests.get(f"{API}/muscle-groups/stats?weeks=1", headers=headers)
    assert r1.status_code == 200
    assert r1.json()["weeks"] == 1
    assert r1.json()["baseline_sessions_per_group"] == 2

    r8 = requests.get(f"{API}/muscle-groups/stats?weeks=8", headers=headers)
    assert r8.json()["weeks"] == 8
    assert r8.json()["baseline_sessions_per_group"] == 16

    # Clamp above 12
    r_over = requests.get(f"{API}/muscle-groups/stats?weeks=99", headers=headers)
    assert r_over.json()["weeks"] == 12

    # Clamp below 1
    r_under = requests.get(f"{API}/muscle-groups/stats?weeks=0", headers=headers)
    assert r_under.json()["weeks"] == 1


def test_seed_session_counts_brust_and_beine(headers, admin_id, db):
    # Find or create a plan with day containing Brust + Beine exercises
    plan = db.training_plans.find_one({"user_id": admin_id})
    seed_plan_created = False
    plan_id = None

    day_index_to_use = 1
    if plan:
        plan_id = plan["id"]
        # Try find a day with both muscles OR just inject
        found = False
        for d in plan.get("days", []) or []:
            muscles = {(e.get("target_muscle") or "").lower() for e in (d.get("exercises") or [])}
            if any("brust" in m or "chest" in m for m in muscles) and any("bein" in m or "leg" in m or "quad" in m for m in muscles):
                day_index_to_use = d.get("day_index")
                found = True
                break
        if not found:
            # Inject a synthetic day into the existing plan
            new_day = {
                "day_index": 99,
                "title": "TEST DAY",
                "exercises": [
                    {"name": "TEST Bankdrücken", "target_muscle": "Brust", "sets": 3, "reps": 8},
                    {"name": "TEST Kniebeuge", "target_muscle": "Beine", "sets": 3, "reps": 8},
                ],
            }
            db.training_plans.update_one({"id": plan_id}, {"$push": {"days": new_day}})
            day_index_to_use = 99
    else:
        # Create seed plan
        plan_id = str(uuid.uuid4())
        db.training_plans.insert_one({
            "id": plan_id,
            "user_id": admin_id,
            "days": [{
                "day_index": 1,
                "title": "TEST",
                "exercises": [
                    {"name": "TEST Bankdrücken", "target_muscle": "Brust", "sets": 3, "reps": 8},
                    {"name": "TEST Kniebeuge", "target_muscle": "Beine", "sets": 3, "reps": 8},
                ],
            }],
        })
        seed_plan_created = True
        day_index_to_use = 1

    # Insert completed workout session
    session_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    db.workout_sessions.insert_one({
        "id": session_id,
        "user_id": admin_id,
        "plan_id": plan_id,
        "day_index": day_index_to_use,
        "status": "completed",
        "completed_at": now_iso,
        "started_at": now_iso,
        "logged_sets": [
            {"exercise_index": 0, "set_index": 0, "reps": 8, "weight_kg": 60},
            {"exercise_index": 1, "set_index": 0, "reps": 8, "weight_kg": 60},
        ],
    })

    try:
        r = requests.get(f"{API}/muscle-groups/stats?weeks=1", headers=headers)
        assert r.status_code == 200
        data = r.json()
        by_key = {g["key"]: g for g in data["groups"]}
        assert by_key["brust"]["sessions_hit"] >= 1, f"brust={by_key['brust']}"
        assert by_key["beine"]["sessions_hit"] >= 1, f"beine={by_key['beine']}"
        # Percent formula: min(100, round(hits/baseline*100)); baseline=2 for weeks=1
        # If sessions_hit == 1 → 50%. Verify percent computation basic sanity.
        assert by_key["brust"]["percent"] == min(100, round(by_key["brust"]["sessions_hit"] / 2 * 100))
    finally:
        db.workout_sessions.delete_one({"id": session_id})
        if seed_plan_created:
            db.training_plans.delete_one({"id": plan_id})
        else:
            # Remove injected day
            db.training_plans.update_one({"id": plan_id}, {"$pull": {"days": {"day_index": 99, "title": "TEST DAY"}}})


def test_percent_formula_with_two_sessions(headers, admin_id, db):
    """Insert 2 completed sessions in last 1 week hitting 'brust' → percent should be 100."""
    plan = db.training_plans.find_one({"user_id": admin_id})
    plan_id = None
    seed_plan_created = False
    if plan:
        plan_id = plan["id"]
        # Inject a synthetic day
        new_day = {
            "day_index": 98,
            "title": "TEST DAY 2",
            "exercises": [
                {"name": "TEST Bench", "target_muscle": "Brust", "sets": 3, "reps": 8},
            ],
        }
        db.training_plans.update_one({"id": plan_id}, {"$push": {"days": new_day}})
    else:
        plan_id = str(uuid.uuid4())
        db.training_plans.insert_one({
            "id": plan_id,
            "user_id": admin_id,
            "days": [{"day_index": 98, "title": "TEST DAY 2", "exercises": [{"name": "T", "target_muscle": "Brust"}]}],
        })
        seed_plan_created = True

    session_ids = []
    now_iso = datetime.now(timezone.utc).isoformat()
    for _ in range(2):
        sid = str(uuid.uuid4())
        db.workout_sessions.insert_one({
            "id": sid,
            "user_id": admin_id,
            "plan_id": plan_id,
            "day_index": 98,
            "status": "completed",
            "completed_at": now_iso,
            "started_at": now_iso,
            "logged_sets": [{"exercise_index": 0, "set_index": 0, "reps": 8, "weight_kg": 60}],
        })
        session_ids.append(sid)

    try:
        r = requests.get(f"{API}/muscle-groups/stats?weeks=1", headers=headers)
        data = r.json()
        by_key = {g["key"]: g for g in data["groups"]}
        # brust hit at least 2 times, baseline=2 → 100
        assert by_key["brust"]["sessions_hit"] >= 2
        assert by_key["brust"]["percent"] == 100
    finally:
        for sid in session_ids:
            db.workout_sessions.delete_one({"id": sid})
        if seed_plan_created:
            db.training_plans.delete_one({"id": plan_id})
        else:
            db.training_plans.update_one({"id": plan_id}, {"$pull": {"days": {"day_index": 98}}})


def test_regression_other_endpoints(headers):
    """Regression: /sessions/history and /auth/me still work."""
    r = requests.get(f"{API}/sessions/history", headers=headers)
    assert r.status_code == 200
    r2 = requests.get(f"{API}/auth/me", headers=headers)
    assert r2.status_code == 200
