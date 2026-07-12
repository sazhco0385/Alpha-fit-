"""Plan history & rollback — lists all training-plan versions for the current user
and lets them re-activate an older version as the active plan."""
from fastapi import APIRouter, Depends, HTTPException
from server import db, get_current_user, now_iso

router = APIRouter()


@router.get("/coach/plan-history")
async def plan_history(user: dict = Depends(get_current_user), limit: int = 30):
    """All plans the user ever had, newest first. Marks the current active plan."""
    plans = await db.training_plans.find(
        {"user_id": user["id"]},
        {"_id": 0, "id": 1, "name": 1, "version": 1, "created_at": 1,
         "progression_notes": 1, "previous_plan_id": 1, "days": 1},
    ).sort("created_at", -1).to_list(min(limit, 100))
    current_id = user.get("current_plan_id")
    # Compact: count exercises per day + strip full exercise details
    for p in plans:
        p["day_count"] = len(p.get("days") or [])
        p["exercise_count"] = sum(len(d.get("exercises") or []) for d in (p.get("days") or []))
        # Focus summary of days
        p["day_focus"] = [d.get("focus") or d.get("name") or f"Tag {d.get('day_index')}" for d in (p.get("days") or [])]
        p.pop("days", None)
        p["is_current"] = (p["id"] == current_id)
    return {"plans": plans, "current_plan_id": current_id}


@router.post("/coach/plan-rollback/{plan_id}")
async def plan_rollback(plan_id: str, user: dict = Depends(get_current_user)):
    """Re-activate an older plan as the current one. Does NOT delete newer versions —
    they stay in history so the user can roll forward again if desired."""
    target = await db.training_plans.find_one({"id": plan_id, "user_id": user["id"]}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Plan nicht gefunden")
    await db.users.update_one({"id": user["id"]}, {"$set": {"current_plan_id": plan_id}})
    return {"ok": True, "current_plan_id": plan_id, "activated": {"id": target["id"], "name": target.get("name"), "version": target.get("version")}}
