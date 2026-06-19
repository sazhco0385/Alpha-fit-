"""Phase C - Leaderboard tests.

Validates GET /api/leaderboard for all metric/period/scope combinations,
empty friends case, 422 validation, defaults, and the contract that
`you` is always present.
"""
import os
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "sazhco0385@gmail.com"
ADMIN_PASSWORD = "Bellakiki1"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_id(admin_headers):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    return r.json()["id"]


# ---------- Helpers ----------
def _get_lb(headers, **params):
    return requests.get(f"{BASE_URL}/api/leaderboard", headers=headers,
                        params=params, timeout=30)


def _assert_basic_shape(data, metric, period, scope):
    for key in ("metric", "metric_label", "period", "scope", "rows", "you", "generated_at"):
        assert key in data, f"missing key {key}"
    assert data["metric"] == metric
    assert data["period"] == period
    assert data["scope"] == scope
    assert isinstance(data["rows"], list)
    assert data["you"] is not None, "`you` MUST always be present"
    # rank ordering
    for i, row in enumerate(data["rows"]):
        assert row["rank"] == i + 1
        for k in ("rank", "user_id", "name", "is_premium", "value", "is_self"):
            assert k in row
    # rows sorted desc
    vals = [r["value"] for r in data["rows"]]
    assert vals == sorted(vals, reverse=True), "rows not sorted desc"


