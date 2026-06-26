"""Barcode lookup via Open Food Facts proxy endpoint."""
import os
import sys
import uuid

import httpx
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

API_URL = os.environ.get("BACKEND_URL", "http://localhost:8001/api")


async def _register(client: httpx.AsyncClient, email: str, name: str = "Barcode Test"):
    r = await client.post(f"{API_URL}/auth/register", json={"email": email, "password": "Test1234!", "name": name})
    r.raise_for_status()
    return r.json()


def _hdr(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


@pytest.mark.asyncio
async def test_barcode_nutella():
    """Real product: Nutella 3017620422003."""
    async with httpx.AsyncClient(timeout=20) as cx:
        u = await _register(cx, f"bar_{uuid.uuid4().hex[:8]}@example.com")
        r = await cx.get(f"{API_URL}/nutrition/barcode/3017620422003", headers=_hdr(u["token"]))
        assert r.status_code == 200
        d = r.json()
        assert d["found"] is True
        assert "Nutella" in d["food_name"]
        assert d["portion_grams"] > 0
        assert d["calories"] > 400  # 100g Nutella ≈ 539 kcal
        assert d["sugar_g"] > 40
        assert d["source"] == "openfoodfacts"


@pytest.mark.asyncio
async def test_barcode_invalid_format():
    async with httpx.AsyncClient(timeout=10) as cx:
        u = await _register(cx, f"bar2_{uuid.uuid4().hex[:8]}@example.com")
        # Non-digit
        r = await cx.get(f"{API_URL}/nutrition/barcode/abcde", headers=_hdr(u["token"]))
        assert r.status_code == 400
        # Too short
        r = await cx.get(f"{API_URL}/nutrition/barcode/12345", headers=_hdr(u["token"]))
        assert r.status_code == 400


@pytest.mark.asyncio
async def test_barcode_not_found():
    async with httpx.AsyncClient(timeout=15) as cx:
        u = await _register(cx, f"bar3_{uuid.uuid4().hex[:8]}@example.com")
        # 14-digit unlikely barcode (max length, all zeros)
        r = await cx.get(f"{API_URL}/nutrition/barcode/00000000000017", headers=_hdr(u["token"]))
        assert r.status_code == 404


@pytest.mark.asyncio
async def test_barcode_requires_auth():
    async with httpx.AsyncClient(timeout=10) as cx:
        r = await cx.get(f"{API_URL}/nutrition/barcode/3017620422003")
        assert r.status_code in (401, 403)
