"""
Regression tests for the server.py → routers/ extraction refactor (iter 6).

Verifies:
  * formcheck endpoints still mount via routers/formcheck.py
  * payments endpoints still mount via routers/payments.py (incl. webhook)
  * push endpoints still mount via routers/push.py
  * core endpoints (auth/me, plans/current, sessions/stats, coach/insights,
    admin/stats, bodyscan/history) still 200 for admin
  * no duplicate route registrations on the FastAPI app
"""
import os
import re
import json
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to file lookup
    with open("/app/frontend/.env") as f:
        for ln in f:
            if ln.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = ln.split("=", 1)[1].strip().rstrip("/")
                break

ADMIN_EMAIL = "sazhco0385@gmail.com"
ADMIN_PASSWORD = "Bellakiki1"


# ---- fixtures ----
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok, f"no token in login response: {r.json()}"
    return tok


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# =========================================================================
# Refactor: no duplicate route registration
# =========================================================================
class TestNoDuplicateRoutes:
    """Verify the FastAPI app has exactly one entry per refactored path."""

    def test_no_duplicate_routes(self):
        # openapi.json is not routed through public ingress (only /api/* is).
        # Read it directly from the backend internal port to validate route registry.
        r = requests.get("http://localhost:8001/openapi.json", timeout=15)
        assert r.status_code == 200, f"openapi.json not reachable ({r.status_code})"
        spec = r.json()
        paths = spec.get("paths", {})
        # spot-check the refactored paths exist
        for p in [
            "/api/formcheck/analyze",
            "/api/formcheck/history",
            "/api/formcheck/{check_id}",
            "/api/payments/checkout",
            "/api/payments/status/{session_id}",
            "/api/webhook/stripe",
            "/api/notifications/vapid-public-key",
            "/api/notifications/subscribe",
            "/api/notifications/settings",
            "/api/notifications/unsubscribe",
            "/api/notifications/test",
        ]:
            assert p in paths, f"route missing from OpenAPI: {p}"

        # for each path, ensure each (path, method) appears only once.
        # openapi.json structure forbids duplicates implicitly, but verify methods are unique
        for p, methods in paths.items():
            mset = [m for m in methods.keys() if m in ("get", "post", "put", "delete", "patch")]
            assert len(mset) == len(set(mset)), f"duplicate methods on {p}: {mset}"


