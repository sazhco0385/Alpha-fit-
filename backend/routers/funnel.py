"""Funnel/Attribution tracker for marketing attribution.

Records click events from URL `?from=<source>` parameters so we can compute
conversion rates from each funnel (trial_reminder, win_back, ads, etc.).

When a user hits /premium?from=trial_reminder, the frontend POSTs to /track/funnel.
On checkout creation, we attach the most-recent funnel_source to the transaction
so admin can compute Email → Click → Checkout → Purchase rates.
"""
from fastapi import APIRouter, Depends
from typing import Optional
from pydantic import BaseModel
import uuid
import logging

from server import db, get_current_user, now_iso

logger = logging.getLogger("alphafit")
router = APIRouter()


class FunnelTrackRequest(BaseModel):
    event: str  # e.g. "trial_reminder_click"
    source: Optional[str] = None  # e.g. "trial_reminder"


@router.post("/track/funnel")
async def track_funnel(payload: FunnelTrackRequest, user: dict = Depends(get_current_user)):
    """Record a funnel click. Sets user.last_funnel_source for attribution on next checkout."""
    src = (payload.source or "").strip()[:60] or _source_from_event(payload.event)
    if not src:
        return {"ok": False, "reason": "no_source"}
    await db.funnel_events.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "event": payload.event[:80],
        "source": src,
        "created_at": now_iso(),
    })
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_funnel_source": src, "last_funnel_source_at": now_iso()}},
    )
    return {"ok": True, "source": src}


def _source_from_event(event: str) -> str:
    if not event:
        return ""
    e = event.lower()
    if "trial_reminder" in e:
        return "trial_reminder"
    if "winback" in e or "win_back" in e:
        return "winback"
    if "weekly" in e:
        return "weekly_summary"
    return e.split("_")[0][:60]
