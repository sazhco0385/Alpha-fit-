"""Body weight tracking — daily log + history + stats."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid

from server import db, get_current_user, now_iso

router = APIRouter()


class WeightLogCreate(BaseModel):
    weight_kg: float = Field(..., gt=20, lt=400)
    note: Optional[str] = Field("", max_length=200)
    logged_at: Optional[str] = None  # ISO string, defaults to now


async def _latest_before(user_id: str, before_iso: str) -> Optional[dict]:
    return await db.body_weight_logs.find_one(
        {"user_id": user_id, "logged_at": {"$lte": before_iso}},
        {"_id": 0}, sort=[("logged_at", -1)],
    )


@router.post("/body-weight/log")
async def log_weight(payload: WeightLogCreate, user: dict = Depends(get_current_user)) -> dict:
    logged_at = payload.logged_at or now_iso()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "weight_kg": round(float(payload.weight_kg), 2),
        "note": (payload.note or "").strip(),
        "logged_at": logged_at,
        "created_at": now_iso(),
    }
    await db.body_weight_logs.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "entry": doc}


@router.get("/body-weight/history")
async def get_history(limit: int = 365, user: dict = Depends(get_current_user)) -> dict:
    rows = await db.body_weight_logs.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("logged_at", -1).limit(int(limit)).to_list(int(limit))

    # Stats
    latest = rows[0] if rows else None
    now = datetime.now(timezone.utc)
    iso_7d = (now - timedelta(days=7)).isoformat()
    iso_30d = (now - timedelta(days=30)).isoformat()
    iso_90d = (now - timedelta(days=90)).isoformat()
    weight_7d = await _latest_before(user["id"], iso_7d)
    weight_30d = await _latest_before(user["id"], iso_30d)
    weight_90d = await _latest_before(user["id"], iso_90d)
    first = await db.body_weight_logs.find_one(
        {"user_id": user["id"]}, {"_id": 0}, sort=[("logged_at", 1)],
    )

    def diff(curr: Optional[dict], prev: Optional[dict]) -> Optional[float]:
        if not curr or not prev:
            return None
        return round(float(curr["weight_kg"]) - float(prev["weight_kg"]), 1)

    return {
        "history": rows,
        "latest": latest,
        "stats": {
            "delta_7d": diff(latest, weight_7d),
            "delta_30d": diff(latest, weight_30d),
            "delta_90d": diff(latest, weight_90d),
            "delta_all": diff(latest, first) if first and latest and first["id"] != latest["id"] else None,
            "total_logs": len(rows),
        },
    }


@router.delete("/body-weight/{entry_id}")
async def delete_log(entry_id: str, user: dict = Depends(get_current_user)) -> dict:
    res = await db.body_weight_logs.delete_one({"id": entry_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Eintrag nicht gefunden")
    return {"ok": True}
