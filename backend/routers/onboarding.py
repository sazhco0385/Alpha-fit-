"""Onboarding router (save profile + auto-generate first AI plan) - extracted from server.py."""
from fastapi import APIRouter, Depends
import logging

from server import (
    db, get_current_user, log_activity, generate_ai_plan,
    OnboardingData,
)

logger = logging.getLogger("alphafit")
router = APIRouter()


@router.post("/onboarding")
async def save_onboarding(data: OnboardingData, user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"profile": data.model_dump(), "onboarding_completed": True}}
    )
    await log_activity(user["id"], user.get("name", ""), "onboarding_completed", {"goal": data.goal})
    plan = await generate_ai_plan(user["id"], data.model_dump())
    return {"ok": True, "plan_id": plan["id"]}
