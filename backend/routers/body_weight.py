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


class GoalWeightUpdate(BaseModel):
    goal_kg: Optional[float] = Field(None, gt=20, lt=400)  # null clears goal


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
    # Keep profile.weight_kg in sync so Dashboard, AI Coach & plan-adjust see the latest value.
    # Use whole-profile $set because new users may have profile=None (dot notation fails on null parent).
    current_profile = dict(user.get("profile") or {})
    current_profile["weight_kg"] = doc["weight_kg"]
    current_profile["weight_updated_at"] = doc["logged_at"]
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"profile": current_profile}},
    )
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

    # Goal info
    goal_kg = user.get("weight_goal_kg")
    goal_set_at = user.get("weight_goal_set_at")
    goal_baseline_kg = user.get("weight_goal_baseline_kg")  # weight at the moment goal was set
    goal_block = None
    if goal_kg and latest:
        current = float(latest["weight_kg"])
        baseline = float(goal_baseline_kg or current)
        target = float(goal_kg)
        # If goal == baseline (rare), treat as 100% to avoid divide-by-zero.
        total_distance = abs(target - baseline)
        if target == baseline:
            pct = 100.0
        else:
            # Going in the right direction: pct positive; going the wrong way: pct can be negative
            direction = 1 if target > baseline else -1
            signed_progress = (current - baseline) * direction
            pct = max(0.0, min(100.0, (signed_progress / total_distance) * 100.0))
        remaining_kg = round(target - current, 1)
        goal_block = {
            "goal_kg": round(target, 1),
            "baseline_kg": round(baseline, 1),
            "current_kg": round(current, 1),
            "remaining_kg": remaining_kg,
            "progress_pct": round(pct, 1),
            "direction": "lose" if target < baseline else ("gain" if target > baseline else "maintain"),
            "set_at": goal_set_at,
            "reached": (target < baseline and current <= target) or (target > baseline and current >= target),
        }

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
        "goal": goal_block,
    }


@router.delete("/body-weight/{entry_id}")
async def delete_log(entry_id: str, user: dict = Depends(get_current_user)) -> dict:
    res = await db.body_weight_logs.delete_one({"id": entry_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Eintrag nicht gefunden")
    return {"ok": True}


@router.put("/body-weight/goal")
async def set_goal(payload: GoalWeightUpdate, user: dict = Depends(get_current_user)) -> dict:
    """Set or update goal weight. Pass {goal_kg: null} to clear it."""
    if payload.goal_kg is None:
        await db.users.update_one(
            {"id": user["id"]},
            {"$unset": {"weight_goal_kg": "", "weight_goal_set_at": "", "weight_goal_baseline_kg": ""}},
        )
        return {"ok": True, "cleared": True}

    # Snapshot current weight as baseline (so progress bar is meaningful)
    latest = await db.body_weight_logs.find_one(
        {"user_id": user["id"]}, {"_id": 0}, sort=[("logged_at", -1)],
    )
    baseline = round(float(latest["weight_kg"]), 1) if latest else round(float(payload.goal_kg), 1)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "weight_goal_kg": round(float(payload.goal_kg), 1),
            "weight_goal_set_at": now_iso(),
            "weight_goal_baseline_kg": baseline,
        }},
    )
    return {"ok": True, "goal_kg": round(float(payload.goal_kg), 1), "baseline_kg": baseline}
