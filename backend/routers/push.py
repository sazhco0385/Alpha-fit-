"""Push notifications router (Web Push / VAPID) - extracted from server.py.
Endpoints only. Shared helpers (_send_web_push, push_dispatcher_loop) stay in server.py."""
from fastapi import APIRouter, Depends, HTTPException
import logging

from server import (
    db, get_current_user, now_iso,
    VAPID_PUBLIC_KEY,
    PushSubscribeRequest, PushTestRequest,
    _send_web_push,
)

logger = logging.getLogger("alphafit")
router = APIRouter()


@router.get("/notifications/vapid-public-key")
async def push_vapid_public_key():
    if not VAPID_PUBLIC_KEY:
        raise HTTPException(status_code=503, detail="Push-Service nicht konfiguriert")
    return {"public_key": VAPID_PUBLIC_KEY}


@router.post("/notifications/subscribe")
async def push_subscribe(payload: PushSubscribeRequest, user: dict = Depends(get_current_user)):
    """Save a Web Push subscription. Replaces any existing subscription for this user+endpoint."""
    sub = {
        "user_id": user["id"],
        "endpoint": payload.endpoint,
        "keys": payload.keys,
        "triggers": payload.triggers or {"workout_reminder": True, "streak_protect": True, "weekly_review": True},
        "reminder_time": payload.reminder_time or "18:00",
        "timezone_offset": int(payload.timezone_offset or 0),
        "created_at": now_iso(),
        "last_used_at": now_iso(),
    }
    await db.push_subscriptions.update_one(
        {"user_id": user["id"], "endpoint": payload.endpoint},
        {"$set": sub},
        upsert=True,
    )
    return {"ok": True}


@router.delete("/notifications/unsubscribe")
async def push_unsubscribe(endpoint: str, user: dict = Depends(get_current_user)):
    res = await db.push_subscriptions.delete_one({"user_id": user["id"], "endpoint": endpoint})
    return {"ok": True, "deleted": res.deleted_count}


@router.get("/notifications/settings")
async def push_settings(user: dict = Depends(get_current_user)):
    subs = await db.push_subscriptions.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).to_list(20)
    return {"subscriptions": subs}


@router.put("/notifications/settings")
async def push_settings_update(payload: PushSubscribeRequest, user: dict = Depends(get_current_user)):
    """Update triggers/reminder_time for an existing subscription."""
    await db.push_subscriptions.update_one(
        {"user_id": user["id"], "endpoint": payload.endpoint},
        {"$set": {
            "triggers": payload.triggers or {"workout_reminder": True, "streak_protect": True, "weekly_review": True},
            "reminder_time": payload.reminder_time or "18:00",
            "timezone_offset": int(payload.timezone_offset or 0),
        }},
    )
    return {"ok": True}


@router.post("/notifications/test")
async def push_test(payload: PushTestRequest, user: dict = Depends(get_current_user)):
    """Send a test push to all of the user's subscriptions."""
    subs = await db.push_subscriptions.find({"user_id": user["id"]}, {"_id": 0}).to_list(10)
    sent = 0
    for s in subs:
        if _send_web_push(s, payload.title, payload.body, "/dashboard", "test"):
            sent += 1
    return {"ok": True, "subscriptions": len(subs), "sent": sent}
