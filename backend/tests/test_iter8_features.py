"""Iter 8 backend tests: Custom Plan Editor, Notification Preferences, Win-Back email.
Targets the external preview URL via REACT_APP_BACKEND_URL.
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fitness-ai-premium.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "sazhco0385@gmail.com"
ADMIN_PASSWORD = "Bellakiki1"


# ===== Auth helpers =====
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def fresh_user():
    """Register a fresh user for prefs/exercise-suggestions tests."""
    email = f"TEST_iter8_{uuid.uuid4().hex[:10]}@phase2qa.io"
    password = "Test1234!"
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": password, "name": "Iter8 Tester"},
        timeout=30,
    )
    assert r.status_code in (200, 201), f"Register failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok
    return {"email": email, "password": password, "token": tok}


@pytest.fixture(scope="session")
def fresh_headers(fresh_user):
    return {"Authorization": f"Bearer {fresh_user['token']}", "Content-Type": "application/json"}


# ============================================================
# CUSTOM PLAN EDITOR
# ============================================================
class TestExerciseSuggestions:
    def test_returns_8_muscle_groups(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/plans/exercise-suggestions", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "groups" in data
        groups = data["groups"]
        assert len(groups) == 8, f"Expected 8 groups, got {len(groups)}"
        muscles = {g["muscle"] for g in groups}
        for m in ["Brust", "Rücken", "Schulter", "Beine", "Bizeps", "Trizeps", "Bauch", "Cardio"]:
            assert m in muscles, f"Missing muscle group: {m}"
        for g in groups:
            assert isinstance(g["exercises"], list) and len(g["exercises"]) > 0


class TestPlanEditor:
    """All assume admin has an active plan (auto-premium with plan)."""

    def _get_current(self, headers):
        r = requests.get(f"{BASE_URL}/api/plans/current", headers=headers, timeout=20)
        assert r.status_code == 200
        return r.json().get("plan")

    def test_admin_has_current_plan(self, admin_headers):
        plan = self._get_current(admin_headers)
        assert plan is not None, "Admin must have an active plan for editor tests"
        assert plan.get("days"), "Plan must have days"

    def test_edit_plan_bumps_version_and_source(self, admin_headers):
        old = self._get_current(admin_headers)
        old_version = int(old.get("version", 1))
        payload = {
            "name": "TEST_iter8 Edited Plan",
            "progression_notes": "Test progression notes",
            "days": [
                {
                    "name": "TEST Day 1",
                    "exercises": [
                        {"name": "Bankdrücken", "sets": 3, "reps": 10, "weight_kg": 60, "rest_seconds": 90},
                        {"name": "Kniebeugen", "sets": 4, "reps": 8, "weight_kg": 80, "rest_sec": 120},
                    ],
                }
            ],
        }
        r = requests.put(f"{BASE_URL}/api/plans/current", headers=admin_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        new_plan = r.json().get("plan")
        assert new_plan is not None
        assert new_plan["name"] == "TEST_iter8 Edited Plan"
        assert new_plan["progression_notes"] == "Test progression notes"
        assert new_plan["source"] == "user_edited"
        assert int(new_plan["version"]) == old_version + 1
        assert len(new_plan["days"]) == 1
        ex = new_plan["days"][0]["exercises"]
        assert len(ex) == 2
        assert ex[0]["name"] == "Bankdrücken"
        # Verify legacy rest_sec accepted
        assert ex[1]["rest_seconds"] == 120

        # GET verifies persistence + current_plan_id pointer updated
        fetched = self._get_current(admin_headers)
        assert fetched["id"] == new_plan["id"]
        assert fetched["source"] == "user_edited"

    def test_empty_days_returns_400(self, admin_headers):
        r = requests.put(f"{BASE_URL}/api/plans/current", headers=admin_headers,
                         json={"days": []}, timeout=20)
        assert r.status_code == 400, r.text

    def test_day_with_no_exercises_returns_400(self, admin_headers):
        r = requests.put(f"{BASE_URL}/api/plans/current", headers=admin_headers,
                         json={"days": [{"name": "X", "exercises": []}]}, timeout=20)
        assert r.status_code == 400

    def test_exercise_without_name_returns_400(self, admin_headers):
        r = requests.put(f"{BASE_URL}/api/plans/current", headers=admin_headers,
                         json={"days": [{"name": "X", "exercises": [{"sets": 3}]}]}, timeout=20)
        assert r.status_code == 400

    def test_eight_days_returns_400(self, admin_headers):
        days = [{"name": f"D{i}", "exercises": [{"name": "Ex"}]} for i in range(8)]
        r = requests.put(f"{BASE_URL}/api/plans/current", headers=admin_headers,
                         json={"days": days}, timeout=20)
        assert r.status_code == 400

    def test_sixteen_exercises_returns_400(self, admin_headers):
        exs = [{"name": f"E{i}"} for i in range(16)]
        r = requests.put(f"{BASE_URL}/api/plans/current", headers=admin_headers,
                         json={"days": [{"name": "D1", "exercises": exs}]}, timeout=20)
        assert r.status_code == 400

    def test_auto_clamp_values(self, admin_headers):
        # Send out-of-range values; expect clamped to [1,20] sets, [1,100] reps, [0,1000] weight, [0,600] rest
        payload = {
            "name": "TEST_iter8 Clamp Plan",
            "days": [{"name": "Clamp Day", "exercises": [
                {"name": "ClampEx", "sets": 999, "reps": 9999, "weight_kg": 99999, "rest_seconds": 99999}
            ]}],
        }
        r = requests.put(f"{BASE_URL}/api/plans/current", headers=admin_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        ex = r.json()["plan"]["days"][0]["exercises"][0]
        assert ex["sets"] == 20
        assert ex["reps"] == 100
        assert ex["weight_kg"] == 1000
        assert ex["rest_seconds"] == 600


# ============================================================
# NOTIFICATION PREFERENCES
# ============================================================
class TestNotificationPreferences:
    def test_get_defaults_all_true(self, fresh_headers):
        r = requests.get(f"{BASE_URL}/api/notifications/preferences", headers=fresh_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "email" in data and "push" in data
        for k in ["trial_ending", "streak_reminder", "weekly_summary", "winback"]:
            assert data["email"][k] is True, f"email.{k} should default True, got {data['email'][k]}"
        for k in ["workout_reminder", "streak_protect", "weekly_review"]:
            assert data["push"][k] is True

    def test_put_persists_change(self, fresh_headers):
        payload = {
            "email": {"trial_ending": True, "streak_reminder": True, "weekly_summary": False, "winback": True},
            "push": {"workout_reminder": True, "streak_protect": True, "weekly_review": True},
        }
        r = requests.put(f"{BASE_URL}/api/notifications/preferences", headers=fresh_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        # GET back
        r2 = requests.get(f"{BASE_URL}/api/notifications/preferences", headers=fresh_headers, timeout=20)
        assert r2.status_code == 200
        d = r2.json()
        assert d["email"]["weekly_summary"] is False
        assert d["email"]["trial_ending"] is True

    def test_put_coerces_types_to_bool(self, fresh_headers):
        # Pass truthy/falsy non-bools — endpoint should coerce
        payload = {"email": {"winback": "false_string"}, "push": {}}  # truthy string -> True
        r = requests.put(f"{BASE_URL}/api/notifications/preferences", headers=fresh_headers, json=payload, timeout=20)
        assert r.status_code == 200
        for k, v in r.json()["email"].items():
            assert isinstance(v, bool)


# ============================================================
# WIN-BACK EMAIL
# ============================================================
class TestWinbackEmail:
    def test_emails_test_winback_returns_resend_id(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/emails/test", headers=admin_headers,
                          json={"template": "winback"}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("template") == "winback"
        assert data.get("email_id"), f"Expected Resend email_id, got {data}"

    def test_admin_run_dispatcher_returns_winback_key(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/emails/run-dispatcher", headers=admin_headers, timeout=60)
        assert r.status_code == 200, r.text
        result = r.json().get("result", {})
        assert "winback" in result, f"dispatcher result missing 'winback' key: {result}"
        assert isinstance(result["winback"], int)


# ============================================================
# REGRESSION
# ============================================================
class TestRegression:
    """Ensure previously-working endpoints still respond."""

    def test_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
        assert r.status_code == 200

    def test_plans_current_get(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/plans/current", headers=admin_headers, timeout=20)
        assert r.status_code == 200

    def test_notifications_settings(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/notifications/settings", headers=admin_headers, timeout=20)
        assert r.status_code == 200

    def test_admin_stats(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=admin_headers, timeout=20)
        assert r.status_code == 200

    def test_bodyscan_history(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/bodyscan/history", headers=admin_headers, timeout=20)
        assert r.status_code == 200

    def test_formcheck_history(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/formcheck/history", headers=admin_headers, timeout=20)
        assert r.status_code == 200

    @pytest.mark.parametrize("template", ["welcome", "payment_success", "trial_ending",
                                          "streak_reminder", "weekly_summary"])
    def test_emails_test_all_templates(self, admin_headers, template):
        r = requests.post(f"{BASE_URL}/api/emails/test", headers=admin_headers,
                          json={"template": template}, timeout=30)
        assert r.status_code == 200, f"{template}: {r.text}"
        assert r.json().get("email_id"), f"{template}: no email_id returned"

    def test_sessions_start_admin(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/sessions/start", headers=admin_headers,
                          json={"day_index": 1}, timeout=20)
        # admin has plan → should succeed
        assert r.status_code in (200, 400), r.text
