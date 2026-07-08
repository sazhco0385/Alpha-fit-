"""Tests for the admin email diagnostics endpoints (GET /admin/email-diagnostics, POST /admin/email-test).
Also verifies that a normal registration writes to db.email_log_raw."""
import os
import time
import uuid

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fitness-ai-premium.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "alphafit_db")
_client = MongoClient(MONGO_URL)
_db = _client[DB_NAME]

ADMIN_EMAIL = "sazhco0385@gmail.com"
ADMIN_PASSWORD = "Bellakiki1"


def _test_addr():
    return f"test+{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}@example.com"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def cleanup():
    created_emails = []
    yield created_emails
    for e in created_emails:
        _db.users.delete_many({"email": e})
        _db.email_verifications.delete_many({"email": e})
        _db.email_log.delete_many({"email": e})
        _db.email_log_raw.delete_many({"to": e})


class TestAuth:
    def test_no_token_returns_401_or_403(self):
        r = requests.get(f"{API}/admin/email-diagnostics", timeout=15)
        assert r.status_code in (401, 403), r.text

    def test_non_admin_forbidden(self, cleanup):
        email = _test_addr()
        cleanup.append(email)
        requests.post(f"{API}/auth/register", json={"email": email, "password": "TestPass123!", "name": "N"}, timeout=15)
        # Grandfather / verify user so they can login (mark email_verified)
        _db.users.update_one({"email": email.lower()}, {"$set": {"email_verified": True}})
        lr = requests.post(f"{API}/auth/login", json={"email": email, "password": "TestPass123!"}, timeout=15)
        assert lr.status_code == 200, lr.text
        user_token = lr.json()["token"]
        r = requests.get(f"{API}/admin/email-diagnostics",
                         headers={"Authorization": f"Bearer {user_token}"}, timeout=15)
        assert r.status_code == 403, r.text


class TestDiagnosticsGET:
    def test_returns_expected_keys(self, admin_token):
        r = requests.get(f"{API}/admin/email-diagnostics",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("sender_email", "api_key_present", "raw_sends", "template_log", "raw_ok_count", "raw_error_count"):
            assert k in body, f"missing key {k}"
        assert isinstance(body["raw_sends"], list)
        assert isinstance(body["template_log"], list)
        assert isinstance(body["raw_ok_count"], int)
        assert isinstance(body["raw_error_count"], int)
        assert isinstance(body["api_key_present"], bool)

    def test_filter_by_email(self, admin_token, cleanup):
        # Seed a raw doc with a specific recipient
        marker = _test_addr()
        cleanup.append(marker)
        _db.email_log_raw.insert_one({
            "to": marker, "subject": "s", "tag": "unit", "sender": "x",
            "sent_at": "2026-01-01T00:00:00+00:00", "ok": True,
            "email_id": "seed_id_123", "error": None, "raw": "seed"
        })
        r = requests.get(f"{API}/admin/email-diagnostics",
                         params={"email": marker},
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert len(body["raw_sends"]) >= 1
        assert all(rs.get("to") == marker for rs in body["raw_sends"])


class TestEmailTestPOST:
    def test_invalid_email_400(self, admin_token):
        r = requests.post(f"{API}/admin/email-test", json={"email": "notanemail"},
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 400, r.text
        assert "Ungültige" in r.json().get("detail", "") or "ungültig" in r.json().get("detail", "").lower()

    def test_empty_email_400(self, admin_token):
        r = requests.post(f"{API}/admin/email-test", json={},
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 400

    def test_send_test_email_returns_diagnostic(self, admin_token, cleanup):
        to = _test_addr()
        cleanup.append(to)
        r = requests.post(f"{API}/admin/email-test", json={"email": to},
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "ok" in body
        assert "email_id" in body
        assert "diagnostic" in body
        # Diagnostic should be the raw log entry we just inserted
        diag = body["diagnostic"]
        assert diag is not None, "diagnostic should not be None right after send"
        assert diag.get("to") == to
        assert diag.get("sender")  # sender field populated
        assert "sent_at" in diag
        # Verify DB has the entry
        db_doc = _db.email_log_raw.find_one({"to": to})
        assert db_doc is not None


class TestRegistrationWritesRaw:
    def test_register_creates_email_log_raw(self, cleanup):
        email = _test_addr()
        cleanup.append(email)
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "TestPass123!", "name": "RawLog"}, timeout=15)
        assert r.status_code == 200, r.text
        # Wait for background send + insert
        found = None
        for _ in range(30):
            found = _db.email_log_raw.find_one({"to": email.lower()})
            if found:
                break
            time.sleep(0.3)
        assert found is not None, "email_log_raw entry not created on registration"
        assert "sent_at" in found
        assert "ok" in found
        assert found.get("sender")
