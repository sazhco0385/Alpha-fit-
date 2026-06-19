"""
Iter 10 - Friends Phase B: Challenges backend tests.
Covers: create / list / detail / accept / decline / leave / cancel
        + friend-only invitee validation
        + progress computation
        + lazy-resolve on past end_at (poked via MongoDB)
        + permission checks (non-participant 403, creator can't leave)
"""
import os
import uuid
import asyncio
from datetime import datetime, timezone, timedelta

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "sazhco0385@gmail.com"
ADMIN_PASS = "Bellakiki1"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

assert BASE_URL, "REACT_APP_BACKEND_URL must be set"


# ---------- helpers ----------
def _h(token):
    return {"Authorization": f"Bearer {token}"}


def _register(prefix="phaseB"):
    email = f"TEST_{prefix}_{uuid.uuid4().hex[:8]}@phaseb.io"
    pw = "Test1234!"
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": pw, "name": f"PB {prefix[:4]} {uuid.uuid4().hex[:4]}"},
        timeout=30,
    )
    assert r.status_code in (200, 201), r.text
    data = r.json()
    return {
        "email": email,
        "password": pw,
        "token": data["token"],
        "h": _h(data["token"]),
        "id": data["user"]["id"],
        "name": data["user"].get("name"),
    }


def _make_friends(a, b):
    """A sends request -> B accepts."""
    r1 = requests.post(
        f"{BASE_URL}/api/friends/request",
        json={"to_user_id": b["id"]},
        headers=a["h"],
        timeout=15,
    )
    assert r1.status_code in (200, 201), r1.text
    req_id = r1.json().get("friendship", {}).get("id")
    # Fallback: look up via friends/list incoming_requests
    if not req_id:
        rl = requests.get(f"{BASE_URL}/api/friends/list", headers=b["h"], timeout=15)
        if rl.status_code == 200:
            for item in rl.json().get("incoming_requests", []):
                if item.get("from_user_id") == a["id"]:
                    req_id = item.get("id")
                    break
    assert req_id, f"could not extract friendship request id from {r1.text}"
    r2 = requests.post(
        f"{BASE_URL}/api/friends/accept",
        json={"request_id": req_id},
        headers=b["h"],
        timeout=15,
    )
    assert r2.status_code == 200, r2.text


# ---------- shared fixtures ----------
@pytest.fixture(scope="module")
def admin():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(tok), timeout=15).json()
    return {"token": tok, "h": _h(tok), "id": me["id"], "name": me.get("name"), "email": ADMIN_EMAIL}


@pytest.fixture(scope="module")
def user_b():
    return _register("B")


@pytest.fixture(scope="module")
def user_c():
    """A non-friend test user."""
    return _register("C")


@pytest.fixture(scope="module")
def admin_b_friends(admin, user_b):
    """Make admin and user_b friends (run once for module)."""
    _make_friends(admin, user_b)
    return True


