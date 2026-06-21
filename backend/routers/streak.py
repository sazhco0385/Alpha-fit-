"""Streak Freeze — Premium-only feature that bridges 1-day gaps in a streak.

Mechanics:
  - Premium users get 1 freeze on the 1st of each month (monthly refresh)
  - When calculating the streak, if there's exactly a 1-day gap between two
    workouts AND the user has freezes available, we consume a freeze and
    treat the gap as bridged.
  - Free users see the freeze count as 0 with a Premium upsell.
  - Manual "use freeze" is automatic (no UI action needed). The freeze is
    consumed on the day it's first observed in calculate_streak_with_freezes.
"""
from fastapi import APIRouter, Depends
from datetime import datetime, timezone
from typing import Optional
import logging

from server import db, get_current_user, now_iso

logger = logging.getLogger("alphafit")
router = APIRouter()


def _current_month_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


async def _refresh_monthly_freeze(user: dict) -> dict:
    """Grant 1 freeze on the 1st of each month for Premium users.
    Idempotent: only grants once per (user, month)."""
    if not user.get("is_premium"):
        return user
    current_month = _current_month_key()
    if user.get("streak_freeze_last_grant_month") == current_month:
        return user
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "streak_freezes_available": 1,
            "streak_freeze_last_grant_month": current_month,
            "streak_freeze_last_grant_at": now_iso(),
        }},
    )
    user["streak_freezes_available"] = 1
    user["streak_freeze_last_grant_month"] = current_month
    return user


async def consume_freeze_if_available(user_id: str, bridge_key: str = "") -> bool:
    """Atomically consume 1 freeze. Returns True if a freeze was consumed.
    Optionally records a bridge_key so the same gap is treated as already-bridged
    on subsequent streak calculations (no double-consume)."""
    push_doc: dict = {"streak_freezes_used_at": now_iso()}
    if bridge_key:
        push_doc["streak_freeze_bridges"] = bridge_key
    res = await db.users.update_one(
        {"id": user_id, "streak_freezes_available": {"$gt": 0}},
        {"$inc": {"streak_freezes_available": -1},
         "$push": push_doc},
    )
    return res.modified_count > 0


def _next_refresh_iso() -> str:
    """First day of next month, midnight UTC, as ISO."""
    now = datetime.now(timezone.utc)
    if now.month == 12:
        nxt = now.replace(year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        nxt = now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)
    return nxt.isoformat()


@router.get("/streak/status")
async def streak_status(user: dict = Depends(get_current_user)) -> dict:
    # Lazy refresh on read so users see fresh count after month rollover
    user = await _refresh_monthly_freeze(user)
    used = user.get("streak_freezes_used_at") or []
    used_this_month = [u for u in used if u and u[:7] == _current_month_key()]
    return {
        "is_premium": bool(user.get("is_premium")),
        "freezes_available": int(user.get("streak_freezes_available") or 0),
        "used_this_month": len(used_this_month),
        "next_refresh_at": _next_refresh_iso(),
        "monthly_allowance": 1,
    }
