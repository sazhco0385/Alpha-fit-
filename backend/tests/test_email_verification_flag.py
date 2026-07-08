"""Tests for EMAIL_VERIFICATION_REQUIRED feature flag + admin endpoints (verify-user, auth-config)."""
import os
import time
import uuid
import subprocess

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fitness-ai-premium.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ENV_PATH = "/app/backend/.env"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "alphafit_db")
_client = MongoClient(MONGO_URL)
_db = _client[DB_NAME]

ADMIN_EMAIL = "sazhco0385@gmail.com"
ADMIN_PASSWORD = "Bellakiki1"


def _fresh_email():
    # Backend lowercases via EmailStr, so keep it lowercase to match responses
    return f"test_flag_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}@example.com"


def _set_flag(value: str):
    """Rewrite EMAIL_VERIFICATION_REQUIRED line in-place then restart backend."""
    with open(ENV_PATH, "r") as f:
        lines = f.readlines()
    found = False
    for i, line in enumerate(lines):
        if line.startswith("EMAIL_VERIFICATION_REQUIRED"):
            lines[i] = f"EMAIL_VERIFICATION_REQUIRED={value}\n"
            found = True
            break
    if not found:
        lines.append(f"EMAIL_VERIFICATION_REQUIRED={value}\n")
    with open(ENV_PATH, "w") as f:
        f.writelines(lines)
    subprocess.run(["sudo", "supervisorctl", "restart", "backend"], check=True, capture_output=True)
    # Wait for backend to boot
    for _ in range(30):
        try:
            r = requests.get(f"{API}/", timeout=3)
            if r.status_code < 500:
                time.sleep(1)
                return
        except Exception:
            pass
        time.sleep(1)


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def created_emails():
    emails = []
    yield emails
    for e in emails:
        try:
            _db.users.delete_many({"email": e})
            _db.email_verifications.delete_many({"email": e})
        except Exception:
            pass


@pytest.fixture(scope="module", autouse=True)
def _restore_flag_final():
    yield
    # RESTORATION: ensure final state is flag=false as user needs beta users unblocked
    _set_flag("false")


# ==================== FLAG=FALSE (default preview state) ====================

class TestFlagFalse:
    def test_00_ensure_flag_false(self):
        _set_flag("false")

    def test_01_auth_config_shows_false(self, admin_token):
        r = requests.get(f"{API}/admin/auth-config", headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email_verification_required"] is False
        assert data["resend_api_key_present"] is True
        assert data["resend_sender_email"] == "noreply@alpha-fit.fitness"

    def test_02_auth_config_non_admin_forbidden(self, created_emails):
        # register a non-admin
        email = _fresh_email()
        created_emails.append(email)
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "name": "T"}, timeout=15)
        assert r.status_code == 200, r.text
        token = r.json()["token"]
        r2 = requests.get(f"{API}/admin/auth-config", headers={"Authorization": f"Bearer {token}"}, timeout=10)
        assert r2.status_code == 403

    def test_03_register_returns_token_directly(self, created_emails):
        email = _fresh_email()
        created_emails.append(email)
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "name": "Beta"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and data["token"]
        assert "user" in data
        assert data["user"]["email"] == email
        assert "email_verification_required" not in data
        # DB check
        u = _db.users.find_one({"email": email})
        assert u is not None
        assert u.get("email_verified") is True

    def test_04_login_succeeds_no_403(self, created_emails):
        email = _fresh_email()
        created_emails.append(email)
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "name": "Beta"}, timeout=15)
        assert r.status_code == 200
        r2 = requests.post(f"{API}/auth/login", json={"email": email, "password": "pass1234"}, timeout=15)
        assert r2.status_code == 200, r2.text
        assert "token" in r2.json()

    def test_05_admin_verify_user_ok(self, admin_token, created_emails):
        email = _fresh_email()
        created_emails.append(email)
        # First register a user; flag=false so email_verified already true — flip to false in DB to see modified=1
        requests.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "name": "X"}, timeout=15)
        _db.users.update_one({"email": email}, {"$set": {"email_verified": False}})
        r = requests.post(f"{API}/admin/verify-user", json={"email": email},
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["modified"] == 1
        u = _db.users.find_one({"email": email})
        assert u["email_verified"] is True
        assert u["verified_by_admin"] == ADMIN_EMAIL

    def test_06_admin_verify_user_not_found(self, admin_token):
        r = requests.post(f"{API}/admin/verify-user", json={"email": "nonexistent_TEST_zzz@example.com"},
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        assert r.status_code == 404
        assert "nicht gefunden" in r.text

    def test_07_admin_verify_user_bad_email(self, admin_token):
        r = requests.post(f"{API}/admin/verify-user", json={"email": ""},
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        assert r.status_code == 400


# ==================== FLAG=TRUE (strict verification mode) ====================

class TestFlagTrue:
    def test_10_toggle_flag_true(self):
        _set_flag("true")

    def test_11_auth_config_shows_true(self, admin_token):
        r = requests.get(f"{API}/admin/auth-config", headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        assert r.status_code == 200
        assert r.json()["email_verification_required"] is True

    def test_12_register_requires_verification(self, created_emails):
        email = _fresh_email()
        created_emails.append(email)
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "name": "Strict"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("email_verification_required") is True
        assert "token" not in data
        assert data["email"] == email

    def test_13_login_blocked_403(self, created_emails):
        email = _fresh_email()
        created_emails.append(email)
        requests.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "name": "Strict"}, timeout=15)
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": "pass1234"}, timeout=15)
        assert r.status_code == 403, r.text
        detail = r.json().get("detail", {})
        assert isinstance(detail, dict)
        assert detail.get("code") == "email_not_verified"

    def test_14_verify_email_get_endpoint_regression(self, created_emails):
        # Register, get token from DB, hit /verify-email, then login should succeed
        email = _fresh_email()
        created_emails.append(email)
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "name": "V"}, timeout=15)
        assert r.status_code == 200
        # Wait briefly for async task to write verification token
        token_doc = None
        for _ in range(20):
            token_doc = _db.email_verifications.find_one({"email": email}, sort=[("created_at", -1)])
            if token_doc:
                break
            time.sleep(1)
        assert token_doc, "verification token not created"
        vtoken = token_doc["token"]
        r2 = requests.get(f"{API}/auth/verify-email", params={"token": vtoken}, timeout=15, allow_redirects=False)
        # Endpoint may redirect (302) or return 200
        assert r2.status_code in (200, 302, 303), f"verify-email returned {r2.status_code}: {r2.text}"
        u = _db.users.find_one({"email": email})
        assert u["email_verified"] is True
        # Login now works even with flag=true
        r3 = requests.post(f"{API}/auth/login", json={"email": email, "password": "pass1234"}, timeout=15)
        assert r3.status_code == 200, r3.text

    def test_15_admin_login_still_works_flag_true(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 200, r.text
        assert "token" in r.json()


# ==================== FINAL: restore + verify admin login flag=false ====================

class TestRestore:
    def test_20_restore_flag_false(self):
        _set_flag("false")

    def test_21_auth_config_restored(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 200
        token = r.json()["token"]
        r2 = requests.get(f"{API}/admin/auth-config", headers={"Authorization": f"Bearer {token}"}, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["email_verification_required"] is False
