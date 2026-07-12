"""Backend tests for plan-history + plan-rollback endpoints and the
`_variation_instruction` LLM gating helper (iteration 26)."""
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fitness-ai-premium.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "sazhco0385@gmail.com"
ADMIN_PASS = "Bellakiki1"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "alphafit_db")


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


# ============ Plan History GET ============
class TestPlanHistoryList:
    def test_list_returns_200(self, headers):
        r = requests.get(f"{API}/coach/plan-history", headers=headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "plans" in data
        assert "current_plan_id" in data
        assert isinstance(data["plans"], list)

    def test_plan_entry_has_all_required_fields(self, headers):
        r = requests.get(f"{API}/coach/plan-history", headers=headers)
        data = r.json()
        assert len(data["plans"]) > 0, "Admin should have plans in history"
        p = data["plans"][0]
        required = ["id", "name", "version", "created_at", "day_count",
                    "exercise_count", "day_focus", "is_current", "progression_notes"]
        for k in required:
            assert k in p, f"Missing key '{k}' in plan entry. Got keys: {list(p.keys())}"
        assert isinstance(p["day_focus"], list)
        assert isinstance(p["is_current"], bool)
        assert isinstance(p["day_count"], int)
        assert isinstance(p["exercise_count"], int)

    def test_exactly_one_is_current_matches_user(self, headers, admin_id, db):
        r = requests.get(f"{API}/coach/plan-history", headers=headers)
        data = r.json()
        current_flagged = [p for p in data["plans"] if p["is_current"]]
        assert len(current_flagged) == 1, f"Expected exactly 1 is_current plan, got {len(current_flagged)}"
        user_doc = db.users.find_one({"id": admin_id})
        assert current_flagged[0]["id"] == user_doc["current_plan_id"]
        assert data["current_plan_id"] == user_doc["current_plan_id"]

    def test_sorted_newest_first(self, headers):
        r = requests.get(f"{API}/coach/plan-history", headers=headers)
        plans = r.json()["plans"]
        for i in range(len(plans) - 1):
            assert plans[i]["created_at"] >= plans[i + 1]["created_at"], \
                f"Plans not sorted DESC at index {i}"

    def test_limit_5(self, headers):
        r = requests.get(f"{API}/coach/plan-history?limit=5", headers=headers)
        assert r.status_code == 200
        assert len(r.json()["plans"]) <= 5

    def test_limit_1000_caps_at_100(self, headers):
        r = requests.get(f"{API}/coach/plan-history?limit=1000", headers=headers)
        assert r.status_code == 200
        assert len(r.json()["plans"]) <= 100


# ============ Plan Rollback ============
class TestPlanRollback:
    def test_rollback_unknown_id_returns_404(self, headers):
        fake_id = str(uuid.uuid4())
        r = requests.post(f"{API}/coach/plan-rollback/{fake_id}", headers=headers)
        assert r.status_code == 404
        assert "nicht gefunden" in r.json().get("detail", "").lower()

    def test_rollback_other_users_plan_returns_404(self, headers, db, admin_id):
        # Find a plan NOT owned by admin (or create synthetic)
        other = db.training_plans.find_one({"user_id": {"$ne": admin_id}}, {"_id": 0, "id": 1})
        if not other:
            # Insert a synthetic plan owned by a fake user for the test
            fake_plan_id = str(uuid.uuid4())
            db.training_plans.insert_one({
                "id": fake_plan_id,
                "user_id": "fake-other-user-" + str(uuid.uuid4()),
                "name": "OTHER USER TEST",
                "version": 1,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "days": [],
            })
            other_id = fake_plan_id
            cleanup = True
        else:
            other_id = other["id"]
            cleanup = False
        try:
            r = requests.post(f"{API}/coach/plan-rollback/{other_id}", headers=headers)
            assert r.status_code == 404, f"Expected 404 for other-user plan, got {r.status_code}: {r.text}"
        finally:
            if cleanup:
                db.training_plans.delete_one({"id": other_id})

    def test_rollback_valid_plan_and_restore(self, headers, admin_id, db):
        # Get current + oldest plan
        r = requests.get(f"{API}/coach/plan-history?limit=100", headers=headers)
        plans = r.json()["plans"]
        assert len(plans) >= 2, "Need at least 2 plans for rollback test"
        current = next(p for p in plans if p["is_current"])
        # oldest = last in DESC-sorted list, but must be different from current
        oldest = plans[-1]
        if oldest["id"] == current["id"]:
            oldest = plans[-2]
        original_id = current["id"]
        target_id = oldest["id"]
        try:
            # Rollback
            r = requests.post(f"{API}/coach/plan-rollback/{target_id}", headers=headers)
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["ok"] is True
            assert body["current_plan_id"] == target_id
            assert body["activated"]["id"] == target_id
            assert "name" in body["activated"]
            assert "version" in body["activated"]

            # Verify DB
            u = db.users.find_one({"id": admin_id})
            assert u["current_plan_id"] == target_id

            # Verify history now marks target as current (use limit=100 in case many plans)
            r2 = requests.get(f"{API}/coach/plan-history?limit=100", headers=headers)
            data2 = r2.json()
            assert data2["current_plan_id"] == target_id
            current_flagged = [p for p in data2["plans"] if p["is_current"]]
            assert len(current_flagged) == 1
            assert current_flagged[0]["id"] == target_id
        finally:
            # TEARDOWN: restore original current_plan_id
            restore = requests.post(f"{API}/coach/plan-rollback/{original_id}", headers=headers)
            assert restore.status_code == 200, f"Teardown failed: {restore.text}"
            u = db.users.find_one({"id": admin_id})
            assert u["current_plan_id"] == original_id, "Restore verification failed"


# ============ _variation_instruction unit test ============
class TestVariationInstruction:
    def test_import_and_gate(self):
        sys.path.insert(0, "/app/backend")
        import server  # noqa: F401 - must load first to break circular import
        from services.llm_coach import _variation_instruction, _plan_age_weeks

        now = datetime.now(timezone.utc)
        young = {"created_at": (now - timedelta(weeks=2)).isoformat()}
        old = {"created_at": (now - timedelta(weeks=6)).isoformat()}

        young_txt = _variation_instruction(young)
        old_txt = _variation_instruction(old)

        assert "PROGRESSIVE OVERLOAD" in young_txt, f"Young plan should trigger overload: {young_txt}"
        assert "KEINE neuen Übungen" in young_txt or "identisch" in young_txt
        assert "variieren" in old_txt, f"Old plan should allow variation: {old_txt}"

        # first_created_at takes precedence
        mixed = {"first_created_at": (now - timedelta(weeks=1)).isoformat(),
                 "created_at": (now - timedelta(weeks=10)).isoformat()}
        assert "PROGRESSIVE OVERLOAD" in _variation_instruction(mixed)

        # age helper
        assert _plan_age_weeks(young) < 4
        assert _plan_age_weeks(old) >= 4
