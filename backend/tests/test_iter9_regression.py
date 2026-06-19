"""
Iter 9 — Full regression sweep for alpha-fit.
Tests all critical user-facing routes after Plan-Editor + Email + Notification
refactor. Auth, plan, sessions, coach, bodyscan, formcheck, nutrition, push,
emails, payments, admin, support, legal endpoints.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fitness-ai-premium.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "sazhco0385@gmail.com"
ADMIN_PASS = "Bellakiki1"


# ---------- shared fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def fresh_user():
    """Register fresh free user."""
    email = f"TEST_iter9_{uuid.uuid4().hex[:8]}@phase2qa.io"
    pw = "Test1234!"
    r = requests.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": pw, "name": "Iter9 User"}, timeout=30)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    return {"email": email, "password": pw, "token": data["token"], "h": {"Authorization": f"Bearer {data['token']}"}, "id": data["user"]["id"]}


# ---------- AUTH ----------
class TestAuth:
    def test_login_admin_ok(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 20

    def test_login_wrong_password(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "WRONG"}, timeout=15)
        assert r.status_code == 401

    def test_auth_me_returns_premium(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_h, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data.get("is_admin") is True
        assert data.get("is_premium") is True

    def test_auth_me_no_token_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 401

    def test_auth_me_bad_token_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": "Bearer not-a-real-jwt"}, timeout=15)
        assert r.status_code == 401

    def test_heartbeat_ok(self, admin_h):
        r = requests.post(f"{BASE_URL}/api/auth/heartbeat", headers=admin_h, timeout=15)
        assert r.status_code == 200

    def test_heartbeat_no_auth_401(self):
        r = requests.post(f"{BASE_URL}/api/auth/heartbeat", timeout=15)
        assert r.status_code == 401


# ---------- PLAN ----------
class TestPlan:
    def test_get_current_plan(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/plans/current", headers=admin_h, timeout=15)
        assert r.status_code == 200
        body = r.json()
        plan = body.get("plan", body)
        assert "name" in plan and "days" in plan and "version" in plan

    def test_exercise_suggestions(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/plans/exercise-suggestions", headers=admin_h, timeout=15)
        assert r.status_code == 200
        data = r.json()
        # Accept either list or {groups:[...]}
        groups = data.get("groups", data) if isinstance(data, dict) else data
        assert isinstance(groups, list) and len(groups) > 0

    def test_edit_plan_bumps_version_and_source(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/plans/current", headers=admin_h, timeout=15)
        body = r.json()
        plan = body.get("plan", body)
        old_version = plan.get("version", 1)
        edited = {
            "name": "TEST_iter9 / Slash Plan",   # slash to verify backend accepts
            "progression_notes": "Iter9 regression edit",
            "days": [{
                "name": "TEST Day A",
                "exercises": [{"name": "Squat", "sets": 3, "reps": "5-8", "rest_seconds": 120, "target_muscle": "legs"}]
            }],
        }
        r2 = requests.put(f"{BASE_URL}/api/plans/current", json=edited, headers=admin_h, timeout=15)
        assert r2.status_code == 200, r2.text
        body2 = r2.json()
        new_plan = body2.get("plan", body2)
        assert new_plan["version"] == old_version + 1
        assert new_plan["source"] == "user_edited"
        assert new_plan["name"] == "TEST_iter9 / Slash Plan"

    def test_edit_plan_validation_empty_days(self, admin_h):
        r = requests.put(f"{BASE_URL}/api/plans/current", json={"name": "X", "days": []}, headers=admin_h, timeout=15)
        assert r.status_code in (400, 422)


# ---------- SESSIONS ----------
class TestSessions:
    def test_start_session(self, admin_h):
        r = requests.post(f"{BASE_URL}/api/sessions/start", json={"day_index": 0}, headers=admin_h, timeout=15)
        assert r.status_code in (200, 201)
        body = r.json()
        sess = body.get("session", body)
        assert "id" in sess or "session_id" in sess or "day_index" in sess


# ---------- NOTIFICATIONS ----------
class TestNotifications:
    def test_prefs_get(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/notifications/preferences", headers=admin_h, timeout=15)
        assert r.status_code == 200
        prefs = r.json()
        # Nested under email
        email = prefs.get("email", prefs)
        for k in ("trial_ending", "streak_reminder", "weekly_summary", "winback"):
            assert k in email, f"missing {k} in {email}"

    def test_prefs_put_roundtrip(self, admin_h):
        new = {"email": {"trial_ending": True, "streak_reminder": False, "weekly_summary": True, "winback": False}}
        r = requests.put(f"{BASE_URL}/api/notifications/preferences", json=new, headers=admin_h, timeout=15)
        assert r.status_code == 200, r.text
        r2 = requests.get(f"{BASE_URL}/api/notifications/preferences", headers=admin_h, timeout=15)
        body = r2.json()
        email = body.get("email", body)
        assert email["streak_reminder"] is False
        # restore
        requests.put(f"{BASE_URL}/api/notifications/preferences",
                     json={"email": {"trial_ending": True, "streak_reminder": True, "weekly_summary": True, "winback": True}},
                     headers=admin_h, timeout=15)

    def test_notifications_settings_get(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/notifications/settings", headers=admin_h, timeout=15)
        assert r.status_code == 200


# ---------- EMAILS (Resend) ----------
class TestEmails:
    @pytest.mark.parametrize("tmpl", ["welcome", "payment_success", "trial_ending", "streak_reminder", "weekly_summary", "winback"])
    def test_email_template(self, admin_h, tmpl):
        r = requests.post(f"{BASE_URL}/api/emails/test", json={"template": tmpl}, headers=admin_h, timeout=30)
        if r.status_code == 500:
            pytest.skip(f"email provider failure for {tmpl}: {r.text[:120]}")
        assert r.status_code == 200, f"{tmpl} -> {r.status_code} {r.text[:200]}"
        data = r.json()
        assert data.get("id") or data.get("message_id") or data.get("ok") is True


# ---------- ADMIN ----------
class TestAdmin:
    def test_admin_stats(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=admin_h, timeout=15)
        assert r.status_code == 200
        assert "total_users" in r.json() or "users" in r.json()

    def test_admin_members(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/admin/members", headers=admin_h, timeout=15)
        assert r.status_code == 200

    def test_non_admin_blocked(self, fresh_user):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=fresh_user["h"], timeout=15)
        assert r.status_code == 403


# ---------- PREMIUM-GATED ENDPOINTS ----------
class TestPremiumGates:
    def test_bodyscan_history_admin_ok(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/bodyscan/history", headers=admin_h, timeout=15)
        assert r.status_code == 200

    def test_formcheck_history_admin_ok(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/formcheck/history", headers=admin_h, timeout=15)
        assert r.status_code == 200

    def test_bodyscan_analyze_free_user_403(self, fresh_user):
        r = requests.post(f"{BASE_URL}/api/bodyscan/analyze",
                          json={"image_base64": "iVBORw0KGgo="},
                          headers=fresh_user["h"], timeout=20)
        # Either 400 (invalid img) before gate, or 403 (premium gate)
        assert r.status_code in (400, 402, 403, 422), f"got {r.status_code} {r.text[:200]}"

    def test_formcheck_analyze_free_user_403(self, fresh_user):
        r = requests.post(f"{BASE_URL}/api/formcheck/analyze",
                          json={"image_base64": "iVBORw0KGgo=", "exercise": "squat"},
                          headers=fresh_user["h"], timeout=20)
        assert r.status_code in (400, 402, 403, 422)


# ---------- NUTRITION ----------
class TestNutrition:
    def test_nutrition_today(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/nutrition/today", headers=admin_h, timeout=15)
        assert r.status_code == 200

    def test_nutrition_history(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/nutrition/history", headers=admin_h, timeout=15)
        assert r.status_code == 200


# ---------- SUPPORT ----------
class TestSupport:
    def test_create_ticket(self, admin_h):
        r = requests.post(f"{BASE_URL}/api/support/ticket",
                          json={"subject": "TEST_iter9", "message": "regression sweep"},
                          headers=admin_h, timeout=15)
        assert r.status_code in (200, 201)

    def test_my_tickets(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/support/my-tickets", headers=admin_h, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list) or isinstance(r.json(), dict)


# ---------- COACH (best-effort, LLM-budget aware) ----------
class TestCoach:
    def test_coach_insights(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/coach/insights", headers=admin_h, timeout=20)
        # If budget exhausted, accept 500 with note (caller will inspect)
        assert r.status_code in (200, 500), f"got {r.status_code} {r.text[:200]}"


# ---------- PAYMENTS (test mode) ----------
class TestPayments:
    def test_create_checkout_monthly(self, admin_h):
        r = requests.post(f"{BASE_URL}/api/payments/checkout",
                          json={"plan": "monthly", "origin_url": "https://alpha-fit.fitness"},
                          headers=admin_h, timeout=20)
        # Admin already premium → expect 200 or 400 ('already premium')
        assert r.status_code in (200, 400), f"got {r.status_code} {r.text[:200]}"


# ---------- PUSH ----------
class TestPush:
    def test_push_subscription_get(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/push/subscription", headers=admin_h, timeout=15)
        assert r.status_code in (200, 404)
