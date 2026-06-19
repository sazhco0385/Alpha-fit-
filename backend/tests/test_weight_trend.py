"""Backend tests for GET /api/profile/weight-trend (new endpoint, iteration 4)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or os.environ["REACT_APP_BACKEND_URL"]
BASE_URL = BASE_URL.rstrip("/")

ADMIN_EMAIL = "sazhco0385@gmail.com"
ADMIN_PASS = "Bellakiki1"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    token = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def fresh_user_session():
    """Register a fresh TEST_ user (no scans yet) for the no-scans branch."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    import uuid
    email = f"test_wt_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "password": "Pass1234!", "name": "TEST_WTrend"
    })
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {token}"})
    s.test_email = email
    return s


class TestWeightTrend:
    def test_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/profile/weight-trend")
        assert r.status_code == 401

    def test_response_shape_for_user_without_scans(self, fresh_user_session):
        r = fresh_user_session.get(f"{BASE_URL}/api/profile/weight-trend")
        assert r.status_code == 200, r.text
        data = r.json()
        # All 4 keys present
        for k in ("current_kg", "earliest_kg", "delta_kg", "points"):
            assert k in data, f"missing key {k}"
        # User has no profile yet and no scans
        assert data["earliest_kg"] is None
        assert data["delta_kg"] is None
        assert data["points"] == []

    def test_admin_response_shape(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/profile/weight-trend")
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("current_kg", "earliest_kg", "delta_kg", "points"):
            assert k in data
        assert isinstance(data["points"], list)
        # If admin has scans, validate point shape and ascending order
        if data["points"]:
            for p in data["points"]:
                assert "date" in p
                assert "weight_kg" in p
                assert isinstance(p["weight_kg"], (int, float))
            dates = [p["date"] for p in data["points"]]
            assert dates == sorted(dates), "points must be ascending by date"
            assert data["earliest_kg"] == data["points"][0]["weight_kg"]
            # If current_kg also set, delta must be numeric
            if data["current_kg"] is not None:
                assert isinstance(data["delta_kg"], (int, float))
                assert round(float(data["current_kg"]) - float(data["earliest_kg"]), 1) == data["delta_kg"]
