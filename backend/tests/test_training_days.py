"""Backend tests for /api/profile/training-days router (Iteration 15)."""
import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fitness-ai-premium.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "sazhco0385@gmail.com"
ADMIN_PASSWORD = "Bellakiki1"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module", autouse=True)
def reset_training_weekdays():
    """Unset training_weekdays on admin profile so default logic can be tested."""
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "alphafit_db")
    client = MongoClient(mongo_url)
    db = client[db_name]
    db.users.update_one({"email": ADMIN_EMAIL}, {"$unset": {"profile.training_weekdays": ""}})
    yield
    client.close()


def test_get_default_training_days(headers):
    r = requests.get(f"{BASE_URL}/api/profile/training-days", headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["is_custom"] is False
    assert isinstance(data["weekdays"], list)
    # default for days_per_week=4 -> [0,1,3,4]; if user has different dpw, at least valid range
    dpw = data.get("days_per_week")
    if dpw == 4:
        assert data["weekdays"] == [0, 1, 3, 4]
    assert all(0 <= x <= 6 for x in data["weekdays"])


def test_put_and_get_custom_days(headers):
    r = requests.put(f"{BASE_URL}/api/profile/training-days",
                     json={"weekdays": [0, 2, 4]}, headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json() == {"ok": True, "weekdays": [0, 2, 4]}

    g = requests.get(f"{BASE_URL}/api/profile/training-days", headers=headers, timeout=30)
    assert g.status_code == 200
    d = g.json()
    assert d["weekdays"] == [0, 2, 4]
    assert d["is_custom"] is True


def test_put_restores_default_looking(headers):
    r = requests.put(f"{BASE_URL}/api/profile/training-days",
                     json={"weekdays": [0, 1, 3, 4]}, headers=headers, timeout=30)
    assert r.status_code == 200
    assert r.json()["weekdays"] == [0, 1, 3, 4]


def test_put_empty_list_returns_400(headers):
    r = requests.put(f"{BASE_URL}/api/profile/training-days",
                     json={"weekdays": []}, headers=headers, timeout=30)
    assert r.status_code == 400
    assert "Mindestens" in r.json().get("detail", "")


def test_put_invalid_ints_dropped(headers):
    # 7, -1 out of range and 'x' non-int -> should keep only [1,3] after filtering
    # Note: FastAPI/pydantic v2 may reject 'x' since field type is List[int]; test with mixed valid+invalid ints
    r = requests.put(f"{BASE_URL}/api/profile/training-days",
                     json={"weekdays": [7, -1, 1, 3]}, headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["weekdays"] == [1, 3]


def test_put_all_invalid_returns_400(headers):
    r = requests.put(f"{BASE_URL}/api/profile/training-days",
                     json={"weekdays": [7, -1, 99]}, headers=headers, timeout=30)
    assert r.status_code == 400


def test_put_deduplicates(headers):
    r = requests.put(f"{BASE_URL}/api/profile/training-days",
                     json={"weekdays": [1, 1, 2, 3, 3]}, headers=headers, timeout=30)
    assert r.status_code == 200
    assert r.json()["weekdays"] == [1, 2, 3]


def test_unauthenticated_returns_401():
    r = requests.get(f"{BASE_URL}/api/profile/training-days", timeout=30)
    assert r.status_code in (401, 403)
