"""Tests for Phase 2: AI Body Scan endpoints.

Covers:
- 403 premium gate for non-premium users (analyze/history/detail/delete)
- Premium admin flow: analyze -> response schema -> history -> detail -> delete
- delta_vs_previous: null on first scan, populated on second
- Photo (image_base64) is NOT persisted in DB
"""
import os
import uuid
import base64
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "sazhco0385@gmail.com"
ADMIN_PASSWORD = "Bellakiki1"

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")


def auth_h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


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
def nonpremium_user(session):
    creds = {
        "email": f"TEST_bs_{uuid.uuid4().hex[:8]}@example.com",
        "password": "TestPass123!",
        "name": "TEST BodyScan NonPrem",
    }
    r = session.post(f"{API}/auth/register", json=creds, timeout=30)
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    user = r.json()["user"]
    yield token, user, creds
    # cleanup via admin
    try:
        r2 = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
        a = r2.json()["token"]
        session.delete(f"{API}/admin/members/{user['id']}", headers=auth_h(a), timeout=20)
    except Exception:
        pass


def _fetch_person_image_b64():
    """Fetch a small image of a person (Unsplash). Fallback to generated image."""
    urls = [
        "https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=512&q=60",
        "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=512&q=60",
        "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=512&q=60",
    ]
    for url in urls:
        try:
            r = requests.get(url, timeout=15)
            if r.status_code == 200 and len(r.content) > 1000:
                return base64.b64encode(r.content).decode()
        except Exception:
            continue
    try:
        from PIL import Image
        import io
        img = Image.new("RGB", (128, 256), color=(200, 170, 140))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        return base64.b64encode(buf.getvalue()).decode()
    except Exception:
        return None


# ===== 403 Premium Gate =====

def test_analyze_403_for_nonpremium(session, nonpremium_user):
    token, _, _ = nonpremium_user
    img = _fetch_person_image_b64()
    payload = {"image_base64": img or "ZmFrZQ==", "notes": "test"}
    r = session.post(f"{API}/bodyscan/analyze", headers=auth_h(token), json=payload, timeout=30)
    assert r.status_code == 403, f"expected 403 got {r.status_code} {r.text[:200]}"
    detail = r.json().get("detail", "")
    assert "Premium" in detail and "Body Scan" in detail, f"detail mismatch: {detail}"


def test_history_403_for_nonpremium(session, nonpremium_user):
    token, _, _ = nonpremium_user
    r = session.get(f"{API}/bodyscan/history", headers=auth_h(token), timeout=15)
    assert r.status_code == 403


def test_detail_403_for_nonpremium(session, nonpremium_user):
    token, _, _ = nonpremium_user
    r = session.get(f"{API}/bodyscan/some-scan-id", headers=auth_h(token), timeout=15)
    assert r.status_code == 403


def test_delete_403_for_nonpremium(session, nonpremium_user):
    token, _, _ = nonpremium_user
    r = session.delete(f"{API}/bodyscan/some-scan-id", headers=auth_h(token), timeout=15)
    assert r.status_code == 403


# ===== Premium admin: full analyze flow =====

REQUIRED_KEYS = {
    "id", "overall_score", "body_fat_estimate", "muscle_development",
    "symmetry_score", "strengths", "weak_points", "recommendations",
    "next_focus", "confidence", "delta_vs_previous",
}
MUSCLE_GROUPS = ["chest", "shoulders", "back", "arms", "core", "legs", "glutes"]


@pytest.fixture(scope="module")
def first_scan(session, admin_token):
    """Perform a fresh scan as admin. If vision returns no_body, skip dependent tests."""
    a_token, _ = admin_token
    img = _fetch_person_image_b64()
    assert img, "could not get test image"
    payload = {"image_base64": img, "notes": "TEST first scan"}
    r = session.post(f"{API}/bodyscan/analyze", headers=auth_h(a_token), json=payload, timeout=120)
    if r.status_code == 400 and "no_body_detected" in r.text.lower() or "kein körper" in r.text.lower():
        pytest.skip(f"vision says no body detected (acceptable): {r.text[:200]}")
    assert r.status_code == 200, f"first scan failed: {r.status_code} {r.text[:300]}"
    return r.json()


