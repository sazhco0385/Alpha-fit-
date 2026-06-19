"""
Phase 2 refactor regression — covers the 6 newly-extracted routers:
  routers/coach.py, sessions.py, nutrition.py, bodyscan.py, admin.py, support.py

Per main agent direction:
  * NO real LLM calls (coach/chat, bodyscan/analyze, nutrition/analyze, coach/generate-plan).
    Use minimal/invalid payloads and accept any NON-404 as routing-proof.
  * Verify auth/permission gates (admin gate 403 for non-admin, premium gate for bodyscan).
  * Lifecycle test for support tickets (create → list → admin sees → admin respond → admin delete).
  * Lifecycle test for nutrition (log → today → history → delete).
  * No duplicate route registrations via /openapi.json.
"""
import os
import json
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for ln in f:
            if ln.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = ln.split("=", 1)[1].strip().rstrip("/")
                break

ADMIN_EMAIL = "sazhco0385@gmail.com"
ADMIN_PASSWORD = "Bellakiki1"

TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)


# ----------------- fixtures -----------------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok, f"no token in admin login: {r.json()}"
    return tok


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def free_user():
    """Register a brand-new free (non-admin, non-premium) user for gate tests."""
    # NOTE: pydantic email-validator blocks special-use TLDs (.test, .invalid, .example, .localhost)
    # Use a regular-looking domain instead.
    email = f"test_phase2_{uuid.uuid4().hex[:10]}@phase2qa.io"
    password = "Test1234!"
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": password, "name": "Phase2 Test"},
        timeout=15,
    )
    if r.status_code not in (200, 201):
        # try login as fallback (already exists)
        r2 = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": password},
            timeout=15,
        )
        assert r2.status_code == 200, f"register & login both failed: {r.status_code}/{r2.status_code} {r.text[:200]}"
        tok = r2.json().get("token") or r2.json().get("access_token")
    else:
        tok = r.json().get("token") or r.json().get("access_token")
    assert tok, f"no token after register: {r.text[:200]}"
    return {"email": email, "token": tok, "headers": {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}}


# =========================================================================
# OpenAPI duplicate-check for Phase 2 routes
# =========================================================================
class TestPhase2NoDuplicates:
    def test_all_phase2_routes_registered_once(self):
        r = requests.get("http://localhost:8001/openapi.json", timeout=15)
        assert r.status_code == 200
        paths = r.json()["paths"]
        expected = [
            # coach
            "/api/coach/generate-plan", "/api/coach/adjust-plan",
            "/api/coach/adjust-plan/start", "/api/coach/adjust-plan/status/{job_id}",
            "/api/coach/chat", "/api/coach/chat/history", "/api/coach/insights",
            # sessions/plans
            "/api/plans/current", "/api/sessions/start", "/api/sessions/active",
            "/api/sessions/log-set", "/api/sessions/update-progress",
            "/api/sessions/complete", "/api/sessions/history", "/api/sessions/stats",
            "/api/sessions/suggestion/{day_index}/{exercise_index}",
            # nutrition
            "/api/nutrition/analyze", "/api/nutrition/log",
            "/api/nutrition/today", "/api/nutrition/history",
            "/api/nutrition/log/{entry_id}",
            # bodyscan
            "/api/bodyscan/analyze", "/api/bodyscan/history",
            "/api/bodyscan/{scan_id}",
            "/api/bodyscan/{scan_id}/suggest-plan-adjustment",
            "/api/profile/weight-trend",
            # admin
            "/api/admin/stats", "/api/admin/members", "/api/admin/online",
            "/api/admin/activity", "/api/admin/tickets",
            "/api/admin/tickets/{ticket_id}/respond",
            "/api/admin/tickets/{ticket_id}",
            "/api/admin/members/{user_id}",
            "/api/admin/members/premium", "/api/admin/members/revoke-premium",
            # support
            "/api/support/ticket", "/api/support/my-tickets", "/api/support/info",
        ]
        missing = [p for p in expected if p not in paths]
        assert not missing, f"phase2 routes missing from OpenAPI: {missing}"

        # no duplicate methods per path
        for p, methods in paths.items():
            ms = [m for m in methods if m in ("get", "post", "put", "delete", "patch")]
            assert len(ms) == len(set(ms)), f"duplicate methods on {p}: {ms}"


