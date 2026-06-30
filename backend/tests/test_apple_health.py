"""Apple Health integration tests — token, shortcut POST, export.zip upload."""
import os
import sys
import uuid
import io
import zipfile

import httpx
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

API_URL = os.environ.get("BACKEND_URL", "http://localhost:8001/api")


async def _register(client: httpx.AsyncClient, email: str, name: str = "AH Test"):
    r = await client.post(f"{API_URL}/auth/register", json={"email": email, "password": "Test1234!", "name": name})
    r.raise_for_status()
    return r.json()


def _hdr(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


def _make_health_export_xml(records: list[tuple[str, float, str]]) -> bytes:
    """Build a minimal Apple Health export.xml with BodyMass records.
    records: list of (date_iso, weight_kg, unit)
    """
    parts = ['<?xml version="1.0" encoding="UTF-8"?>', "<HealthData locale=\"de_DE\">"]
    for date, weight, unit in records:
        parts.append(
            f'<Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Health" '
            f'unit="{unit}" value="{weight}" startDate="{date}" endDate="{date}" creationDate="{date}"/>'
        )
    parts.append("</HealthData>")
    return "\n".join(parts).encode("utf-8")


def _zip_health_export(xml_bytes: bytes) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("apple_health_export/export.xml", xml_bytes)
    return buf.getvalue()


@pytest.mark.asyncio
async def test_token_create_and_rotate():
    async with httpx.AsyncClient(timeout=10) as cx:
        u = await _register(cx, f"ah_{uuid.uuid4().hex[:8]}@example.com")
        tok = u["token"]
        r1 = (await cx.get(f"{API_URL}/integrations/apple-health/token", headers=_hdr(tok))).json()
        assert r1["token"].startswith("af_ah_")
        # 2nd call returns the SAME token (idempotent)
        r2 = (await cx.get(f"{API_URL}/integrations/apple-health/token", headers=_hdr(tok))).json()
        assert r1["token"] == r2["token"]
        # Rotate changes it
        r3 = (await cx.post(f"{API_URL}/integrations/apple-health/token/rotate", headers=_hdr(tok))).json()
        assert r3["token"] != r1["token"]


@pytest.mark.asyncio
async def test_shortcut_post_weight_with_valid_token():
    async with httpx.AsyncClient(timeout=15) as cx:
        u = await _register(cx, f"sc_{uuid.uuid4().hex[:8]}@example.com")
        tok = u["token"]
        ah_tok = (await cx.get(f"{API_URL}/integrations/apple-health/token", headers=_hdr(tok))).json()["token"]
        r = await cx.post(
            f"{API_URL}/integrations/apple-health/weight",
            headers={"X-AlphaFit-Token": ah_tok, "Content-Type": "application/json"},
            json={"weight_kg": 76.5},
        )
        assert r.status_code == 200
        assert r.json()["weight_kg"] == 76.5
        # Verify it shows up in weight-trend
        trend = (await cx.get(f"{API_URL}/profile/weight-trend", headers=_hdr(tok))).json()
        assert trend["current_kg"] == 76.5


@pytest.mark.asyncio
async def test_shortcut_dedupes_same_day_same_weight():
    async with httpx.AsyncClient(timeout=10) as cx:
        u = await _register(cx, f"dd_{uuid.uuid4().hex[:8]}@example.com")
        ah_tok = (await cx.get(f"{API_URL}/integrations/apple-health/token", headers=_hdr(u["token"]))).json()["token"]
        hdr = {"X-AlphaFit-Token": ah_tok, "Content-Type": "application/json"}
        r1 = await cx.post(f"{API_URL}/integrations/apple-health/weight", headers=hdr, json={"weight_kg": 80.0})
        r2 = await cx.post(f"{API_URL}/integrations/apple-health/weight", headers=hdr, json={"weight_kg": 80.0})
        assert r1.json().get("skipped") is None
        assert r2.json().get("skipped") is True


@pytest.mark.asyncio
async def test_shortcut_rejects_invalid_token():
    async with httpx.AsyncClient(timeout=10) as cx:
        r = await cx.post(
            f"{API_URL}/integrations/apple-health/weight",
            headers={"X-AlphaFit-Token": "garbage", "Content-Type": "application/json"},
            json={"weight_kg": 80.0},
        )
        assert r.status_code == 401


@pytest.mark.asyncio
async def test_export_zip_upload_imports_weights():
    async with httpx.AsyncClient(timeout=20) as cx:
        u = await _register(cx, f"up_{uuid.uuid4().hex[:8]}@example.com")
        tok = u["token"]
        xml = _make_health_export_xml([
            ("2026-01-01 08:00:00 +0000", 85.0, "kg"),
            ("2026-02-01 08:00:00 +0000", 84.0, "kg"),
            ("2026-03-01 08:00:00 +0000", 83.0, "kg"),
        ])
        zip_bytes = _zip_health_export(xml)
        files = {"file": ("export.zip", zip_bytes, "application/zip")}
        r = await cx.post(
            f"{API_URL}/integrations/apple-health/upload",
            headers=_hdr(tok),
            files=files,
        )
        assert r.status_code == 200
        d = r.json()
        assert d["found"] == 3
        assert d["imported"] == 3
        # Re-upload deduplicates
        files2 = {"file": ("export.zip", zip_bytes, "application/zip")}
        r2 = await cx.post(
            f"{API_URL}/integrations/apple-health/upload",
            headers=_hdr(tok),
            files=files2,
        )
        d2 = r2.json()
        assert d2["imported"] == 0
        assert d2["skipped_duplicates"] == 3


@pytest.mark.asyncio
async def test_export_xml_unit_conversion_lbs():
    async with httpx.AsyncClient(timeout=15) as cx:
        u = await _register(cx, f"lb_{uuid.uuid4().hex[:8]}@example.com")
        xml = _make_health_export_xml([
            ("2026-04-01 08:00:00 +0000", 180.0, "lb"),  # = ~81.6 kg
        ])
        zip_bytes = _zip_health_export(xml)
        r = await cx.post(
            f"{API_URL}/integrations/apple-health/upload",
            headers=_hdr(u["token"]),
            files={"file": ("export.zip", zip_bytes, "application/zip")},
        )
        assert r.json()["imported"] == 1
        trend = (await cx.get(f"{API_URL}/profile/weight-trend", headers=_hdr(u["token"]))).json()
        assert 81.0 < trend["current_kg"] < 82.0


@pytest.mark.asyncio
async def test_upload_rejects_non_zip():
    async with httpx.AsyncClient(timeout=10) as cx:
        u = await _register(cx, f"bad_{uuid.uuid4().hex[:8]}@example.com")
        r = await cx.post(
            f"{API_URL}/integrations/apple-health/upload",
            headers=_hdr(u["token"]),
            files={"file": ("badname.txt", b"junk", "text/plain")},
        )
        assert r.status_code == 400


@pytest.mark.asyncio
async def test_upload_requires_auth():
    async with httpx.AsyncClient(timeout=10) as cx:
        r = await cx.post(
            f"{API_URL}/integrations/apple-health/upload",
            files={"file": ("export.zip", b"", "application/zip")},
        )
        assert r.status_code in (401, 403)
