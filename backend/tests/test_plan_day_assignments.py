"""Backend tests for /api/profile/plan-day-assignments (Iteration 16 - drag & drop)."""
import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fitness-ai-premium.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "sazhco0385@gmail.com"
ADMIN_PASSWORD = "Bellakiki1"


@pytest.fixture(scope="module")
def headers():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module", autouse=True)
def reset_profile():
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "alphafit_db")
    client = MongoClient(mongo_url)
    db = client[db_name]
    db.users.update_one(
        {"email": ADMIN_EMAIL},
        {"$unset": {"profile.training_weekdays": "", "profile.plan_day_assignments": ""}},
    )
    yield
    client.close()


def _set_weekdays(headers, wds):
    r = requests.put(f"{BASE_URL}/api/profile/training-days",
                     json={"weekdays": wds}, headers=headers, timeout=30)
    assert r.status_code == 200, r.text


def test_get_returns_empty_assignments_by_default(headers):
    _set_weekdays(headers, [0, 1, 3, 4])
    # Clear assignments explicitly
    requests.put(f"{BASE_URL}/api/profile/plan-day-assignments",
                 json={"assignments": {}}, headers=headers, timeout=30)
    r = requests.get(f"{BASE_URL}/api/profile/training-days", headers=headers, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert "plan_day_assignments" in d
    assert d["plan_day_assignments"] == {}


def test_put_and_get_assignments(headers):
    _set_weekdays(headers, [0, 1, 3, 4])
    r = requests.put(f"{BASE_URL}/api/profile/plan-day-assignments",
                     json={"assignments": {"1": 0, "2": 3}}, headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert body["plan_day_assignments"] == {"1": 0, "2": 3}

    g = requests.get(f"{BASE_URL}/api/profile/training-days", headers=headers, timeout=30)
    assert g.status_code == 200
    assert g.json()["plan_day_assignments"] == {"1": 0, "2": 3}


def test_put_rejects_restday_assignment(headers):
    _set_weekdays(headers, [0, 1, 3, 4])
    r = requests.put(f"{BASE_URL}/api/profile/plan-day-assignments",
                     json={"assignments": {"1": 2}}, headers=headers, timeout=30)
    assert r.status_code == 400
    assert "Restday" in r.json().get("detail", "")


def test_put_rejects_duplicate_weekdays(headers):
    _set_weekdays(headers, [0, 1, 3, 4])
    r = requests.put(f"{BASE_URL}/api/profile/plan-day-assignments",
                     json={"assignments": {"1": 0, "2": 0}}, headers=headers, timeout=30)
    assert r.status_code == 400
    assert "mehrfach" in r.json().get("detail", "").lower()


def test_stale_assignments_dropped_when_weekday_removed(headers):
    _set_weekdays(headers, [0, 1, 3, 4])
    r = requests.put(f"{BASE_URL}/api/profile/plan-day-assignments",
                     json={"assignments": {"1": 0, "2": 3}}, headers=headers, timeout=30)
    assert r.status_code == 200
    # Now shrink training weekdays -> 3 no longer training day
    _set_weekdays(headers, [0, 4])
    g = requests.get(f"{BASE_URL}/api/profile/training-days", headers=headers, timeout=30)
    assert g.status_code == 200
    assert g.json()["plan_day_assignments"] == {"1": 0}


def test_empty_dict_clears_all(headers):
    _set_weekdays(headers, [0, 1, 3, 4])
    requests.put(f"{BASE_URL}/api/profile/plan-day-assignments",
                 json={"assignments": {"1": 0}}, headers=headers, timeout=30)
    r = requests.put(f"{BASE_URL}/api/profile/plan-day-assignments",
                     json={"assignments": {}}, headers=headers, timeout=30)
    assert r.status_code == 200
    assert r.json()["plan_day_assignments"] == {}
    g = requests.get(f"{BASE_URL}/api/profile/training-days", headers=headers, timeout=30)
    assert g.json()["plan_day_assignments"] == {}