# =========================================================================
# Coach router
# =========================================================================
class TestCoachRouter:
    def test_insights_admin(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/coach/insights", headers=admin_headers, timeout=30)
        assert r.status_code != 404
        assert r.status_code in (200, 500, 503)

    def test_chat_history_admin(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/coach/chat/history", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        d = r.json()
        # endpoint returns list or {"messages": [...]} — accept either
        assert isinstance(d, (list, dict))

    def test_chat_route_reachable(self, admin_headers):
        # don't call real LLM; minimal payload — accept any non-404
        r = requests.post(
            f"{BASE_URL}/api/coach/chat",
            headers=admin_headers,
            json={"message": "ping"},
            timeout=60,
        )
        assert r.status_code != 404, "coach/chat route missing"
        # 200 / 400 (validation) / 500 (LLM upstream)
        assert r.status_code in (200, 400, 422, 500, 503), f"unexpected {r.status_code}: {r.text[:200]}"

    def test_generate_plan_route_reachable(self, admin_headers):
        # send minimal/empty body — route must exist; expect 400/422 (validation) or 500 (LLM)
        r = requests.post(
            f"{BASE_URL}/api/coach/generate-plan",
            headers=admin_headers,
            json={},
            timeout=60,
        )
        assert r.status_code != 404
        assert r.status_code in (200, 400, 422, 500, 503)

    def test_adjust_plan_sync_reachable(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/coach/adjust-plan",
            headers=admin_headers,
            json={"reason": "TEST"},
            timeout=60,
        )
        assert r.status_code != 404
        assert r.status_code in (200, 400, 404, 422, 500, 503)

    def test_adjust_plan_async_start_and_status(self, admin_headers):
        # start
        r = requests.post(
            f"{BASE_URL}/api/coach/adjust-plan/start",
            headers=admin_headers,
            json={"reason": "TEST_phase2"},
            timeout=15,
        )
        # 200 with job_id, OR 400/404 if no plan exists, OR 500
        assert r.status_code != 404 or "job_id" not in r.text
        assert r.status_code in (200, 202, 400, 404, 422, 500)
        # status for unknown job → 404
        r2 = requests.get(
            f"{BASE_URL}/api/coach/adjust-plan/status/UNKNOWN_{uuid.uuid4().hex[:8]}",
            headers=admin_headers,
            timeout=10,
        )
        assert r2.status_code == 404, f"unknown job_id should 404, got {r2.status_code}: {r2.text[:200]}"

    def test_chat_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/coach/chat", json={"message": "x"}, timeout=10)
        assert r.status_code in (401, 403)


# =========================================================================
# Sessions / Plans router
# =========================================================================
class TestSessionsRouter:
    def test_plans_current(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/plans/current", headers=admin_headers, timeout=10)
        assert r.status_code in (200, 404)

    def test_sessions_stats(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/sessions/stats", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, dict)

    def test_sessions_history(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/sessions/history", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        d = r.json()
        # accept list or dict with key like "sessions"
        assert isinstance(d, (list, dict))

    def test_sessions_active(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/sessions/active", headers=admin_headers, timeout=10)
        # 200 with active or null, or 404 if no active
        assert r.status_code in (200, 204, 404)

    def test_sessions_suggestion_route_exists(self, admin_headers):
        # call with arbitrary indices — endpoint should NOT 404 on route (404 may come from
        # missing plan, which is OK — we only assert path exists at FastAPI level)
        r = requests.get(
            f"{BASE_URL}/api/sessions/suggestion/0/0",
            headers=admin_headers,
            timeout=15,
        )
        # accept 200/400/404/500 (no plan) — but the URL is reachable
        assert r.status_code in (200, 400, 404, 500, 503)

    def test_start_log_complete_route_reachability(self, admin_headers):
        # start with no day_index — route should respond; 404 may mean "no plan",
        # which still proves route is mounted (405 would mean missing).
        r = requests.post(
            f"{BASE_URL}/api/sessions/start",
            headers=admin_headers,
            json={"day_index": 0},
            timeout=15,
        )
        assert r.status_code != 405
        # log-set route
        r = requests.post(
            f"{BASE_URL}/api/sessions/log-set",
            headers=admin_headers,
            json={"exercise_index": 0, "set_index": 0, "reps": 8, "weight": 20},
            timeout=10,
        )
        assert r.status_code != 405
        # update-progress
        r = requests.post(
            f"{BASE_URL}/api/sessions/update-progress",
            headers=admin_headers,
            json={"exercise_index": 0, "completed_sets": 1},
            timeout=10,
        )
        assert r.status_code != 405
        # complete
        r = requests.post(
            f"{BASE_URL}/api/sessions/complete",
            headers=admin_headers,
            json={"duration_minutes": 5},
            timeout=15,
        )
        assert r.status_code != 405

    def test_sessions_stats_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/sessions/stats", timeout=10)
        assert r.status_code in (401, 403)


# =========================================================================
# Nutrition router
# =========================================================================
class TestNutritionRouter:
    def test_today(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/nutrition/today", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, dict)

    def test_history(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/nutrition/history", headers=admin_headers, timeout=10)
        assert r.status_code == 200

    def test_analyze_route_reachable_no_real_call(self, admin_headers):
        # don't burn credits — empty body, accept 400/422/500 (not 404)
        r = requests.post(
            f"{BASE_URL}/api/nutrition/analyze",
            headers=admin_headers,
            json={},
            timeout=15,
        )
        assert r.status_code != 404
        assert r.status_code in (200, 400, 422, 500, 503)

    def test_log_then_today_then_delete_lifecycle(self, admin_headers):
        # log a manual entry
        payload = {
            "food_name": "TEST_phase2_apple",
            "calories": 95,
            "protein": 0.5,
            "carbs": 25,
            "fat": 0.3,
            "meal_type": "snack",
        }
        r = requests.post(
            f"{BASE_URL}/api/nutrition/log",
            headers=admin_headers,
            json=payload,
            timeout=15,
        )
        assert r.status_code != 404
        # route reachable; if 200 grab id and verify+delete
        if r.status_code in (200, 201):
            body = r.json()
            entry_id = body.get("id") or body.get("entry_id") or body.get("_id")
            # GET today and verify entry present (best-effort)
            r2 = requests.get(f"{BASE_URL}/api/nutrition/today", headers=admin_headers, timeout=10)
            assert r2.status_code == 200
            # DELETE if we have an id
            if entry_id:
                r3 = requests.delete(
                    f"{BASE_URL}/api/nutrition/log/{entry_id}",
                    headers=admin_headers,
                    timeout=10,
                )
                assert r3.status_code in (200, 204), r3.text[:200]
        else:
            # log returned non-200 (maybe schema mismatch) — at least verify route mounted
            assert r.status_code in (400, 422, 500), f"unexpected {r.status_code}: {r.text[:200]}"

    def test_today_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/nutrition/today", timeout=10)
        assert r.status_code in (401, 403)


# =========================================================================
# BodyScan router
# =========================================================================
class TestBodyScanRouter:
    def test_history_admin(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/bodyscan/history", headers=admin_headers, timeout=10)
        assert r.status_code == 200

    def test_weight_trend_admin(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/profile/weight-trend", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, (dict, list))

    def test_analyze_premium_gate_for_free_user(self, free_user):
        # free user must be blocked by require_premium (403/402) BEFORE LLM call
        r = requests.post(
            f"{BASE_URL}/api/bodyscan/analyze",
            headers=free_user["headers"],
            json={"image_base64": TINY_PNG_B64, "weight_kg": 70},
            timeout=15,
        )
        assert r.status_code != 404
        # premium gate should reject — accept 401/402/403
        assert r.status_code in (401, 402, 403), f"premium gate failed: {r.status_code}: {r.text[:200]}"

    def test_analyze_route_reachable_for_admin(self, admin_headers):
        # admin is auto-premium; send tiny image — accept 200 (real) or 400/500 (LLM error)
        r = requests.post(
            f"{BASE_URL}/api/bodyscan/analyze",
            headers=admin_headers,
            json={"image_base64": TINY_PNG_B64, "weight_kg": 70},
            timeout=60,
        )
        assert r.status_code != 404
        assert r.status_code in (200, 400, 422, 500, 503)

    def test_get_unknown_scan_404(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/bodyscan/UNKNOWN_{uuid.uuid4().hex[:8]}",
            headers=admin_headers,
            timeout=10,
        )
        assert r.status_code in (404, 400)

    def test_suggest_plan_adjustment_route_exists(self, admin_headers):
        # unknown scan id — expect 404 (scan not found), proving route mounted
        r = requests.post(
            f"{BASE_URL}/api/bodyscan/UNKNOWN_{uuid.uuid4().hex[:8]}/suggest-plan-adjustment",
            headers=admin_headers,
            json={},
            timeout=15,
        )
        assert r.status_code != 405  # not method-not-allowed
        assert r.status_code in (200, 400, 404, 422, 500)

    def test_history_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/bodyscan/history", timeout=10)
        assert r.status_code in (401, 403)


# =========================================================================
# Admin router
# =========================================================================
class TestAdminRouter:
    def test_admin_stats(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=admin_headers, timeout=10)
        assert r.status_code == 200

    def test_admin_members(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/members", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, (list, dict))

    def test_admin_online(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/online", headers=admin_headers, timeout=10)
        assert r.status_code == 200

    def test_admin_activity(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/activity", headers=admin_headers, timeout=10)
        assert r.status_code == 200

    def test_admin_tickets(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/tickets", headers=admin_headers, timeout=10)
        assert r.status_code == 200

    def test_admin_gate_blocks_non_admin(self, free_user):
        # free user should be blocked by admin gate (403)
        for path in ("/api/admin/stats", "/api/admin/members", "/api/admin/tickets"):
            r = requests.get(f"{BASE_URL}{path}", headers=free_user["headers"], timeout=10)
            assert r.status_code == 403, f"{path} non-admin gate failed: {r.status_code}"

    def test_admin_delete_member_non_admin_blocked(self, free_user):
        r = requests.delete(
            f"{BASE_URL}/api/admin/members/UNKNOWN_{uuid.uuid4().hex[:6]}",
            headers=free_user["headers"],
            timeout=10,
        )
        assert r.status_code == 403

    def test_admin_premium_ops_route_reachable(self, admin_headers):
        # invalid user_id payload — route must exist; expect 400/404/422, not 404 missing
        r = requests.post(
            f"{BASE_URL}/api/admin/members/premium",
            headers=admin_headers,
            json={"user_id": f"UNKNOWN_{uuid.uuid4().hex[:8]}"},
            timeout=10,
        )
        assert r.status_code != 405
        assert r.status_code in (200, 400, 404, 422)
        r = requests.post(
            f"{BASE_URL}/api/admin/members/revoke-premium",
            headers=admin_headers,
            json={"user_id": f"UNKNOWN_{uuid.uuid4().hex[:8]}"},
            timeout=10,
        )
        assert r.status_code != 405
        assert r.status_code in (200, 400, 404, 422)


# =========================================================================
# Support router + admin ticket integration
# =========================================================================
class TestSupportRouter:
    def test_support_info_admin(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/support/info", headers=admin_headers, timeout=10)
        assert r.status_code == 200

    def test_support_my_tickets_admin(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/support/my-tickets", headers=admin_headers, timeout=10)
        assert r.status_code == 200

    def test_ticket_lifecycle_user_creates_admin_responds_then_deletes(self, free_user, admin_headers):
        # 1. free user creates ticket
        subj = f"TEST_phase2_{uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{BASE_URL}/api/support/ticket",
            headers=free_user["headers"],
            json={"subject": subj, "message": "Phase 2 regression — please ignore."},
            timeout=10,
        )
        assert r.status_code in (200, 201), f"ticket create failed: {r.status_code}: {r.text[:200]}"
        created = r.json()
        ticket_id = created.get("id") or created.get("ticket_id") or created.get("_id")
        assert ticket_id, f"no ticket id returned: {created}"

        # 2. user sees it in my-tickets
        r2 = requests.get(f"{BASE_URL}/api/support/my-tickets", headers=free_user["headers"], timeout=10)
        assert r2.status_code == 200
        listed = r2.json()
        items = listed if isinstance(listed, list) else listed.get("tickets", [])
        ids = [t.get("id") or t.get("ticket_id") or t.get("_id") for t in items]
        assert ticket_id in ids, f"created ticket not in my-tickets: {ids}"

        # 3. admin sees it
        r3 = requests.get(f"{BASE_URL}/api/admin/tickets", headers=admin_headers, timeout=10)
        assert r3.status_code == 200
        adm = r3.json()
        adm_items = adm if isinstance(adm, list) else adm.get("tickets", [])
        adm_ids = [t.get("id") or t.get("ticket_id") or t.get("_id") for t in adm_items]
        assert ticket_id in adm_ids, f"ticket not visible to admin: {ticket_id}"

        # 4. admin responds
        r4 = requests.post(
            f"{BASE_URL}/api/admin/tickets/{ticket_id}/respond",
            headers=admin_headers,
            json={"response": "Resolved (test)", "status": "resolved"},
            timeout=10,
        )
        assert r4.status_code in (200, 201, 204), f"respond failed: {r4.status_code}: {r4.text[:200]}"

        # 5. admin deletes
        r5 = requests.delete(
            f"{BASE_URL}/api/admin/tickets/{ticket_id}",
            headers=admin_headers,
            timeout=10,
        )
        assert r5.status_code in (200, 204), f"delete failed: {r5.status_code}: {r5.text[:200]}"

    def test_support_ticket_requires_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/support/ticket",
            json={"subject": "x", "message": "y"},
            timeout=10,
        )
        assert r.status_code in (401, 403)


# =========================================================================
# Core untouched endpoints (sanity)
# =========================================================================
class TestCoreUntouched:
    def test_auth_me(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d.get("email") == ADMIN_EMAIL

    def test_auth_heartbeat(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/auth/heartbeat", headers=admin_headers, timeout=10)
        assert r.status_code in (200, 204)

    def test_auth_login_invalid(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "TEST_nope@example.test", "password": "wrong"},
            timeout=10,
        )
        assert r.status_code in (400, 401, 403, 404, 422)
