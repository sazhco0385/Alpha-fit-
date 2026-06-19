"""Friends router - search by display name + friendship requests + friend list.
Phase A of social features."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid
import logging

from server import db, get_current_user, now_iso, log_activity, _send_web_push

logger = logging.getLogger("alphafit")
router = APIRouter()


async def _push_friend_request(to_user_id: str, from_name: str) -> None:
    """Send a push notification to recipient when a friend request is sent.
    Respects push prefs (treats this as workout_reminder-class fallback if no specific flag)."""
    try:
        subs = await db.push_subscriptions.find({"user_id": to_user_id}, {"_id": 0}).to_list(10)
        for s in subs:
            _send_web_push(
                s,
                title="Neue Freundschaftsanfrage 👋",
                body=f"{from_name} möchte dein Freund werden",
                url="/friends",
                tag="friend_request",
            )
    except Exception as e:
        logger.error(f"push friend_request failed for {to_user_id}: {e}")


async def _push_friend_accepted(to_user_id: str, friend_name: str) -> None:
    try:
        subs = await db.push_subscriptions.find({"user_id": to_user_id}, {"_id": 0}).to_list(10)
        for s in subs:
            _send_web_push(
                s,
                title="Freundschaftsanfrage angenommen 🤝",
                body=f"Du und {friend_name} seid jetzt Freunde",
                url="/friends",
                tag="friend_accepted",
            )
    except Exception as e:
        logger.error(f"push friend_accepted failed for {to_user_id}: {e}")


# ===== Schemas =====
class FriendRequestCreate(BaseModel):
    to_user_id: str


class FriendActionRequest(BaseModel):
    request_id: str


class PublicUserSlim(BaseModel):
    id: str
    name: str
    is_friend: bool = False
    request_status: Optional[str] = None  # None | "outgoing_pending" | "incoming_pending"


# ===== Helpers =====
async def _friendship_status(user_id: str, other_id: str) -> tuple[bool, Optional[str], Optional[str]]:
    """Returns (is_friend, request_status_for_user, friendship_id_if_any).
    request_status is one of: None | 'outgoing_pending' | 'incoming_pending' | 'friend'."""
    if user_id == other_id:
        return False, "self", None
    f = await db.friendships.find_one(
        {"$or": [
            {"from_user_id": user_id, "to_user_id": other_id},
            {"from_user_id": other_id, "to_user_id": user_id},
        ]},
        {"_id": 0},
    )
    if not f:
        return False, None, None
    if f["status"] == "accepted":
        return True, "friend", f["id"]
    # pending
    if f["from_user_id"] == user_id:
        return False, "outgoing_pending", f["id"]
    return False, "incoming_pending", f["id"]


# ===== Endpoints =====
@router.get("/friends/search")
async def friends_search(q: str, user: dict = Depends(get_current_user)) -> dict:
    """Case-insensitive substring search on user.name. Min 2 chars. Max 20 results."""
    q = (q or "").strip()
    if len(q) < 2:
        return {"results": []}
    import re
    rx = re.compile(re.escape(q), re.IGNORECASE)
    rows = await db.users.find(
        {"name": {"$regex": rx}, "id": {"$ne": user["id"]}},
        {"_id": 0, "id": 1, "name": 1, "is_premium": 1, "created_at": 1},
    ).limit(20).to_list(20)

    results = []
    for r in rows:
        is_friend, status, _fid = await _friendship_status(user["id"], r["id"])
        results.append({
            "id": r["id"],
            "name": r["name"],
            "is_premium": bool(r.get("is_premium")),
            "is_friend": is_friend,
            "request_status": status,
        })
    return {"results": results, "query": q}


@router.post("/friends/request")
async def friends_send_request(payload: FriendRequestCreate, user: dict = Depends(get_current_user)) -> dict:
    if payload.to_user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Du kannst dir nicht selbst eine Anfrage schicken")
    target = await db.users.find_one({"id": payload.to_user_id}, {"_id": 0, "id": 1, "name": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User nicht gefunden")
    is_friend, status, _ = await _friendship_status(user["id"], payload.to_user_id)
    if is_friend:
        raise HTTPException(status_code=400, detail="Ihr seid bereits Freunde")
    if status in ("outgoing_pending", "incoming_pending"):
        raise HTTPException(status_code=400, detail="Es gibt bereits eine offene Anfrage")
    fr = {
        "id": str(uuid.uuid4()),
        "from_user_id": user["id"],
        "from_user_name": user.get("name", ""),
        "to_user_id": payload.to_user_id,
        "to_user_name": target.get("name", ""),
        "status": "pending",
        "created_at": now_iso(),
        "accepted_at": None,
    }
    await db.friendships.insert_one(fr)
    await log_activity(user["id"], user.get("name", ""), "friend_request_sent", {"to": target.get("name")})
    # Fire-and-forget push to recipient
    import asyncio as _aio
    _aio.create_task(_push_friend_request(payload.to_user_id, user.get("name") or "Jemand"))
    fr.pop("_id", None)
    return {"ok": True, "friendship": fr}


@router.post("/friends/accept")
async def friends_accept(payload: FriendActionRequest, user: dict = Depends(get_current_user)) -> dict:
    fr = await db.friendships.find_one({"id": payload.request_id, "to_user_id": user["id"], "status": "pending"}, {"_id": 0})
    if not fr:
        raise HTTPException(status_code=404, detail="Anfrage nicht gefunden")
    await db.friendships.update_one(
        {"id": payload.request_id},
        {"$set": {"status": "accepted", "accepted_at": now_iso()}},
    )
    await log_activity(user["id"], user.get("name", ""), "friend_accepted", {"with": fr.get("from_user_name")})
    # Notify the original requester
    import asyncio as _aio
    _aio.create_task(_push_friend_accepted(fr["from_user_id"], user.get("name") or "Jemand"))
    return {"ok": True}


@router.post("/friends/decline")
async def friends_decline(payload: FriendActionRequest, user: dict = Depends(get_current_user)) -> dict:
    res = await db.friendships.delete_one(
        {"id": payload.request_id, "to_user_id": user["id"], "status": "pending"},
    )
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Anfrage nicht gefunden")
    return {"ok": True}


@router.post("/friends/cancel")
async def friends_cancel(payload: FriendActionRequest, user: dict = Depends(get_current_user)) -> dict:
    """Cancel a request YOU sent."""
    res = await db.friendships.delete_one(
        {"id": payload.request_id, "from_user_id": user["id"], "status": "pending"},
    )
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Anfrage nicht gefunden")
    return {"ok": True}


@router.delete("/friends/{friend_id}")
async def friends_unfriend(friend_id: str, user: dict = Depends(get_current_user)) -> dict:
    res = await db.friendships.delete_one({
        "status": "accepted",
        "$or": [
            {"from_user_id": user["id"], "to_user_id": friend_id},
            {"from_user_id": friend_id, "to_user_id": user["id"]},
        ],
    })
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Freundschaft nicht gefunden")
    return {"ok": True}


@router.get("/friends/list")
async def friends_list(user: dict = Depends(get_current_user)) -> dict:
    """Returns accepted friends + pending incoming + pending outgoing.
    Each friend entry includes lightweight stats (streak + last 30d workouts)."""
    uid = user["id"]
    # accepted
    accepted = await db.friendships.find(
        {"status": "accepted", "$or": [{"from_user_id": uid}, {"to_user_id": uid}]},
        {"_id": 0},
    ).to_list(500)
    # incoming pending
    incoming = await db.friendships.find(
        {"status": "pending", "to_user_id": uid},
        {"_id": 0},
    ).sort("created_at", -1).to_list(100)
    # outgoing pending
    outgoing = await db.friendships.find(
        {"status": "pending", "from_user_id": uid},
        {"_id": 0},
    ).sort("created_at", -1).to_list(100)

    # Hydrate friends with names + lightweight stats
    from datetime import timedelta
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    friends_out = []
    for f in accepted:
        other_id = f["to_user_id"] if f["from_user_id"] == uid else f["from_user_id"]
        u = await db.users.find_one({"id": other_id}, {"_id": 0, "id": 1, "name": 1, "is_premium": 1})
        if not u:
            continue
        wo_count = await db.workout_sessions.count_documents({
            "user_id": other_id, "status": "completed", "completed_at": {"$gte": thirty_days_ago},
        })
        friends_out.append({
            "friendship_id": f["id"],
            "id": u["id"],
            "name": u["name"],
            "is_premium": bool(u.get("is_premium")),
            "workouts_30d": wo_count,
            "since": f.get("accepted_at"),
        })
    # sort by workouts desc (mini leaderboard preview)
    friends_out.sort(key=lambda x: x["workouts_30d"], reverse=True)

    return {
        "friends": friends_out,
        "incoming_requests": incoming,
        "outgoing_requests": outgoing,
        "counts": {
            "friends": len(friends_out),
            "incoming": len(incoming),
            "outgoing": len(outgoing),
        },
    }


@router.get("/friends/profile/{user_id}")
async def friends_profile(user_id: str, user: dict = Depends(get_current_user)) -> dict:
    """Public profile of another user (requires being friends or self)."""
    if user_id == user["id"]:
        target = user
    else:
        is_friend, _, _ = await _friendship_status(user["id"], user_id)
        if not is_friend:
            raise HTTPException(status_code=403, detail="Nur Freunde können Profile sehen")
        target = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not target:
            raise HTTPException(status_code=404, detail="User nicht gefunden")

    from datetime import timedelta
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    workouts_total = await db.workout_sessions.count_documents({"user_id": user_id, "status": "completed"})
    workouts_30d = await db.workout_sessions.count_documents({
        "user_id": user_id, "status": "completed", "completed_at": {"$gte": thirty_days_ago},
    })
    # current streak (simple version)
    from routers.sessions import calculate_streak
    streak = await calculate_streak(user_id)

    return {
        "id": target["id"],
        "name": target.get("name"),
        "is_premium": bool(target.get("is_premium")),
        "created_at": target.get("created_at"),
        "workouts_total": workouts_total,
        "workouts_30d": workouts_30d,
        "current_streak": streak,
        "badges": target.get("badges") or [],
    }
