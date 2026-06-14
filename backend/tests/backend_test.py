"""Backend tests for alpha-fit API."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fitness-ai-premium.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "sazhco0385@gmail.com"
ADMIN_PASSWORD = "Bellakiki1"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def test_user_creds():
    return {
        "email": f"TEST_user_{uuid.uuid4().hex[:8]}@example.com",
        "password": "TestPass123!",
        "name": "TEST User",
    }


@pytest.fixture(scope="session")
def user_token(session, test_user_creds):
    r = session.post(f"{API}/auth/register", json=test_user_creds, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    assert data["user"]["onboarding_completed"] is False
    return data["token"], data["user"]


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["is_admin"] is True, "admin flag missing"
    return data["token"], data["user"]


def auth_h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ===== Auth =====
class TestAuth:
    def test_register_and_login(self, session, user_token):
        token, user = user_token
        assert isinstance(token, str) and len(token) > 0
        assert user["email"].startswith("test_user_")

    def test_me(self, session, user_token):
        token, user = user_token
        r = session.get(f"{API}/auth/me", headers=auth_h(token), timeout=30)
        assert r.status_code == 200
        assert r.json()["id"] == user["id"]

    def test_login_admin(self, session, admin_token):
        token, user = admin_token
        assert user["is_admin"] is True

    def test_login_invalid(self, session):
        r = session.post(f"{API}/auth/login", json={"email": "nobody@xx.com", "password": "x"}, timeout=30)
        assert r.status_code == 401

    def test_me_no_token(self, session):
        r = session.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 401


# ===== Onboarding & Plan =====
class TestOnboardingAndPlan:
    def test_onboarding_creates_plan(self, session, user_token):
        token, user = user_token
        payload = {
            "goal": "muscle_gain",
            "experience": "intermediate",
            "gender": "male",
            "age": 28,
            "height_cm": 180,
            "weight_kg": 80,
            "days_per_week": 3,
            "equipment": "gym",
            "injuries": "",
        }
        r = session.post(f"{API}/onboarding", json=payload, headers=auth_h(token), timeout=120)
        assert r.status_code == 200, f"onboarding failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("ok") is True
        assert body.get("plan_id")

    def test_plans_current(self, session, user_token):
        token, _ = user_token
        r = session.get(f"{API}/plans/current", headers=auth_h(token), timeout=30)
        assert r.status_code == 200
        plan = r.json().get("plan")
        assert plan is not None, "no plan after onboarding"
        assert isinstance(plan.get("days"), list) and len(plan["days"]) > 0
        d0 = plan["days"][0]
        assert "name" in d0 and isinstance(d0.get("exercises"), list) and len(d0["exercises"]) > 0
        ex = d0["exercises"][0]
        for k in ("name", "sets", "reps", "weight_kg", "rest_seconds"):
            assert k in ex, f"missing exercise field {k}"

    def test_me_after_onboarding(self, session, user_token):
        token, _ = user_token
        r = session.get(f"{API}/auth/me", headers=auth_h(token), timeout=30)
        assert r.status_code == 200
        u = r.json()
        assert u["onboarding_completed"] is True
        assert u["current_plan_id"]


# ===== Sessions =====
@pytest.fixture(scope="session")
def active_session(session, user_token):
    token, _ = user_token
    r = session.post(f"{API}/sessions/start", json={"day_index": 1}, headers=auth_h(token), timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["session"]["status"] == "active"
    return data["session"]


class TestSessions:
    def test_start_session(self, active_session):
        assert active_session["day_index"] == 1
        assert active_session["status"] == "active"

    def test_start_session_resume(self, session, user_token, active_session):
        token, _ = user_token
        r = session.post(f"{API}/sessions/start", json={"day_index": 1}, headers=auth_h(token), timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data.get("resumed") is True
        assert data["session"]["id"] == active_session["id"]

    def test_get_active(self, session, user_token, active_session):
        token, _ = user_token
        r = session.get(f"{API}/sessions/active", headers=auth_h(token), timeout=30)
        assert r.status_code == 200
        assert r.json()["session"]["id"] == active_session["id"]

    def test_log_set(self, session, user_token, active_session):
        token, _ = user_token
        payload = {"session_id": active_session["id"], "exercise_index": 0, "set_index": 0, "reps": 8, "weight_kg": 60.0}
        r = session.post(f"{API}/sessions/log-set", json=payload, headers=auth_h(token), timeout=30)
        assert r.status_code == 200
        assert r.json()["logged_count"] >= 1

    def test_update_progress(self, session, user_token, active_session):
        token, _ = user_token
        payload = {"session_id": active_session["id"], "exercise_index": 1, "set_index": 0}
        r = session.post(f"{API}/sessions/update-progress", json=payload, headers=auth_h(token), timeout=30)
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_complete_session(self, session, user_token, active_session):
        token, _ = user_token
        r = session.post(f"{API}/sessions/complete", json={"session_id": active_session["id"]}, headers=auth_h(token), timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        # First workout badge expected
        new_badge_ids = [b["id"] for b in body.get("new_badges", [])]
        assert "first_workout" in new_badge_ids or body.get("total_completed", 0) >= 1


# ===== Coach =====
class TestCoach:
    def test_chat(self, session, user_token):
        token, _ = user_token
        r = session.post(f"{API}/coach/chat", json={"text": "Gib mir kurz einen Motivations-Tipp"}, headers=auth_h(token), timeout=120)
        assert r.status_code == 200, r.text
        reply = r.json().get("reply")
        assert isinstance(reply, str) and len(reply) > 0

    def test_adjust_plan(self, session, user_token):
        token, _ = user_token
        # adjust-plan requires existing plan + completed session - both from prior tests
        r = session.post(f"{API}/coach/adjust-plan", json={}, headers=auth_h(token), timeout=180)
        assert r.status_code == 200, f"adjust failed: {r.status_code} {r.text}"
        plan = r.json().get("plan")
        assert plan is not None
        assert plan.get("version", 1) > 1
        assert isinstance(plan.get("days"), list) and len(plan["days"]) > 0


# ===== Payments =====
class TestPayments:
    def test_checkout(self, session, user_token):
        token, _ = user_token
        r = session.post(
            f"{API}/payments/checkout",
            json={"plan": "monthly", "origin_url": "https://example.com"},
            headers=auth_h(token),
            timeout=60,
        )
        # Stripe live: may succeed or fail; we accept 200 (preferred) else mark
        if r.status_code == 200:
            data = r.json()
            assert data.get("url", "").startswith("http")
            assert data.get("session_id")
            pytest.checkout_session_id = data["session_id"]
        else:
            pytest.skip(f"Stripe checkout returned {r.status_code}: {r.text}")

    def test_checkout_invalid_plan(self, session, user_token):
        token, _ = user_token
        r = session.post(
            f"{API}/payments/checkout",
            json={"plan": "bogus", "origin_url": "https://x.com"},
            headers=auth_h(token),
            timeout=30,
        )
        assert r.status_code == 400

    def test_payment_status(self, session, user_token):
        sid = getattr(pytest, "checkout_session_id", None)
        if not sid:
            pytest.skip("no checkout session from previous test")
        token, _ = user_token
        r = session.get(f"{API}/payments/status/{sid}", headers=auth_h(token), timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "status" in data and "payment_status" in data


# ===== Admin =====
class TestAdmin:
    def test_admin_stats(self, session, admin_token):
        token, _ = admin_token
        r = session.get(f"{API}/admin/stats", headers=auth_h(token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_users", "premium_users", "revenue_today", "revenue_month", "revenue_total", "daily_revenue"):
            assert k in d, f"missing {k}"
        assert isinstance(d["daily_revenue"], list)

    def test_admin_members(self, session, admin_token):
        token, _ = admin_token
        r = session.get(f"{API}/admin/members", headers=auth_h(token), timeout=30)
        assert r.status_code == 200
        members = r.json().get("members")
        assert isinstance(members, list) and len(members) >= 1

    def test_admin_grant_revoke_premium(self, session, admin_token, user_token):
        token, _ = admin_token
        _, user = user_token
        # Grant
        r = session.post(
            f"{API}/admin/members/premium",
            json={"user_id": user["id"], "days": 30},
            headers=auth_h(token),
            timeout=30,
        )
        assert r.status_code == 200
        assert r.json()["ok"] is True
        # Verify in members list
        r2 = session.get(f"{API}/admin/members", headers=auth_h(token), timeout=30)
        m = next((x for x in r2.json()["members"] if x["id"] == user["id"]), None)
        assert m and m.get("is_premium") is True

        # Revoke
        r = session.post(
            f"{API}/admin/members/revoke-premium",
            json={"user_id": user["id"]},
            headers=auth_h(token),
            timeout=30,
        )
        assert r.status_code == 200

    def test_non_admin_forbidden(self, session, user_token):
        token, _ = user_token
        r = session.get(f"{API}/admin/stats", headers=auth_h(token), timeout=30)
        assert r.status_code == 403

    def test_admin_delete_member(self, session, admin_token):
        """Create a throwaway user and delete them."""
        token, _ = admin_token
        throwaway = {
            "email": f"TEST_del_{uuid.uuid4().hex[:8]}@example.com",
            "password": "TestPass123!",
            "name": "TEST Delete",
        }
        rreg = session.post(f"{API}/auth/register", json=throwaway, timeout=30)
        assert rreg.status_code == 200
        uid = rreg.json()["user"]["id"]
        rdel = session.delete(f"{API}/admin/members/{uid}", headers=auth_h(token), timeout=30)
        assert rdel.status_code == 200
        # verify gone from members list
        rmem = session.get(f"{API}/admin/members", headers=auth_h(token), timeout=30)
        ids = [m["id"] for m in rmem.json()["members"]]
        assert uid not in ids
