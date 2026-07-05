"""Training-days router — lets the user pick which weekdays (Mon=0 … Sun=6) they train.
Falls back to a sensible default derived from `profile.days_per_week` when unset."""
from typing import List, Optional
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


def _resolve(user_doc: dict) -> List[int]:
    profile = user_doc.get("profile") or {}
    stored = profile.get("training_weekdays")
    if isinstance(stored, list) and all(isinstance(x, int) and 0 <= x <= 6 for x in stored):
        return sorted(set(stored))
    return derive_default_training_days(profile.get("days_per_week", 4))


@router.get("/profile/training-days")
async def get_training_days(user: dict = Depends(get_current_user)):
    profile = user.get("profile") or {}
    return {
        "weekdays": _resolve(user),
        "days_per_week": profile.get("days_per_week"),
        "is_custom": isinstance(profile.get("training_weekdays"), list),
    }


@router.put("/profile/training-days")
async def set_training_days(payload: TrainingDaysUpdate, user: dict = Depends(get_current_user)):
    wds = sorted({int(x) for x in payload.weekdays if isinstance(x, int) and 0 <= int(x) <= 6})
    if not wds:
        raise HTTPException(status_code=400, detail="Mindestens 1 Trainingstag wählen")
    profile = user.get("profile") or {}
    profile["training_weekdays"] = wds
    await db.users.update_one({"id": user["id"]}, {"$set": {"profile": profile}})
    return {"ok": True, "weekdays": wds}