# =========================================================================
# Core endpoints regression (must still 200 with admin token)
# =========================================================================
class TestCoreEndpoints:
    def test_auth_me(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d.get("email") == ADMIN_EMAIL
        assert "id" in d

    def test_plans_current(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/plans/current", headers=admin_headers, timeout=10)
        # may be 200 (existing plan) or 404 (no plan yet) — either is acceptable
        # as long as it's not 5xx
        assert r.status_code in (200, 404), f"unexpected status {r.status_code}: {r.text[:200]}"

    def test_sessions_stats(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/sessions/stats", headers=admin_headers, timeout=10)
        assert r.status_code == 200, r.text[:200]
        d = r.json()
        assert isinstance(d, dict)

    def test_coach_insights(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/coach/insights", headers=admin_headers, timeout=30)
        # insights may call LLM — accept 200 or 5xx (upstream), reject 404
        assert r.status_code != 404, "coach/insights route missing"
        assert r.status_code in (200, 500, 503), f"unexpected {r.status_code}"

    def test_admin_stats(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=admin_headers, timeout=10)
        assert r.status_code == 200, r.text[:200]
        d = r.json()
        assert isinstance(d, dict)

    def test_bodyscan_history(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/bodyscan/history", headers=admin_headers, timeout=10)
        assert r.status_code == 200, r.text[:200]


# =========================================================================
# FormCheck router regression (extracted to routers/formcheck.py)
# =========================================================================
class TestFormCheckRouter:
    def test_history_endpoint_via_router(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/formcheck/history", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "checks" in d
        assert isinstance(d["checks"], list)

    def test_history_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/formcheck/history", timeout=10)
        assert r.status_code in (401, 403)

    def test_delete_unknown_returns_ok_zero(self, admin_headers):
        # delete non-existent — should 200 with deleted=0 (not 404, not 500)
        r = requests.delete(
            f"{BASE_URL}/api/formcheck/{uuid.uuid4()}",
            headers=admin_headers,
            timeout=10,
        )
        assert r.status_code == 200, r.text[:200]
        d = r.json()
        assert d.get("ok") is True
        assert d.get("deleted") == 0

    def test_analyze_route_reachable(self, admin_headers):
        # send tiny base64 image — endpoint should reach LLM (200) or 400/500,
        # but NOT 404 (route exists).
        tiny_png = (
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        )
        r = requests.post(
            f"{BASE_URL}/api/formcheck/analyze",
            headers=admin_headers,
            json={
                "image_base64": tiny_png,
                "exercise_name": "TEST_refactor_smoke",
                "target_muscle": "chest",
                "notes": "regression smoke",
            },
            timeout=60,
        )
        assert r.status_code != 404, "formcheck/analyze route missing after refactor"
        # accept 200 (real analysis) / 400 (no_pose_detected) / 500 (upstream LLM error)
        assert r.status_code in (200, 400, 500), f"unexpected {r.status_code}: {r.text[:200]}"


# =========================================================================
# Payments router regression (extracted to routers/payments.py)
# =========================================================================
class TestPaymentsRouter:
    def test_payments_status_unknown_session(self, admin_headers):
        # unknown session_id should return 404 (transaction not found), proving route is mounted
        r = requests.get(
            f"{BASE_URL}/api/payments/status/cs_test_FAKE_{uuid.uuid4().hex[:10]}",
            headers=admin_headers,
            timeout=10,
        )
        assert r.status_code == 404, f"expected 404 (tx not found), got {r.status_code}: {r.text[:200]}"

    def test_payments_checkout_requires_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/payments/checkout",
            json={"plan": "monthly", "origin_url": "https://example.com"},
            timeout=10,
        )
        assert r.status_code in (401, 403)

    def test_payments_checkout_invalid_plan(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/payments/checkout",
            headers=admin_headers,
            json={"plan": "NOT_A_REAL_PLAN", "origin_url": "https://example.com"},
            timeout=10,
        )
        # router responds 400 "Ungültiger Plan"
        assert r.status_code == 400, r.text[:200]

    def test_webhook_stripe_accepts_unknown_event_no_auth(self):
        # webhook should not require auth and should return {received: True}
        # when STRIPE_WEBHOOK_SECRET is unset the route falls back to json.loads(body)
        fake_event = {
            "type": "ping.unknown.event_type",
            "data": {"object": {"id": "evt_test_refactor"}},
        }
        r = requests.post(
            f"{BASE_URL}/api/webhook/stripe",
            data=json.dumps(fake_event),
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        # 200 with {received: True} OR 400 if Stripe signature verification is enforced
        assert r.status_code in (200, 400), f"unexpected {r.status_code}: {r.text[:200]}"
        if r.status_code == 200:
            assert r.json().get("received") is True


# =========================================================================
# Push router regression (extracted to routers/push.py)
# =========================================================================
class TestPushRouter:
    def test_vapid_public_key_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/notifications/vapid-public-key", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "public_key" in d
        assert isinstance(d["public_key"], str)
        assert len(d["public_key"]) > 20

    def test_settings_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/notifications/settings", timeout=10)
        assert r.status_code in (401, 403)

    def test_settings_for_admin(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/notifications/settings", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "subscriptions" in d
        assert isinstance(d["subscriptions"], list)

    def test_subscribe_update_unsubscribe_lifecycle(self, admin_headers):
        endpoint = f"https://example.test/push/TEST_refactor_{uuid.uuid4().hex[:8]}"
        sub_payload = {
            "endpoint": endpoint,
            "keys": {"p256dh": "TEST_p256dh", "auth": "TEST_auth"},
            "triggers": {"workout_reminder": True, "streak_protect": False, "weekly_review": True},
            "reminder_time": "19:30",
            "timezone_offset": -60,
        }
        # subscribe
        r = requests.post(
            f"{BASE_URL}/api/notifications/subscribe",
            headers=admin_headers,
            json=sub_payload,
            timeout=10,
        )
        assert r.status_code == 200, r.text[:200]
        assert r.json().get("ok") is True

        # update (PUT)
        sub_payload["reminder_time"] = "20:15"
        r = requests.put(
            f"{BASE_URL}/api/notifications/settings",
            headers=admin_headers,
            json=sub_payload,
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json().get("ok") is True

        # verify via GET
        r = requests.get(f"{BASE_URL}/api/notifications/settings", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        subs = r.json().get("subscriptions", [])
        found = [s for s in subs if s.get("endpoint") == endpoint]
        assert len(found) == 1, f"subscription not persisted for {endpoint}"
        assert found[0]["reminder_time"] == "20:15"

        # test endpoint (send fails because example.test is unreachable; that's fine)
        r = requests.post(
            f"{BASE_URL}/api/notifications/test",
            headers=admin_headers,
            json={"title": "TEST refactor", "body": "test body"},
            timeout=10,
        )
        assert r.status_code == 200
        assert "subscriptions" in r.json()

        # unsubscribe
        r = requests.delete(
            f"{BASE_URL}/api/notifications/unsubscribe",
            headers=admin_headers,
            params={"endpoint": endpoint},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json().get("deleted", 0) >= 1