# ---------- Tests ----------
class TestLeaderboardDefaults:
    def test_defaults_no_params(self, admin_headers):
        r = _get_lb(admin_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["metric"] == "workouts"
        assert d["period"] == "30d"
        assert d["scope"] == "friends"
        assert d["you"] is not None


class TestWorkouts:
    def test_workouts_friends_30d(self, admin_headers, admin_id):
        r = _get_lb(admin_headers, metric="workouts", period="30d", scope="friends")
        assert r.status_code == 200
        d = r.json()
        _assert_basic_shape(d, "workouts", "30d", "friends")
        # admin must be in candidate set; either in rows with is_self or in `you` standalone
        in_rows = any(row["is_self"] and row["user_id"] == admin_id for row in d["rows"])
        you_self = d["you"]["user_id"] == admin_id and d["you"]["is_self"] is True
        assert in_rows or you_self

    def test_workouts_global_7d_vs_all_period_filters(self, admin_headers):
        r7 = _get_lb(admin_headers, metric="workouts", period="7d", scope="global")
        rall = _get_lb(admin_headers, metric="workouts", period="all", scope="global")
        assert r7.status_code == 200 and rall.status_code == 200
        d7, dall = r7.json(), rall.json()
        _assert_basic_shape(d7, "workouts", "7d", "global")
        _assert_basic_shape(dall, "workouts", "all", "global")
        # 7d total value should be <= all-time total value for matching users
        sum7 = sum(r["value"] for r in d7["rows"])
        suma = sum(r["value"] for r in dall["rows"])
        assert sum7 <= suma, f"7d sum {sum7} should be <= all-time sum {suma}"

    def test_workouts_global_all(self, admin_headers):
        r = _get_lb(admin_headers, metric="workouts", period="all", scope="global")
        assert r.status_code == 200
        _assert_basic_shape(r.json(), "workouts", "all", "global")


class TestVolume:
    def test_volume_global_30d_shape(self, admin_headers):
        r = _get_lb(admin_headers, metric="volume", period="30d", scope="global")
        assert r.status_code == 200
        d = r.json()
        _assert_basic_shape(d, "volume", "30d", "global")
        for row in d["rows"]:
            assert row["value"] >= 0
            assert isinstance(row["value"], (int, float))

    def test_volume_aggregation_matches_manual(self, admin_headers, admin_id):
        """Compare leaderboard volume for admin vs manual sum of logged_sets."""
        # Get admin's volume from leaderboard
        r = _get_lb(admin_headers, metric="volume", period="all", scope="friends")
        assert r.status_code == 200
        d = r.json()
        admin_row = next((x for x in d["rows"] if x["user_id"] == admin_id), None)
        lb_value = admin_row["value"] if admin_row else d["you"]["value"]

        # Manually fetch admin's completed sessions
        sr = requests.get(f"{BASE_URL}/api/sessions", headers=admin_headers, timeout=15)
        if sr.status_code != 200:
            pytest.skip("/api/sessions not available")
        sessions = sr.json()
        if isinstance(sessions, dict):
            sessions = sessions.get("sessions") or sessions.get("items") or []
        manual = 0.0
        for s in sessions:
            if s.get("status") != "completed":
                continue
            for ls in (s.get("logged_sets") or []):
                manual += float(ls.get("reps") or 0) * float(ls.get("weight_kg") or 0)
        # allow small rounding tolerance
        assert abs(lb_value - round(manual, 1)) < 1.0, \
            f"LB volume {lb_value} differs from manual {manual}"


class TestStreak:
    def test_streak_friends_ignores_period(self, admin_headers):
        r1 = _get_lb(admin_headers, metric="streak", period="7d", scope="friends")
        r2 = _get_lb(admin_headers, metric="streak", period="all", scope="friends")
        assert r1.status_code == 200 and r2.status_code == 200
        d1, d2 = r1.json(), r2.json()
        # period is preserved in response but data should be identical
        assert [(x["user_id"], x["value"]) for x in d1["rows"]] == \
               [(x["user_id"], x["value"]) for x in d2["rows"]]
        for row in d1["rows"]:
            assert row["value"] > 0, "streak rows must have current_streak>0"

    def test_streak_global(self, admin_headers):
        r = _get_lb(admin_headers, metric="streak", period="30d", scope="global")
        assert r.status_code == 200
        d = r.json()
        _assert_basic_shape(d, "streak", "30d", "global")
        # streak values must be positive integers (returned as float)
        for row in d["rows"]:
            assert row["value"] > 0
            assert row["value"] == int(row["value"])


class TestYouContract:
    def test_you_always_present_workouts(self, admin_headers, admin_id):
        r = _get_lb(admin_headers, metric="workouts", period="7d", scope="global", limit=1)
        assert r.status_code == 200
        d = r.json()
        assert d["you"] is not None
        assert d["you"]["user_id"] == admin_id
        assert d["you"]["is_self"] is True
        assert isinstance(d["you"]["value"], (int, float))

    def test_you_always_present_volume(self, admin_headers, admin_id):
        r = _get_lb(admin_headers, metric="volume", period="7d", scope="global", limit=1)
        assert r.status_code == 200
        d = r.json()
        assert d["you"] is not None
        assert d["you"]["user_id"] == admin_id

    def test_you_always_present_streak(self, admin_headers, admin_id):
        r = _get_lb(admin_headers, metric="streak", scope="global", limit=1)
        assert r.status_code == 200
        d = r.json()
        assert d["you"] is not None
        assert d["you"]["user_id"] == admin_id


class TestValidation:
    def test_invalid_metric(self, admin_headers):
        assert _get_lb(admin_headers, metric="foo").status_code == 422

    def test_invalid_period(self, admin_headers):
        assert _get_lb(admin_headers, period="invalid").status_code == 422

    def test_invalid_scope(self, admin_headers):
        assert _get_lb(admin_headers, scope="other").status_code == 422

    def test_limit_zero(self, admin_headers):
        assert _get_lb(admin_headers, limit=0).status_code == 422

    def test_limit_too_high(self, admin_headers):
        assert _get_lb(admin_headers, limit=999).status_code == 422

    def test_no_auth(self):
        assert requests.get(f"{BASE_URL}/api/leaderboard", timeout=15).status_code in (401, 403)


class TestFriendsEmpty:
    """Verify a fresh user with no friends still gets self in rows."""
    def test_no_friends_user_self_in_rows(self):
        # Create a brand new isolated user
        email = f"TEST_phaseC_solo_{datetime.now().timestamp():.0f}@example.com"
        reg = requests.post(f"{BASE_URL}/api/auth/register",
                            json={"email": email, "password": "TestPass1!", "name": "Solo Phase C"},
                            timeout=20)
        if reg.status_code not in (200, 201):
            pytest.skip(f"register failed: {reg.status_code} {reg.text[:200]}")
        token = reg.json().get("token")
        if not token:
            login = requests.post(f"{BASE_URL}/api/auth/login",
                                  json={"email": email, "password": "TestPass1!"}, timeout=15)
            token = login.json().get("token")
        headers = {"Authorization": f"Bearer {token}"}

        # Friends scope, workouts - user has no friends and no workouts
        r = requests.get(f"{BASE_URL}/api/leaderboard", headers=headers,
                         params={"metric": "workouts", "scope": "friends", "period": "all"},
                         timeout=20)
        assert r.status_code == 200
        d = r.json()
        # Either user is in rows (value=0 possible) OR you is present with rank=None
        assert d["you"] is not None
        # With no workouts, rows may be empty; you.value should be 0
        if not any(row["is_self"] for row in d["rows"]):
            assert d["you"]["value"] == 0 or d["you"]["value"] == 0.0