# =====================================================
# 1. CREATE
# =====================================================
class TestCreateChallenge:
    def test_create_solo_active(self, admin):
        payload = {
            "title": "TEST_solo Squats",
            "description": "Solo testing",
            "metric": "workouts",
            "target": 5,
            "days": 7,
            "invitee_ids": [],
        }
        r = requests.post(f"{BASE_URL}/api/challenges", json=payload, headers=admin["h"], timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        c = body["challenge"]
        assert c["title"] == "TEST_solo Squats"
        assert c["metric"] == "workouts"
        assert c["target"] == 5
        assert c["status"] == "active"
        assert c["your_status"] == "participant"
        assert c["is_creator"] is True
        assert c["participants_count"] == 1
        # standings should include creator
        assert len(c["standings"]) == 1
        assert c["standings"][0]["user_id"] == admin["id"]

    def test_create_with_friend_invite(self, admin, user_b, admin_b_friends):
        payload = {
            "title": "TEST_invited 100 Squats",
            "description": "Phase B duo",
            "metric": "workouts",
            "target": 100,
            "days": 5,
            "invitee_ids": [user_b["id"]],
        }
        r = requests.post(f"{BASE_URL}/api/challenges", json=payload, headers=admin["h"], timeout=15)
        assert r.status_code == 200, r.text
        c = r.json()["challenge"]
        assert c["is_creator"] is True
        # invites should contain user_b pending
        assert len(c["invites"]) == 1
        assert c["invites"][0]["user_id"] == user_b["id"]
        assert c["invites"][0]["status"] == "pending"

    def test_create_with_non_friend_400(self, admin, user_c):
        payload = {
            "title": "TEST_nonfriend",
            "metric": "workouts",
            "target": 5,
            "days": 3,
            "invitee_ids": [user_c["id"]],
        }
        r = requests.post(f"{BASE_URL}/api/challenges", json=payload, headers=admin["h"], timeout=15)
        assert r.status_code == 400, r.text
        assert "Freunde" in r.text

    @pytest.mark.parametrize(
        "bad",
        [
            {"title": "X", "metric": "workouts", "target": 5, "days": 3},  # title<2
            {"title": "Valid", "metric": "workouts", "target": 0, "days": 3},  # target=0
            {"title": "Valid", "metric": "workouts", "target": -1, "days": 3},  # negative
            {"title": "Valid", "metric": "workouts", "target": 5, "days": 0},  # days=0
        ],
    )
    def test_create_validation(self, admin, bad):
        r = requests.post(f"{BASE_URL}/api/challenges", json=bad, headers=admin["h"], timeout=15)
        assert r.status_code in (400, 422), f"expected 4xx, got {r.status_code}: {r.text}"


# =====================================================
# 2. LIST
# =====================================================
class TestListChallenges:
    def test_list_active_includes_created(self, admin):
        # create one
        r = requests.post(
            f"{BASE_URL}/api/challenges",
            json={"title": "TEST_list_active", "metric": "workouts", "target": 3, "days": 2},
            headers=admin["h"],
            timeout=15,
        )
        cid = r.json()["challenge"]["id"]

        rl = requests.get(f"{BASE_URL}/api/challenges", headers=admin["h"], timeout=15)
        assert rl.status_code == 200, rl.text
        data = rl.json()
        assert "active" in data and "invited" in data and "completed" in data
        assert "counts" in data
        assert data["counts"]["active"] == len(data["active"])
        ids = [c["id"] for c in data["active"]]
        assert cid in ids

    def test_invitee_sees_in_invited_tab(self, admin, user_b, admin_b_friends):
        r = requests.post(
            f"{BASE_URL}/api/challenges",
            json={
                "title": "TEST_inviteeView",
                "metric": "workouts",
                "target": 4,
                "days": 3,
                "invitee_ids": [user_b["id"]],
            },
            headers=admin["h"],
            timeout=15,
        )
        cid = r.json()["challenge"]["id"]

        rl = requests.get(f"{BASE_URL}/api/challenges", headers=user_b["h"], timeout=15)
        assert rl.status_code == 200
        invited_ids = [c["id"] for c in rl.json()["invited"]]
        assert cid in invited_ids
        # your_status should be 'invited'
        match = [c for c in rl.json()["invited"] if c["id"] == cid][0]
        assert match["your_status"] == "invited"
        assert match["is_creator"] is False


# =====================================================
# 3. DETAIL + permission
# =====================================================
class TestDetail:
    def test_detail_as_creator(self, admin):
        r = requests.post(
            f"{BASE_URL}/api/challenges",
            json={"title": "TEST_detail", "metric": "workouts", "target": 2, "days": 3},
            headers=admin["h"],
            timeout=15,
        )
        cid = r.json()["challenge"]["id"]
        rd = requests.get(f"{BASE_URL}/api/challenges/{cid}", headers=admin["h"], timeout=15)
        assert rd.status_code == 200
        c = rd.json()["challenge"]
        assert c["id"] == cid
        assert c["your_status"] == "participant"
        assert c["is_creator"] is True
        assert isinstance(c["standings"], list)

    def test_detail_non_participant_403(self, admin, user_c):
        r = requests.post(
            f"{BASE_URL}/api/challenges",
            json={"title": "TEST_perm", "metric": "workouts", "target": 2, "days": 3},
            headers=admin["h"],
            timeout=15,
        )
        cid = r.json()["challenge"]["id"]
        # user_c is NOT a participant or invitee
        rd = requests.get(f"{BASE_URL}/api/challenges/{cid}", headers=user_c["h"], timeout=15)
        assert rd.status_code == 403, rd.text


# =====================================================
# 4. ACCEPT / DECLINE / LEAVE / CANCEL
# =====================================================
class TestLifecycle:
    def test_accept_moves_invitee_to_participants(self, admin, user_b, admin_b_friends):
        r = requests.post(
            f"{BASE_URL}/api/challenges",
            json={
                "title": "TEST_accept",
                "metric": "workouts",
                "target": 3,
                "days": 3,
                "invitee_ids": [user_b["id"]],
            },
            headers=admin["h"],
            timeout=15,
        )
        cid = r.json()["challenge"]["id"]

        ra = requests.post(
            f"{BASE_URL}/api/challenges/accept",
            json={"challenge_id": cid},
            headers=user_b["h"],
            timeout=15,
        )
        assert ra.status_code == 200, ra.text

        # detail as user_b: should be participant now and visible in standings
        rd = requests.get(f"{BASE_URL}/api/challenges/{cid}", headers=user_b["h"], timeout=15)
        assert rd.status_code == 200
        c = rd.json()["challenge"]
        assert c["your_status"] == "participant"
        standing_ids = [s["user_id"] for s in c["standings"]]
        assert user_b["id"] in standing_ids
        assert c["participants_count"] == 2

    def test_decline(self, admin, user_b, admin_b_friends):
        r = requests.post(
            f"{BASE_URL}/api/challenges",
            json={
                "title": "TEST_decline",
                "metric": "workouts",
                "target": 3,
                "days": 3,
                "invitee_ids": [user_b["id"]],
            },
            headers=admin["h"],
            timeout=15,
        )
        cid = r.json()["challenge"]["id"]
        rd = requests.post(
            f"{BASE_URL}/api/challenges/decline",
            json={"challenge_id": cid},
            headers=user_b["h"],
            timeout=15,
        )
        assert rd.status_code == 200, rd.text
        assert rd.json().get("ok") is True
        # second decline should 404
        rd2 = requests.post(
            f"{BASE_URL}/api/challenges/decline",
            json={"challenge_id": cid},
            headers=user_b["h"],
            timeout=15,
        )
        assert rd2.status_code == 404

    def test_leave_creator_400(self, admin):
        r = requests.post(
            f"{BASE_URL}/api/challenges",
            json={"title": "TEST_leaveCreator", "metric": "workouts", "target": 3, "days": 3},
            headers=admin["h"],
            timeout=15,
        )
        cid = r.json()["challenge"]["id"]
        rl = requests.post(
            f"{BASE_URL}/api/challenges/leave",
            json={"challenge_id": cid},
            headers=admin["h"],
            timeout=15,
        )
        assert rl.status_code == 400, rl.text

    def test_leave_participant_ok(self, admin, user_b, admin_b_friends):
        r = requests.post(
            f"{BASE_URL}/api/challenges",
            json={
                "title": "TEST_leaveParticipant",
                "metric": "workouts",
                "target": 3,
                "days": 3,
                "invitee_ids": [user_b["id"]],
            },
            headers=admin["h"],
            timeout=15,
        )
        cid = r.json()["challenge"]["id"]
        requests.post(
            f"{BASE_URL}/api/challenges/accept",
            json={"challenge_id": cid},
            headers=user_b["h"],
            timeout=15,
        )
        rl = requests.post(
            f"{BASE_URL}/api/challenges/leave",
            json={"challenge_id": cid},
            headers=user_b["h"],
            timeout=15,
        )
        assert rl.status_code == 200, rl.text

    def test_cancel_only_creator(self, admin, user_b, admin_b_friends):
        r = requests.post(
            f"{BASE_URL}/api/challenges",
            json={
                "title": "TEST_cancel",
                "metric": "workouts",
                "target": 3,
                "days": 3,
                "invitee_ids": [user_b["id"]],
            },
            headers=admin["h"],
            timeout=15,
        )
        cid = r.json()["challenge"]["id"]

        # invitee can't cancel
        rd = requests.delete(f"{BASE_URL}/api/challenges/{cid}", headers=user_b["h"], timeout=15)
        assert rd.status_code == 403, rd.text

        # creator can
        rc = requests.delete(f"{BASE_URL}/api/challenges/{cid}", headers=admin["h"], timeout=15)
        assert rc.status_code == 200, rc.text

        # verify status via direct DB read (since cancelled isn't returned in list)
        # but GET /api/challenges/{id} as creator should still resolve
        rg = requests.get(f"{BASE_URL}/api/challenges/{cid}", headers=admin["h"], timeout=15)
        assert rg.status_code == 200
        assert rg.json()["challenge"]["status"] == "cancelled"


# =====================================================
# 5. PROGRESS COMPUTATION
# =====================================================
@pytest.mark.asyncio
async def test_progress_workouts_metric_counts_completed_sessions(admin):
    """Insert a completed workout_session in the window and verify standings.value increments."""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    try:
        # Create challenge
        r = requests.post(
            f"{BASE_URL}/api/challenges",
            json={"title": "TEST_progress", "metric": "workouts", "target": 10, "days": 5},
            headers=admin["h"],
            timeout=15,
        )
        cid = r.json()["challenge"]["id"]

        # Baseline standings
        rd0 = requests.get(f"{BASE_URL}/api/challenges/{cid}", headers=admin["h"], timeout=15)
        base = rd0.json()["challenge"]["standings"][0]["value"]

        # Insert a completed workout session inside the window
        now = datetime.now(timezone.utc).isoformat()
        await db.workout_sessions.insert_one({
            "id": f"TEST_progress_{uuid.uuid4().hex[:6]}",
            "user_id": admin["id"],
            "status": "completed",
            "completed_at": now,
            "logged_sets": [{"reps": 10, "weight_kg": 50}],
        })

        rd1 = requests.get(f"{BASE_URL}/api/challenges/{cid}", headers=admin["h"], timeout=15)
        new_val = rd1.json()["challenge"]["standings"][0]["value"]
        assert new_val == base + 1, f"expected progress {base+1}, got {new_val}"
    finally:
        client.close()


# =====================================================
# 6. LAZY RESOLVE on past end_at
# =====================================================
@pytest.mark.asyncio
async def test_lazy_resolve_when_end_at_past(admin):
    """Set end_at to a past time and verify GET resolves -> status=completed + winner set."""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    try:
        r = requests.post(
            f"{BASE_URL}/api/challenges",
            json={"title": "TEST_lazyResolve", "metric": "workouts", "target": 1, "days": 5},
            headers=admin["h"],
            timeout=15,
        )
        cid = r.json()["challenge"]["id"]

        # Insert a completed workout_session so admin has progress > 0,
        # with completed_at inside the (about-to-be-pushed-to-past) window.
        past_in_window = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
        await db.workout_sessions.insert_one({
            "id": f"TEST_lazyResolve_{uuid.uuid4().hex[:6]}",
            "user_id": admin["id"],
            "status": "completed",
            "completed_at": past_in_window,
            "logged_sets": [],
        })

        # Poke BOTH start_at and end_at into the past so the window covers the
        # session we just inserted (start=1h ago, end=1min ago).
        past_start = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        past_end = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
        await db.challenges.update_one(
            {"id": cid},
            {"$set": {"start_at": past_start, "end_at": past_end}},
        )

        # GET should lazily resolve
        rd = requests.get(f"{BASE_URL}/api/challenges/{cid}", headers=admin["h"], timeout=15)
        assert rd.status_code == 200
        c = rd.json()["challenge"]
        assert c["status"] == "completed", f"expected completed, got {c['status']}"
        # winner should be admin (only participant with progress)
        assert c.get("winner") and c["winner"]["user_id"] == admin["id"]
        assert c.get("target_reached") is True  # value (>=1) >= target (1)
    finally:
        client.close()
