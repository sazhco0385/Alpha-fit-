"""Tests for email verification flow (register no-token, login 403, verify token, resend cooldown, grandfathering)."""
import os
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fitness-ai-premium.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Direct DB access to fetch tokens / seed expired tokens
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "alphafit_db")
_client = MongoClient(MONGO_URL)
_db = _client[DB_NAME]


def _fresh_email():
    return f"TEST_verify_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}@example.com"


@pytest.fixture(scope="module")
def created_emails():
    emails = []
    yield emails
    # Cleanup
    for e in emails:
        _db.users.delete_many({"email": e})
        _db.email_verifications.delete_many({"email": e})
        _db.email_log.delete_many({"email": e})


# ---------- Registration ----------
class TestRegister:
    def test_register_returns_no_token_and_creates_unverified_user(self, created_emails):
        email = _fresh_email()
        created_emails.append(email)
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "TestPass123!", "name": "Verify Tester"
        }, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("email_verification_required") is True
        assert body.get("email") == email.lower()
        assert "message" in body
        assert "token" not in body  # NO JWT returned

        # user doc created, unverified
        u = _db.users.find_one({"email": email.lower()})
        assert u is not None
        assert u.get("email_verified") is False

        # Give the async task a moment to insert the verification doc + send email
        for _ in range(20):
            doc = _db.email_verifications.find_one({"email": email.lower()})
            if doc:
                break
            time.sleep(0.25)
        assert doc is not None, "email_verifications doc not created"
        assert isinstance(doc["token"], str) and len(doc["token"]) >= 32
        assert doc["used"] is False
        exp = datetime.fromisoformat(str(doc["expires_at"]).replace("Z", "+00:00"))
        # ~24h from now
        delta_hours = (exp - datetime.now(timezone.utc)).total_seconds() / 3600.0
        assert 23.0 < delta_hours <= 24.5


# ---------- Login on unverified ----------
class TestLoginUnverified:
    def test_login_unverified_returns_403(self, created_emails):
        email = _fresh_email()
        created_emails.append(email)
        requests.post(f"{API}/auth/register", json={
            "email": email, "password": "TestPass123!", "name": "T"
        }, timeout=15)
        r = requests.post(f"{API}/auth/login", json={
            "email": email, "password": "TestPass123!"
        }, timeout=15)
        assert r.status_code == 403, r.text
        detail = r.json().get("detail")
        assert isinstance(detail, dict)
        assert detail.get("code") == "email_not_verified"
        assert detail.get("email") == email.lower()
        assert "message" in detail
        assert "token" not in r.json()


# ---------- Verify email endpoint ----------
class TestVerifyEmail:
    def test_invalid_token_returns_404(self):
        r = requests.get(f"{API}/auth/verify-email", params={"token": "a" * 40}, timeout=10)
        assert r.status_code == 404, r.text
        assert "nicht gefunden" in r.json().get("detail", "").lower()

    def test_too_short_token_returns_400(self):
        r = requests.get(f"{API}/auth/verify-email", params={"token": "short"}, timeout=10)
        assert r.status_code == 400

    def test_verify_valid_token_then_reuse(self, created_emails):
        email = _fresh_email()
        created_emails.append(email)
        requests.post(f"{API}/auth/register", json={
            "email": email, "password": "TestPass123!", "name": "V"
        }, timeout=15)
        # wait for verify doc
        doc = None
        for _ in range(20):
            doc = _db.email_verifications.find_one({"email": email.lower()})
            if doc:
                break
            time.sleep(0.25)
        assert doc is not None
        token = doc["token"]

        # First verify -> success
        r1 = requests.get(f"{API}/auth/verify-email", params={"token": token}, timeout=10)
        assert r1.status_code == 200, r1.text
        b1 = r1.json()
        assert b1["ok"] is True and b1["already_verified"] is False
        assert b1["email"] == email.lower()

        # DB assertions
        u = _db.users.find_one({"email": email.lower()})
        assert u["email_verified"] is True
        d = _db.email_verifications.find_one({"token": token})
        assert d["used"] is True

        # Second call -> already_verified True
        r2 = requests.get(f"{API}/auth/verify-email", params={"token": token}, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["already_verified"] is True

        # Login should now succeed
        rl = requests.post(f"{API}/auth/login", json={
            "email": email, "password": "TestPass123!"
        }, timeout=15)
        assert rl.status_code == 200, rl.text
        assert "token" in rl.json()
        assert rl.json()["user"]["email"] == email.lower()

    def test_expired_token_returns_410(self, created_emails):
        # Seed an expired token directly
        email = _fresh_email()
        created_emails.append(email)
        # need a real user to align
        requests.post(f"{API}/auth/register", json={
            "email": email, "password": "TestPass123!", "name": "Exp"
        }, timeout=15)
        u = _db.users.find_one({"email": email.lower()})
        assert u is not None
        expired_token = "x" * 43  # url-safe-ish length
        past = datetime.now(timezone.utc) - timedelta(hours=1)
        _db.email_verifications.insert_one({
            "token": expired_token,
            "user_id": u["id"],
            "email": email.lower(),
            "created_at": (past - timedelta(hours=24)).isoformat(),
            "expires_at": past.isoformat(),
            "used": False,
            "sent_at": (past - timedelta(hours=24)).isoformat(),
        })
        r = requests.get(f"{API}/auth/verify-email", params={"token": expired_token}, timeout=10)
        assert r.status_code == 410, r.text
        assert "abgelaufen" in r.json()["detail"].lower()


# ---------- Resend ----------
class TestResend:
    def test_resend_nonexistent_email_returns_generic_ok(self):
        r = requests.post(f"{API}/auth/resend-verification", json={
            "email": f"nonexistent_{uuid.uuid4().hex}@example.com"
        }, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body.get("ok") is True
        # generic message (no enumeration)
        assert "already_verified" not in body

    def test_resend_verified_email(self, created_emails):
        # register + verify a user, then resend
        email = _fresh_email()
        created_emails.append(email)
        requests.post(f"{API}/auth/register", json={
            "email": email, "password": "TestPass123!", "name": "R"
        }, timeout=15)
        doc = None
        for _ in range(20):
            doc = _db.email_verifications.find_one({"email": email.lower()})
            if doc:
                break
            time.sleep(0.25)
        assert doc is not None
        requests.get(f"{API}/auth/verify-email", params={"token": doc["token"]}, timeout=10)
        r = requests.post(f"{API}/auth/resend-verification", json={"email": email}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body.get("already_verified") is True
        assert "bereits bestätigt" in body.get("message", "").lower()

    def test_resend_cooldown_429(self, created_emails):
        email = _fresh_email()
        created_emails.append(email)
        # Register triggers a first send (creates a recent sent_at)
        requests.post(f"{API}/auth/register", json={
            "email": email, "password": "TestPass123!", "name": "Cool"
        }, timeout=15)
        # Wait for verify doc created
        for _ in range(20):
            if _db.email_verifications.find_one({"email": email.lower()}):
                break
            time.sleep(0.25)
        # Now call resend -> should be 429 (within 60s cooldown from register send)
        r = requests.post(f"{API}/auth/resend-verification", json={"email": email}, timeout=15)
        assert r.status_code == 429, r.text
        assert "warte" in r.json()["detail"].lower()


# ---------- Grandfathering (admin login) ----------
class TestGrandfathering:
    def test_admin_login_works(self):
        r = requests.post(f"{API}/auth/login", json={
            "email": "sazhco0385@gmail.com", "password": "Bellakiki1"
        }, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "token" in body
        assert body["user"]["email"] == "sazhco0385@gmail.com"
