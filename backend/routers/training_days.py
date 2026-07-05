"""Training-days router — lets the user pick which weekdays (Mon=0 … Sun=6) they train.
Falls back to a sensible default derived from `profile.days_per_week` when unset.

Also stores an optional custom mapping of plan day_index → weekday so the user can
drag & drop specific training days onto specific weekdays."""
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from server import db, get_current_user

router = APIRouter()

# Default weekday selections keyed by days_per_week
_DEFAULTS = {
    1: [0],                     # Mo
    2: [0, 3],                  # Mo/Do
    3: [0, 2, 4],               # Mo/Mi/Fr
    4: [0, 1, 3, 4],            # Mo/Di/Do/Fr
    5: [0, 1, 2, 3, 4],         # Mo-Fr
    6: [0, 1, 2, 3, 4, 5],      # Mo-Sa
    7: [0, 1, 2, 3, 4, 5, 6],   # jeden Tag
}


def derive_default_training_days(days_per_week: int) -> List[int]:
    return list(_DEFAULTS.get(int(days_per_week or 4), _DEFAULTS[4]))


class TrainingDaysUpdate(BaseModel):
    weekdays: List[int] = Field(..., description="List of ints 0=Mon .. 6=Sun")


class PlanDayAssignmentUpdate(BaseModel):
    """Mapping of plan day_index (int) -> weekday (0=Mon..6=Sun).
    Pass an empty dict {} to clear the custom mapping (fall back to sequential)."""
    assignments: Dict[str, int] = Field(default_factory=dict)


def _resolve(user_doc: dict) -> List[int]:
    profile = user_doc.get("profile") or {}
    stored = profile.get("training_weekdays")
    if isinstance(stored, list) and all(isinstance(x, int) and 0 <= x <= 6 for x in stored):
        return sorted(set(stored))
    return derive_default_training_days(profile.get("days_per_week", 4))


def _resolve_assignments(user_doc: dict) -> Dict[str, int]:
    profile = user_doc.get("profile") or {}
    a = profile.get("plan_day_assignments")
    if isinstance(a, dict):
        # sanity filter
        return {str(k): int(v) for k, v in a.items() if isinstance(v, int) and 0 <= int(v) <= 6}
    return {}


@router.get("/profile/training-days")
async def get_training_days(user: dict = Depends(get_current_user)):
    profile = user.get("profile") or {}
    return {
        "weekdays": _resolve(user),
        "days_per_week": profile.get("days_per_week"),
        "is_custom": isinstance(profile.get("training_weekdays"), list),
        "plan_day_assignments": _resolve_assignments(user),
    }


@router.put("/profile/training-days")
async def set_training_days(payload: TrainingDaysUpdate, user: dict = Depends(get_current_user)):
    wds = sorted({int(x) for x in payload.weekdays if isinstance(x, int) and 0 <= int(x) <= 6})
    if not wds:
        raise HTTPException(status_code=400, detail="Mindestens 1 Trainingstag wählen")
    profile = user.get("profile") or {}
    profile["training_weekdays"] = wds
    # If we now have FEWER training weekdays than mapped plan days, drop the stale mapping entries
    existing_map = profile.get("plan_day_assignments") or {}
    if isinstance(existing_map, dict):
        filtered = {k: v for k, v in existing_map.items() if isinstance(v, int) and v in wds}
        profile["plan_day_assignments"] = filtered
    await db.users.update_one({"id": user["id"]}, {"$set": {"profile": profile}})
    return {"ok": True, "weekdays": wds}


@router.put("/profile/plan-day-assignments")
async def set_plan_day_assignments(payload: PlanDayAssignmentUpdate, user: dict = Depends(get_current_user)):
    """Set custom mapping of plan day_index -> weekday. Each weekday may only host ONE plan day.
    If the same weekday is assigned to multiple plan days, the last one wins (validated below)."""
    profile = user.get("profile") or {}
    training_wds = set(_resolve(user))
    cleaned: Dict[str, int] = {}
    seen_weekdays: set = set()
    for k, v in (payload.assignments or {}).items():
        try:
            di = int(k)
            wd = int(v)
        except (TypeError, ValueError):
            continue
        if wd < 0 or wd > 6:
            continue
        if wd not in training_wds:
            raise HTTPException(status_code=400, detail=f"Tag {di} ist auf einem Restday zugeordnet – erst Trainingstage anpassen.")
        if wd in seen_weekdays:
            raise HTTPException(status_code=400, detail=f"Wochentag {wd} ist mehrfach zugeordnet.")
        seen_weekdays.add(wd)
        cleaned[str(di)] = wd
    profile["plan_day_assignments"] = cleaned
    await db.users.update_one({"id": user["id"]}, {"$set": {"profile": profile}})
    return {"ok": True, "plan_day_assignments": cleaned}
