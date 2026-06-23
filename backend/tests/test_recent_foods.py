"""Recent-Foods autocomplete tests."""
import os
import sys
import uuid

import httpx
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

API_URL = os.environ.get("BACKEND_URL", "http://localhost:8001/api")


async def _register(client: httpx.AsyncClient, email: str, name: str = "Recent Test"):
    r = await client.post(f"{API_URL}/auth/register", json={"email": email, "password": "Test1234!", "name": name})
    r.raise_for_status()
    return r.json()


def _hdr(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


async def _log(cx: httpx.AsyncClient, tok: str, name: str, kcal: float = 100):
    return await cx.post(f"{API_URL}/nutrition/log", headers=_hdr(tok), json={
        "food_name": name, "portion_grams": 100, "calories": kcal,
        "protein_g": 5, "carbs_g": 20, "fat_g": 3, "fiber_g": 2, "sugar_g": 8, "sodium_mg": 50,
        "meal_type": "snack",
    })


@pytest.mark.asyncio
async def test_recent_foods_returns_unique_by_name_with_frequency():
    async with httpx.AsyncClient(timeout=20) as cx:
        u = await _register(cx, f"rec_{uuid.uuid4().hex[:8]}@example.com")
        tok = u["token"]
        # Log 3× Banane, 1× Apfel, 1× Pizza
        for _ in range(3):
            await _log(cx, tok, "Banane", 89)
        await _log(cx, tok, "Apfel", 52)
        await _log(cx, tok, "Pizza Margherita", 780)

        r = await cx.get(f"{API_URL}/nutrition/recent-foods", headers=_hdr(tok))
        assert r.status_code == 200
        items = r.json()["items"]
        names = [i["food_name"] for i in items]
        assert len(items) == 3, f"Expected 3 unique foods, got: {names}"
        # Banane must be first (highest count)
        assert items[0]["food_name"] == "Banane"
        assert items[0]["count"] == 3


@pytest.mark.asyncio
async def test_recent_foods_search_filter():
    async with httpx.AsyncClient(timeout=20) as cx:
        u = await _register(cx, f"rec2_{uuid.uuid4().hex[:8]}@example.com")
        tok = u["token"]
        for n in ("Banane", "Apfel", "Birne", "Brot"):
            await _log(cx, tok, n)
        # Search "ban" → only Banane
        r = await cx.get(f"{API_URL}/nutrition/recent-foods?q=ban", headers=_hdr(tok))
        items = r.json()["items"]
        assert len(items) == 1
        assert items[0]["food_name"] == "Banane"
        # Search "B" case-insensitive → multiple
        r = await cx.get(f"{API_URL}/nutrition/recent-foods?q=B", headers=_hdr(tok))
        names = {i["food_name"] for i in r.json()["items"]}
        assert {"Banane", "Birne", "Brot"}.issubset(names)


@pytest.mark.asyncio
async def test_recent_foods_returns_last_logged_macros():
    """When same food logged with different macros, latest values are returned."""
    async with httpx.AsyncClient(timeout=20) as cx:
        u = await _register(cx, f"rec3_{uuid.uuid4().hex[:8]}@example.com")
        tok = u["token"]
        await _log(cx, tok, "Müsli", 100)
        await _log(cx, tok, "Müsli", 350)  # newer
        r = await cx.get(f"{API_URL}/nutrition/recent-foods", headers=_hdr(tok))
        item = r.json()["items"][0]
        assert item["calories"] == 350.0, f"Expected newest calories=350, got {item['calories']}"
        assert item["count"] == 2


@pytest.mark.asyncio
async def test_recent_foods_isolated_per_user():
    async with httpx.AsyncClient(timeout=20) as cx:
        u1 = await _register(cx, f"recA_{uuid.uuid4().hex[:8]}@example.com")
        u2 = await _register(cx, f"recB_{uuid.uuid4().hex[:8]}@example.com")
        await _log(cx, u1["token"], "Banane")
        await _log(cx, u2["token"], "Apfel")
        r = await cx.get(f"{API_URL}/nutrition/recent-foods", headers=_hdr(u1["token"]))
        names = {i["food_name"] for i in r.json()["items"]}
        assert names == {"Banane"}
