"""Nutrition analyze-name (text-only AI estimate) tests."""
import os
import sys
import uuid

import httpx
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

API_URL = os.environ.get("BACKEND_URL", "http://localhost:8001/api")


async def _register(client: httpx.AsyncClient, email: str, name: str = "Nut Test"):
    r = await client.post(f"{API_URL}/auth/register", json={"email": email, "password": "Test1234!", "name": name})
    r.raise_for_status()
    return r.json()


def _hdr(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


@pytest.mark.asyncio
async def test_analyze_name_returns_macros():
    async with httpx.AsyncClient(timeout=45) as cx:
        u = await _register(cx, f"nut_{uuid.uuid4().hex[:8]}@example.com")
        r = await cx.post(f"{API_URL}/nutrition/analyze-name",
                          headers=_hdr(u["token"]),
                          json={"food_name": "Banane", "portion_grams": 120})
        assert r.status_code == 200
        d = r.json()
        for k in ("food_name", "portion_grams", "calories", "protein_g", "carbs_g",
                  "fat_g", "fiber_g", "sugar_g", "sodium_mg", "confidence"):
            assert k in d
        assert 80 < d["calories"] < 150, f"Banana 120g calories looks off: {d['calories']}"
        assert d["confidence"] >= 0.5


@pytest.mark.asyncio
async def test_analyze_name_validation():
    async with httpx.AsyncClient(timeout=20) as cx:
        u = await _register(cx, f"nut2_{uuid.uuid4().hex[:8]}@example.com")
        # Empty name → 400
        r = await cx.post(f"{API_URL}/nutrition/analyze-name",
                          headers=_hdr(u["token"]),
                          json={"food_name": "", "portion_grams": 100})
        assert r.status_code == 400
        # Too short → 400
        r = await cx.post(f"{API_URL}/nutrition/analyze-name",
                          headers=_hdr(u["token"]),
                          json={"food_name": "a", "portion_grams": 100})
        assert r.status_code == 400


@pytest.mark.asyncio
async def test_analyze_name_requires_auth():
    async with httpx.AsyncClient(timeout=10) as cx:
        r = await cx.post(f"{API_URL}/nutrition/analyze-name",
                          json={"food_name": "Banane", "portion_grams": 100})
        assert r.status_code in (401, 403)
