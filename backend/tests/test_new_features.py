"""Tests for new alpha-fit features: nutrition (with GPT-5.2 Vision), support,
online tracking via heartbeat, activity feed, progression suggestion, stats,
and badge logic."""
import os
import uuid
import base64
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "sazhco0385@gmail.com"
ADMIN_PASSWORD = "Bellakiki1"


def auth_h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Shared fixtures ----------

@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(session):
    r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["is_admin"] is True
    return data["token"], data["user"]


@pytest.fixture(scope="module")
def user_creds():
    return {
        "email": f"TEST_new_{uuid.uuid4().hex[:8]}@example.com",
        "password": "TestPass123!",
        "name": "TEST New Features",
    }


@pytest.fixture(scope="module")
def user_token(session, user_creds):
    r = session.post(f"{API}/auth/register", json=user_creds, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"], r.json()["user"]


@pytest.fixture(scope="module")
def onboarded_user(session, user_token):
    token, _user = user_token
    payload = {
        "goal": "muscle_gain",
        "experience": "intermediate",
        "gender": "male",
        "age": 30,
        "height_cm": 180,
        "weight_kg": 80,
        "days_per_week": 3,
        "equipment": "gym",
        "injuries": "",
    }
    r = session.post(f"{API}/onboarding", headers=auth_h(token), json=payload, timeout=90)
    assert r.status_code == 200, r.text
    # Refresh user
    me = session.get(f"{API}/auth/me", headers=auth_h(token), timeout=20).json()
    assert me.get("current_plan_id"), "plan not generated"
    return token, me


# ---------- Heartbeat / Online ----------

def test_heartbeat_updates_last_active(session, user_token):
    token, _ = user_token
    r = session.post(f"{API}/auth/heartbeat", headers=auth_h(token), timeout=15)
    assert r.status_code == 200
    assert r.json().get("ok") is True


def test_admin_online_contains_recent_user(session, admin_token, user_token):
    a_token, _ = admin_token
    u_token, u = user_token
    # ensure user pinged
    session.post(f"{API}/auth/heartbeat", headers=auth_h(u_token), timeout=15)
    r = session.get(f"{API}/admin/online", headers=auth_h(a_token), timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert "online" in data and "count" in data
    ids = [o["id"] for o in data["online"]]
    assert u["id"] in ids, f"user {u['id']} not in online list"


def test_non_admin_cannot_access_admin_online(session, user_token):
    token, _ = user_token
    r = session.get(f"{API}/admin/online", headers=auth_h(token), timeout=15)
    assert r.status_code == 403


# ---------- Activity Feed ----------

def test_admin_activity_feed_has_register_event(session, admin_token, user_token):
    a_token, _ = admin_token
    _, u = user_token
    r = session.get(f"{API}/admin/activity?limit=200", headers=auth_h(a_token), timeout=20)
    assert r.status_code == 200
    events = r.json().get("events", [])
    actions_for_user = [e["action"] for e in events if e.get("user_id") == u["id"]]
    assert "registered" in actions_for_user, f"register event missing for user; got {actions_for_user}"


def test_admin_activity_contains_onboarding_and_workout(session, admin_token, onboarded_user):
    a_token, _ = admin_token
    token, u = onboarded_user
    # start + complete a workout for activity events
    sr = session.post(f"{API}/sessions/start", headers=auth_h(token), json={"day_index": 1}, timeout=20)
    assert sr.status_code == 200, sr.text
    sid = sr.json()["session"]["id"]
    # log a set so volume > 0
    session.post(f"{API}/sessions/log-set", headers=auth_h(token),
                 json={"session_id": sid, "exercise_index": 0, "set_index": 0, "reps": 10, "weight_kg": 60}, timeout=15)
    cr = session.post(f"{API}/sessions/complete", headers=auth_h(token),
                      json={"session_id": sid}, timeout=30)
    assert cr.status_code == 200, cr.text

    r = session.get(f"{API}/admin/activity?limit=200", headers=auth_h(a_token), timeout=20)
    actions = [e["action"] for e in r.json().get("events", []) if e.get("user_id") == u["id"]]
    assert "onboarding_completed" in actions
    assert "workout_started" in actions
    assert "workout_completed" in actions


# ---------- Workout Stats + Progression Suggestion + Badges ----------

def test_sessions_stats_returns_keys(session, onboarded_user):
    token, _ = onboarded_user
    r = session.get(f"{API}/sessions/stats", headers=auth_h(token), timeout=15)
    assert r.status_code == 200
    d = r.json()
    for k in ("total_completed", "current_streak", "total_volume_kg"):
        assert k in d
    assert d["total_completed"] >= 1  # we completed one in earlier test
    assert d["total_volume_kg"] > 0


def test_progression_suggestion_after_one_session(session, onboarded_user):
    token, _ = onboarded_user
    r = session.get(f"{API}/sessions/suggestion/1/0", headers=auth_h(token), timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d.get("has_history") is True
    assert "suggested_weight" in d and "suggested_reps" in d
    assert "delta_weight" in d


def test_progression_suggestion_no_history_for_other_day(session, onboarded_user):
    token, _ = onboarded_user
    r = session.get(f"{API}/sessions/suggestion/2/0", headers=auth_h(token), timeout=15)
    assert r.status_code == 200
    d = r.json()
    # Day 2 has no completed session yet
    assert d.get("has_history") is False
    assert "suggested_weight" in d


def test_first_workout_badge_awarded(session, onboarded_user):
    token, _ = onboarded_user
    r = session.get(f"{API}/auth/me", headers=auth_h(token), timeout=15)
    assert r.status_code == 200
    badges = r.json().get("badges", [])
    badge_ids = [b["id"] for b in badges]
    assert "first_workout" in badge_ids, f"first_workout badge missing; got {badge_ids}"


# ---------- Support Tickets ----------

@pytest.fixture(scope="module")
def created_ticket(session, user_token):
    token, _ = user_token
    payload = {"subject": "TEST_subj", "message": "TEST support message", "category": "billing"}
    r = session.post(f"{API}/support/ticket", headers=auth_h(token), json=payload, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("ok") is True
    assert d.get("support_email") == "support@alpha-fit.fitness"
    assert "ticket_id" in d
    return d["ticket_id"]


def test_support_my_tickets(session, user_token, created_ticket):
    token, _ = user_token
    r = session.get(f"{API}/support/my-tickets", headers=auth_h(token), timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d.get("support_email") == "support@alpha-fit.fitness"
    ids = [t["id"] for t in d.get("tickets", [])]
    assert created_ticket in ids


def test_admin_tickets_list(session, admin_token, created_ticket):
    a_token, _ = admin_token
    r = session.get(f"{API}/admin/tickets", headers=auth_h(a_token), timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert "open_count" in d and d["open_count"] >= 1
    ids = [t["id"] for t in d.get("tickets", [])]
    assert created_ticket in ids


def test_admin_respond_ticket(session, admin_token, created_ticket):
    a_token, _ = admin_token
    r = session.post(f"{API}/admin/tickets/{created_ticket}/respond",
                     headers=auth_h(a_token), json={"reply": "TEST reply"}, timeout=15)
    assert r.status_code == 200
    # Verify status changed
    list_r = session.get(f"{API}/admin/tickets", headers=auth_h(a_token), timeout=15)
    t = next((t for t in list_r.json()["tickets"] if t["id"] == created_ticket), None)
    assert t is not None
    assert t["status"] == "resolved"
    assert t["admin_reply"] == "TEST reply"


def test_admin_delete_ticket(session, admin_token, created_ticket):
    a_token, _ = admin_token
    r = session.delete(f"{API}/admin/tickets/{created_ticket}", headers=auth_h(a_token), timeout=15)
    assert r.status_code == 200
    # Verify gone
    list_r = session.get(f"{API}/admin/tickets", headers=auth_h(a_token), timeout=15)
    ids = [t["id"] for t in list_r.json().get("tickets", [])]
    assert created_ticket not in ids


def test_non_admin_cannot_access_tickets_list(session, user_token):
    token, _ = user_token
    r = session.get(f"{API}/admin/tickets", headers=auth_h(token), timeout=15)
    assert r.status_code == 403


# ---------- Nutrition ----------

def test_nutrition_today_empty_returns_goals(session, user_token):
    token, _ = user_token
    r = session.get(f"{API}/nutrition/today", headers=auth_h(token), timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert "entries" in d and "totals" in d and "goals" in d
    assert "calories" in d["goals"] and d["goals"]["calories"] > 0
    assert "protein_g" in d["goals"]


@pytest.fixture(scope="module")
def manual_entry(session, user_token):
    token, _ = user_token
    payload = {
        "food_name": "TEST_Chicken Rice",
        "portion_grams": 300,
        "calories": 500,
        "protein_g": 40,
        "carbs_g": 55,
        "fat_g": 12,
        "fiber_g": 3,
        "sugar_g": 2,
        "sodium_mg": 400,
        "meal_type": "lunch",
        "notes": "TEST entry",
    }
    r = session.post(f"{API}/nutrition/log", headers=auth_h(token), json=payload, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("ok") is True
    e = d.get("entry") or {}
    assert e.get("food_name") == "TEST_Chicken Rice"
    assert e.get("date")  # YYYY-MM-DD
    return e["id"]


def test_nutrition_today_after_log(session, user_token, manual_entry):
    token, _ = user_token
    r = session.get(f"{API}/nutrition/today", headers=auth_h(token), timeout=15)
    assert r.status_code == 200
    d = r.json()
    ids = [e["id"] for e in d["entries"]]
    assert manual_entry in ids
    # totals should reflect the manual entry
    assert d["totals"]["calories"] >= 500
    assert d["totals"]["protein_g"] >= 40


def test_nutrition_history(session, user_token, manual_entry):
    token, _ = user_token
    r = session.get(f"{API}/nutrition/history?days=7", headers=auth_h(token), timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert "daily" in d
    # Should have at least today's aggregation
    assert len(d["daily"]) >= 1
    today_row = d["daily"][0]
    assert "calories" in today_row and today_row["calories"] >= 500


def test_nutrition_delete(session, user_token, manual_entry):
    token, _ = user_token
    r = session.delete(f"{API}/nutrition/log/{manual_entry}", headers=auth_h(token), timeout=15)
    assert r.status_code == 200
    assert r.json().get("deleted") == 1


def _fetch_food_image_b64():
    """Try to fetch a small food image; fall back to a simple PIL-generated test image."""
    urls = [
        # Small Unsplash food crop
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=60",
        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=60",
    ]
    for url in urls:
        try:
            r = requests.get(url, timeout=15)
            if r.status_code == 200 and len(r.content) > 1000:
                return base64.b64encode(r.content).decode()
        except Exception:
            continue
    # Fallback: tiny generated image
    try:
        from PIL import Image
        import io
        img = Image.new("RGB", (64, 64), color=(220, 180, 90))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        return base64.b64encode(buf.getvalue()).decode()
    except Exception:
        return None


def test_nutrition_analyze_vision(session, user_token):
    """Vision-Analyse mit echtem (oder fallback) Food-Bild. ~10s erwartet."""
    token, _ = user_token
    img_b64 = _fetch_food_image_b64()
    if not img_b64:
        pytest.skip("Could not obtain test image")
    payload = {"image_base64": img_b64, "meal_type": "lunch"}
    r = session.post(f"{API}/nutrition/analyze", headers=auth_h(token), json=payload, timeout=90)
    assert r.status_code == 200, f"vision analyze failed: {r.status_code} {r.text[:500]}"
    d = r.json()
    # Strict schema check
    for k in ("food_name", "portion_grams", "calories", "protein_g", "carbs_g",
              "fat_g", "fiber_g", "sugar_g", "sodium_mg", "confidence", "components"):
        assert k in d, f"missing key {k} in vision response"
    assert isinstance(d["food_name"], str) and len(d["food_name"]) > 0
    assert isinstance(d["calories"], (int, float)) and d["calories"] >= 0
    assert isinstance(d["components"], list)


# ---------- AI Coach Chat (quick smoke) ----------

def test_coach_chat_smoke(session, user_token):
    token, _ = user_token
    r = session.post(f"{API}/coach/chat", headers=auth_h(token),
                     json={"text": "Sag kurz Hi"}, timeout=60)
    assert r.status_code == 200, r.text
    assert isinstance(r.json().get("reply", ""), str)
    assert len(r.json()["reply"]) > 0


# ---------- Stripe checkout smoke (LIVE) ----------

def test_stripe_checkout_session_creates(session, user_token):
    token, _ = user_token
    payload = {"plan": "monthly", "origin_url": BASE_URL}
    r = session.post(f"{API}/payments/checkout", headers=auth_h(token), json=payload, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"Stripe live checkout could not create session: {r.status_code} {r.text[:200]}")
    d = r.json()
    assert "session_id" in d and d["session_id"].startswith("cs_")
    assert "url" in d and d["url"].startswith("https://")


# ---------- Admin Stats includes new fields ----------

def test_admin_stats_has_online_and_revenue(session, admin_token):
    a_token, _ = admin_token
    r = session.get(f"{API}/admin/stats", headers=auth_h(a_token), timeout=15)
    assert r.status_code == 200
    d = r.json()
    for k in ("total_users", "premium_users", "online_users",
              "revenue_today", "revenue_month", "revenue_total"):
        assert k in d
    assert d["total_users"] >= 1


# ---------- Cleanup ----------

def test_cleanup_delete_test_user(session, admin_token, user_token):
    a_token, _ = admin_token
    _, u = user_token
    r = session.delete(f"{API}/admin/members/{u['id']}", headers=auth_h(a_token), timeout=15)
    assert r.status_code == 200
