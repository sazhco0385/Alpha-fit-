"""Progress Photos router — body photos with gym-light filter, gallery & compare slider."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import uuid
import logging

from server import db, get_current_user, now_iso, strip_base64_prefix

logger = logging.getLogger("alphafit")
router = APIRouter()


POSES = {"front", "side", "back", "free"}


class PhotoCreate(BaseModel):
    image_base64: str = Field(..., min_length=100)  # client should compress to <500KB before upload
    pose: str = "front"
    note: Optional[str] = ""
    weight_kg: Optional[float] = None
    from_body_scan: bool = False
    body_scan_id: Optional[str] = None


def _validate_pose(p: str) -> str:
    p = (p or "").lower().strip()
    return p if p in POSES else "front"


@router.post("/progress-photos")
async def create_photo(payload: PhotoCreate, user: dict = Depends(get_current_user)):
    img = strip_base64_prefix(payload.image_base64)
    if not img or len(img) < 100:
        raise HTTPException(status_code=400, detail="Foto-Daten ungültig.")
    # Soft cap ~ 4 MB base64 (= ~3 MB binary) to stay under Mongo doc limit and to enforce client compression
    if len(img) > 4_500_000:
        raise HTTPException(status_code=413, detail="Foto zu groß. Bitte vorher komprimieren (max ~3 MB).")
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "image_base64": img,
        "pose": _validate_pose(payload.pose),
        "note": (payload.note or "").strip()[:500],
        "weight_kg": float(payload.weight_kg) if payload.weight_kg is not None else None,
        "from_body_scan": bool(payload.from_body_scan),
        "body_scan_id": (payload.body_scan_id or None),
        "created_at": now_iso(),
    }
    await db.progress_photos.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "photo": doc}


@router.get("/progress-photos")
async def list_photos(user: dict = Depends(get_current_user), pose: Optional[str] = None, limit: int = 60):
    q: dict = {"user_id": user["id"]}
    if pose:
        q["pose"] = _validate_pose(pose)
    photos = await db.progress_photos.find(q, {"_id": 0}).sort("created_at", -1).limit(max(1, min(limit, 200))).to_list(200)
    return {"photos": photos, "total": await db.progress_photos.count_documents({"user_id": user["id"]})}


@router.get("/progress-photos/compare")
async def compare_photos(user: dict = Depends(get_current_user), pose: Optional[str] = None):
    """Returns the OLDEST and the LATEST photo (optionally filtered by pose) for the compare slider."""
    q: dict = {"user_id": user["id"]}
    if pose:
        q["pose"] = _validate_pose(pose)
    first = await db.progress_photos.find_one(q, {"_id": 0}, sort=[("created_at", 1)])
    last = await db.progress_photos.find_one(q, {"_id": 0}, sort=[("created_at", -1)])
    if not first or not last or first.get("id") == last.get("id"):
        return {"first": first, "last": None, "has_comparison": False}
    return {"first": first, "last": last, "has_comparison": True}


@router.get("/progress-photos/{photo_id}")
async def get_photo(photo_id: str, user: dict = Depends(get_current_user)):
    p = await db.progress_photos.find_one({"id": photo_id, "user_id": user["id"]}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Foto nicht gefunden")
    return p


@router.delete("/progress-photos/{photo_id}")
async def delete_photo(photo_id: str, user: dict = Depends(get_current_user)):
    res = await db.progress_photos.delete_one({"id": photo_id, "user_id": user["id"]})
    return {"ok": True, "deleted": res.deleted_count}
