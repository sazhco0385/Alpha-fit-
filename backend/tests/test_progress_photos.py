"""Progress Photos backend tests."""
import os
import sys
import uuid
import base64

import httpx
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

API_URL = os.environ.get("BACKEND_URL", "http://localhost:8001/api")


async def _register(client: httpx.AsyncClient, email: str, name: str = "Photo Test"):
    r = await client.post(f"{API_URL}/auth/register", json={"email": email, "password": "Test1234!", "name": name})
    r.raise_for_status()
    return r.json()


def _hdr(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


def _data_url(bytes_count: int = 2000, char: str = "A") -> str:
    return "data:image/jpeg;base64," + base64.b64encode(char.encode() * bytes_count).decode()


@pytest.mark.asyncio
async def test_create_list_delete_photo():
    async with httpx.AsyncClient(timeout=15) as cx:
        u = await _register(cx, f"pp_{uuid.uuid4().hex[:8]}@example.com")
        tok = u["token"]
        # Upload
        r = await cx.post(f"{API_URL}/progress-photos", headers=_hdr(tok), json={
            "image_base64": _data_url(2000), "pose": "front", "weight_kg": 82.5, "note": "Day 0",
        })
        assert r.status_code == 200
        p = r.json()["photo"]
        assert p["pose"] == "front" and p["weight_kg"] == 82.5
        # List
        lst = (await cx.get(f"{API_URL}/progress-photos", headers=_hdr(tok))).json()
        assert lst["total"] == 1 and len(lst["photos"]) == 1
        # Get by id
        single = (await cx.get(f"{API_URL}/progress-photos/{p['id']}", headers=_hdr(tok))).json()
        assert single["id"] == p["id"]
        # Delete
        d = (await cx.delete(f"{API_URL}/progress-photos/{p['id']}", headers=_hdr(tok))).json()
        assert d["deleted"] == 1
        # Empty
        assert (await cx.get(f"{API_URL}/progress-photos", headers=_hdr(tok))).json()["total"] == 0


@pytest.mark.asyncio
async def test_pose_filter():
    async with httpx.AsyncClient(timeout=15) as cx:
        u = await _register(cx, f"pp2_{uuid.uuid4().hex[:8]}@example.com")
        tok = u["token"]
        for pose in ("front", "front", "side", "back"):
            await cx.post(f"{API_URL}/progress-photos", headers=_hdr(tok), json={
                "image_base64": _data_url(2000, pose[0]), "pose": pose,
            })
        front = (await cx.get(f"{API_URL}/progress-photos?pose=front", headers=_hdr(tok))).json()
        side = (await cx.get(f"{API_URL}/progress-photos?pose=side", headers=_hdr(tok))).json()
        assert len(front["photos"]) == 2
        assert len(side["photos"]) == 1
        # Invalid pose falls back to "front"
        fallback = (await cx.get(f"{API_URL}/progress-photos?pose=garbage", headers=_hdr(tok))).json()
        assert len(fallback["photos"]) == 2  # same as front


@pytest.mark.asyncio
async def test_compare_returns_first_and_last():
    async with httpx.AsyncClient(timeout=15) as cx:
        u = await _register(cx, f"pp3_{uuid.uuid4().hex[:8]}@example.com")
        tok = u["token"]
        # Single photo → no comparison
        await cx.post(f"{API_URL}/progress-photos", headers=_hdr(tok), json={
            "image_base64": _data_url(2000, "A"), "pose": "front",
        })
        c1 = (await cx.get(f"{API_URL}/progress-photos/compare", headers=_hdr(tok))).json()
        assert c1["has_comparison"] is False
        # Second photo → comparison
        await cx.post(f"{API_URL}/progress-photos", headers=_hdr(tok), json={
            "image_base64": _data_url(2000, "B"), "pose": "front",
        })
        c2 = (await cx.get(f"{API_URL}/progress-photos/compare", headers=_hdr(tok))).json()
        assert c2["has_comparison"] is True
        assert c2["first"]["created_at"] <= c2["last"]["created_at"]


@pytest.mark.asyncio
async def test_validation_rejects_tiny_payload():
    async with httpx.AsyncClient(timeout=10) as cx:
        u = await _register(cx, f"pp4_{uuid.uuid4().hex[:8]}@example.com")
        # Too short data → 422 (Pydantic min_length) or 400 (post-strip validation)
        r = await cx.post(f"{API_URL}/progress-photos", headers=_hdr(u["token"]), json={
            "image_base64": "data:image/jpeg;base64,AAAA", "pose": "front",
        })
        assert r.status_code in (400, 422)


@pytest.mark.asyncio
async def test_photos_isolated_per_user():
    async with httpx.AsyncClient(timeout=15) as cx:
        u1 = await _register(cx, f"pp5a_{uuid.uuid4().hex[:8]}@example.com")
        u2 = await _register(cx, f"pp5b_{uuid.uuid4().hex[:8]}@example.com")
        await cx.post(f"{API_URL}/progress-photos", headers=_hdr(u1["token"]), json={
            "image_base64": _data_url(2000), "pose": "front",
        })
        # u2 sees zero photos
        l = (await cx.get(f"{API_URL}/progress-photos", headers=_hdr(u2["token"]))).json()
        assert l["total"] == 0


@pytest.mark.asyncio
async def test_requires_auth():
    async with httpx.AsyncClient(timeout=10) as cx:
        r = await cx.get(f"{API_URL}/progress-photos")
        assert r.status_code in (401, 403)
        r = await cx.post(f"{API_URL}/progress-photos", json={"image_base64": _data_url(2000)})
        assert r.status_code in (401, 403)