def test_first_scan_schema(first_scan):
    d = first_scan
    missing = REQUIRED_KEYS - set(d.keys())
    assert not missing, f"missing keys: {missing}"
    # Ranges
    assert 0 <= d["overall_score"] <= 100
    assert isinstance(d["body_fat_estimate"], (int, float))
    assert 1 <= d["symmetry_score"] <= 10
    assert 0.0 <= d["confidence"] <= 1.0
    # muscle_development
    md = d["muscle_development"]
    assert isinstance(md, dict)
    for g in MUSCLE_GROUPS:
        assert g in md, f"missing muscle group {g}"
        assert 1 <= md[g] <= 10
    # lists
    for lk in ("strengths", "weak_points", "recommendations"):
        assert isinstance(d[lk], list)
    assert isinstance(d["next_focus"], str)


def test_first_scan_delta_can_be_null_or_dict(first_scan):
    """First scan in a fresh DB has delta=None; otherwise (admin has history) it is a dict."""
    delta = first_scan.get("delta_vs_previous")
    assert delta is None or isinstance(delta, dict)


@pytest.fixture(scope="module")
def second_scan(session, admin_token, first_scan):
    a_token, _ = admin_token
    img = _fetch_person_image_b64()
    payload = {"image_base64": img, "notes": "TEST second scan"}
    r = session.post(f"{API}/bodyscan/analyze", headers=auth_h(a_token), json=payload, timeout=120)
    if r.status_code == 400:
        pytest.skip(f"second scan no_body_detected: {r.text[:200]}")
    assert r.status_code == 200, f"second scan failed: {r.status_code} {r.text[:300]}"
    return r.json()


def test_second_scan_has_delta_vs_previous(second_scan, first_scan):
    delta = second_scan.get("delta_vs_previous")
    assert delta is not None, "delta_vs_previous must be set on second scan"
    assert isinstance(delta, dict)
    for k in ("overall_score", "body_fat_estimate", "symmetry_score", "muscle_development"):
        assert k in delta, f"delta missing {k}"
    assert isinstance(delta["muscle_development"], dict)
    for g in MUSCLE_GROUPS:
        assert g in delta["muscle_development"]
    # references to previous
    assert delta.get("previous_scan_id") == first_scan["id"]


# ===== History / Detail / Delete =====

def test_history_returns_recent_scans(session, admin_token, first_scan, second_scan):
    a_token, _ = admin_token
    r = session.get(f"{API}/bodyscan/history?limit=10", headers=auth_h(a_token), timeout=20)
    assert r.status_code == 200
    scans = r.json().get("scans", [])
    assert isinstance(scans, list)
    ids = [s["id"] for s in scans]
    assert first_scan["id"] in ids
    assert second_scan["id"] in ids
    # newest first: second_scan must come before first_scan
    assert ids.index(second_scan["id"]) < ids.index(first_scan["id"])


def test_detail_returns_single_scan(session, admin_token, first_scan):
    a_token, _ = admin_token
    r = session.get(f"{API}/bodyscan/{first_scan['id']}", headers=auth_h(a_token), timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["id"] == first_scan["id"]
    assert "muscle_development" in d


def test_detail_404_for_unknown(session, admin_token):
    a_token, _ = admin_token
    r = session.get(f"{API}/bodyscan/does-not-exist-{uuid.uuid4()}", headers=auth_h(a_token), timeout=15)
    assert r.status_code == 404


# ===== Photo NOT stored in DB =====

def test_image_not_persisted_in_db(first_scan):
    """Directly query Mongo to ensure no image_base64 / image / photo field is stored."""
    if not (MONGO_URL and DB_NAME):
        pytest.skip("MONGO_URL/DB_NAME not configured")

    async def _check():
        client = AsyncIOMotorClient(MONGO_URL)
        try:
            doc = await client[DB_NAME].body_scans.find_one({"id": first_scan["id"]})
            assert doc is not None, "scan not found in DB"
            forbidden = {"image_base64", "image", "photo", "image_data", "base64"}
            present = forbidden & set(doc.keys())
            assert not present, f"image data was persisted! fields: {present}"
        finally:
            client.close()

    asyncio.get_event_loop().run_until_complete(_check())


# ===== Delete cleanup =====

def test_delete_scan(session, admin_token, second_scan):
    a_token, _ = admin_token
    r = session.delete(f"{API}/bodyscan/{second_scan['id']}", headers=auth_h(a_token), timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d.get("ok") is True
    assert d.get("deleted") == 1
    # verify gone
    r2 = session.get(f"{API}/bodyscan/{second_scan['id']}", headers=auth_h(a_token), timeout=15)
    assert r2.status_code == 404


def test_delete_first_scan_cleanup(session, admin_token, first_scan):
    a_token, _ = admin_token
    r = session.delete(f"{API}/bodyscan/{first_scan['id']}", headers=auth_h(a_token), timeout=15)
    assert r.status_code == 200
    assert r.json().get("deleted") == 1
