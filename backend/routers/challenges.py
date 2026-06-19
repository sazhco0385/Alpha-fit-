"""Challenges router - social challenges between friends.
Phase B of social features.

A challenge has:
  - A creator who auto-joins
  - One or more invited friends
  - A metric (workouts | volume_kg | active_days)
  - A target value to reach
  - A time window [start_at, end_at]

Progress is computed on-the-fly from workout_sessions in the window so we
don't need a separate progress collection. When `now > end_at` we lazily
resolve the winner on the next list/detail call.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
import asyncio
import uuid
import logging

from server import db, get_current_user, now_iso, log_activity, _send_web_push

logger = logging.getLogger("alphafit")
router = APIRouter()


# ===== Schemas =====
MetricType = Literal["workouts", "volume_kg", "active_days"]


class ChallengeCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=80)
    description: Optional[str] = Field("", max_length=300)
    metric: MetricType
    target: float = Field(..., gt=0)
    days: int = Field(..., ge=1, le=60)  # duration in days from now
    invitee_ids: List[str] = Field(default_factory=list)


class ChallengeAction(BaseModel):
    challenge_id: str


# ===== Helpers =====
METRIC_LABELS = {
    "workouts": "Workouts",
    "volume_kg": "Volumen (kg)",
    "active_days": "Trainings-Tage",
}


def _parse_iso(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return None


async def _compute_progress(user_id: str, metric: str, start_at: str, end_at: str) -> float:
    """Compute a single participant's progress for the given metric in the window."""
    if metric == "workouts":
        return float(await db.workout_sessions.count_documents({
            "user_id": user_id,
            "status": "completed",
            "completed_at": {"$gte": start_at, "$lte": end_at},
        }))
    if metric == "volume_kg":
        sessions = await db.workout_sessions.find(
            {"user_id": user_id, "status": "completed", "completed_at": {"$gte": start_at, "$lte": end_at}},
            {"_id": 0, "logged_sets": 1},
        ).to_list(2000)
        total = 0.0
        for s in sessions:
            for set_ in s.get("logged_sets", []) or []:
                try:
                    total += float(set_.get("reps") or 0) * float(set_.get("weight_kg") or 0)
                except Exception:
                    continue
        return round(total, 1)
    if metric == "active_days":
        sessions = await db.workout_sessions.find(
            {"user_id": user_id, "status": "completed", "completed_at": {"$gte": start_at, "$lte": end_at}},
            {"_id": 0, "completed_at": 1},
        ).to_list(2000)
        days = {(s.get("completed_at") or "")[:10] for s in sessions if s.get("completed_at")}
        days.discard("")
        return float(len(days))
    return 0.0


async def _are_friends(uid_a: str, uid_b: str) -> bool:
    if uid_a == uid_b:
        return True
    f = await db.friendships.find_one({
        "status": "accepted",
        "$or": [
            {"from_user_id": uid_a, "to_user_id": uid_b},
            {"from_user_id": uid_b, "to_user_id": uid_a},
        ],
    }, {"_id": 0, "id": 1})
    return bool(f)


async def _hydrate_user(uid: str) -> dict:
    u = await db.users.find_one({"id": uid}, {"_id": 0, "id": 1, "name": 1, "is_premium": 1})
    return u or {"id": uid, "name": "Unknown", "is_premium": False}


async def _push_to_user(user_id: str, title: str, body: str, tag: str) -> None:
    try:
        subs = await db.push_subscriptions.find({"user_id": user_id}, {"_id": 0}).to_list(10)
        for s in subs:
            _send_web_push(s, title=title, body=body, url="/challenges", tag=tag)
    except Exception as e:
        logger.error(f"push challenge {tag} failed for {user_id}: {e}")


async def _resolve_if_ended(challenge: dict) -> dict:
    """If a challenge's end time has passed and it's still active, resolve winner
    and push notifications. Returns the (possibly updated) challenge dict."""
    if challenge.get("status") != "active":
        return challenge
    end_dt = _parse_iso(challenge.get("end_at"))
    if not end_dt or datetime.now(timezone.utc) <= end_dt:
        return challenge

    metric = challenge["metric"]
    start_at = challenge["start_at"]
    end_at = challenge["end_at"]
    target = float(challenge.get("target") or 0)
    participants = challenge.get("participants") or []

    # Compute final progress for each participant
    rows = []
    for pid in participants:
        val = await _compute_progress(pid, metric, start_at, end_at)
        rows.append({"user_id": pid, "value": val})
    rows.sort(key=lambda r: r["value"], reverse=True)
    top = rows[0] if rows else None
    winner_id = None
    reached_target = False
    if top and top["value"] > 0:
        winner_id = top["user_id"]
        reached_target = top["value"] >= target

    await db.challenges.update_one(
        {"id": challenge["id"]},
        {"$set": {
            "status": "completed",
            "resolved_at": now_iso(),
            "winner_user_id": winner_id,
            "final_standings": rows,
            "target_reached": reached_target,
        }},
    )
    challenge["status"] = "completed"
    challenge["resolved_at"] = now_iso()
    challenge["winner_user_id"] = winner_id
    challenge["final_standings"] = rows
    challenge["target_reached"] = reached_target

    # Notify all participants
    winner_name = "Niemand"
    if winner_id:
        wu = await _hydrate_user(winner_id)
        winner_name = wu.get("name") or "Sieger"
    title = challenge.get("title") or "Challenge"
    body = f"Sieger: {winner_name} 🏆" if winner_id else "Niemand hat Fortschritt gemacht."
    for pid in participants:
        asyncio.create_task(_push_to_user(pid, f"Challenge beendet: {title}", body, "challenge_ended"))
    return challenge


async def _serialize(challenge: dict, current_user_id: str) -> dict:
    """Serialize a challenge with hydrated participant info + live progress (if active)."""
    participants = challenge.get("participants") or []
    invites = challenge.get("invites") or []

    creator = await _hydrate_user(challenge.get("created_by") or "")

    # Compute progress per participant (live for active, stored for completed)
    standings = []
    if challenge.get("status") == "completed" and challenge.get("final_standings"):
        for row in challenge["final_standings"]:
            u = await _hydrate_user(row["user_id"])
            standings.append({
                "user_id": row["user_id"],
                "name": u.get("name"),
                "is_premium": bool(u.get("is_premium")),
                "value": row["value"],
            })
    else:
        for pid in participants:
            u = await _hydrate_user(pid)
            val = await _compute_progress(pid, challenge["metric"], challenge["start_at"], challenge["end_at"])
            standings.append({
                "user_id": pid,
                "name": u.get("name"),
                "is_premium": bool(u.get("is_premium")),
                "value": val,
            })
        standings.sort(key=lambda r: r["value"], reverse=True)

    hydrated_invites = []
    for inv in invites:
        u = await _hydrate_user(inv["user_id"])
        hydrated_invites.append({
            "user_id": inv["user_id"],
            "name": u.get("name"),
            "status": inv.get("status"),
        })

    your_status = "outsider"
    if current_user_id in participants:
        your_status = "participant"
    else:
        for inv in invites:
            if inv["user_id"] == current_user_id and inv.get("status") == "pending":
                your_status = "invited"
                break

    winner = None
    if challenge.get("winner_user_id"):
        wu = await _hydrate_user(challenge["winner_user_id"])
        winner = {"user_id": challenge["winner_user_id"], "name": wu.get("name")}

    return {
        "id": challenge["id"],
        "title": challenge.get("title"),
        "description": challenge.get("description"),
        "metric": challenge["metric"],
        "metric_label": METRIC_LABELS.get(challenge["metric"], challenge["metric"]),
        "target": challenge.get("target"),
        "start_at": challenge.get("start_at"),
        "end_at": challenge.get("end_at"),
        "status": challenge.get("status"),
        "created_by": challenge.get("created_by"),
        "created_by_name": creator.get("name"),
        "created_at": challenge.get("created_at"),
        "participants_count": len(participants),
        "standings": standings,
        "invites": hydrated_invites,
        "winner": winner,
        "target_reached": bool(challenge.get("target_reached")),
        "your_status": your_status,
        "is_creator": challenge.get("created_by") == current_user_id,
    }


# ===== Endpoints =====
@router.post("/challenges")
async def create_challenge(payload: ChallengeCreate, user: dict = Depends(get_current_user)) -> dict:
    # Validate invitees are friends and de-dup
    invitee_ids = list({i for i in payload.invitee_ids if i and i != user["id"]})
    for inv in invitee_ids:
        if not await _are_friends(user["id"], inv):
            raise HTTPException(status_code=400, detail="Nur Freunde können eingeladen werden")

    start_dt = datetime.now(timezone.utc)
    end_dt = start_dt + timedelta(days=payload.days)
    challenge = {
        "id": str(uuid.uuid4()),
        "created_by": user["id"],
        "created_by_name": user.get("name"),
        "title": payload.title.strip(),
        "description": (payload.description or "").strip(),
        "metric": payload.metric,
        "target": float(payload.target),
        "start_at": start_dt.isoformat(),
        "end_at": end_dt.isoformat(),
        "status": "active",
        "participants": [user["id"]],
        "invites": [{"user_id": iid, "status": "pending", "invited_at": now_iso()} for iid in invitee_ids],
        "winner_user_id": None,
        "final_standings": None,
        "target_reached": False,
        "created_at": now_iso(),
    }
    await db.challenges.insert_one(challenge)
    challenge.pop("_id", None)
    await log_activity(user["id"], user.get("name", ""), "challenge_created", {"title": challenge["title"], "invitees": len(invitee_ids)})

    # Push invitees
    creator_name = user.get("name") or "Jemand"
    for iid in invitee_ids:
        asyncio.create_task(_push_to_user(
            iid,
            "Neue Challenge-Einladung ⚔️",
            f"{creator_name} hat dich zu '{challenge['title']}' eingeladen",
            "challenge_invite",
        ))

    return {"ok": True, "challenge": await _serialize(challenge, user["id"])}


@router.get("/challenges")
async def list_challenges(user: dict = Depends(get_current_user)) -> dict:
    """Returns active + invited + recently completed (last 14 days) challenges for the user."""
    uid = user["id"]

    # Active challenges where user participates
    active = await db.challenges.find({
        "status": "active",
        "participants": uid,
    }, {"_id": 0}).sort("created_at", -1).to_list(100)

    # Pending invites
    invited = await db.challenges.find({
        "status": "active",
        "invites": {"$elemMatch": {"user_id": uid, "status": "pending"}},
        "participants": {"$ne": uid},
    }, {"_id": 0}).sort("created_at", -1).to_list(100)

    # Recently completed (within last 14 days) where user participated
    cutoff = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
    completed = await db.challenges.find({
        "status": "completed",
        "participants": uid,
        "resolved_at": {"$gte": cutoff},
    }, {"_id": 0}).sort("resolved_at", -1).to_list(50)

    # Lazily resolve any expired actives
    resolved_now = []
    still_active = []
    for ch in active:
        new_ch = await _resolve_if_ended(ch)
        if new_ch.get("status") == "completed":
            resolved_now.append(new_ch)
        else:
            still_active.append(new_ch)

    out_active = [await _serialize(c, uid) for c in still_active]
    out_invited = [await _serialize(c, uid) for c in invited]
    out_completed = [await _serialize(c, uid) for c in (resolved_now + completed)]

    return {
        "active": out_active,
        "invited": out_invited,
        "completed": out_completed,
        "counts": {
            "active": len(out_active),
            "invited": len(out_invited),
            "completed": len(out_completed),
        },
    }


@router.get("/challenges/{challenge_id}")
async def get_challenge(challenge_id: str, user: dict = Depends(get_current_user)) -> dict:
    ch = await db.challenges.find_one({"id": challenge_id}, {"_id": 0})
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge nicht gefunden")
    # Visibility: participant or invited only
    uid = user["id"]
    is_participant = uid in (ch.get("participants") or [])
    is_invited = any(inv.get("user_id") == uid for inv in (ch.get("invites") or []))
    if not (is_participant or is_invited):
        raise HTTPException(status_code=403, detail="Kein Zugriff auf diese Challenge")
    ch = await _resolve_if_ended(ch)
    return {"challenge": await _serialize(ch, uid)}


@router.post("/challenges/accept")
async def accept_challenge(payload: ChallengeAction, user: dict = Depends(get_current_user)) -> dict:
    ch = await db.challenges.find_one({"id": payload.challenge_id}, {"_id": 0})
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge nicht gefunden")
    if ch.get("status") != "active":
        raise HTTPException(status_code=400, detail="Challenge ist nicht mehr aktiv")
    uid = user["id"]
    invites = ch.get("invites") or []
    my_inv = next((i for i in invites if i.get("user_id") == uid and i.get("status") == "pending"), None)
    if not my_inv:
        raise HTTPException(status_code=404, detail="Keine offene Einladung gefunden")

    await db.challenges.update_one(
        {"id": payload.challenge_id, "invites.user_id": uid},
        {"$set": {"invites.$.status": "accepted", "invites.$.responded_at": now_iso()},
         "$addToSet": {"participants": uid}},
    )
    await log_activity(uid, user.get("name", ""), "challenge_accepted", {"title": ch.get("title")})
    # Notify creator
    creator_id = ch.get("created_by")
    if creator_id and creator_id != uid:
        asyncio.create_task(_push_to_user(
            creator_id,
            "Challenge angenommen 🔥",
            f"{user.get('name') or 'Jemand'} ist deiner Challenge beigetreten",
            "challenge_accepted",
        ))
    return {"ok": True}


@router.post("/challenges/decline")
async def decline_challenge(payload: ChallengeAction, user: dict = Depends(get_current_user)) -> dict:
    res = await db.challenges.update_one(
        {"id": payload.challenge_id, "invites.user_id": user["id"], "invites.status": "pending"},
        {"$set": {"invites.$.status": "declined", "invites.$.responded_at": now_iso()}},
    )
    if res.modified_count == 0:
        raise HTTPException(status_code=404, detail="Einladung nicht gefunden")
    return {"ok": True}


@router.post("/challenges/leave")
async def leave_challenge(payload: ChallengeAction, user: dict = Depends(get_current_user)) -> dict:
    ch = await db.challenges.find_one({"id": payload.challenge_id}, {"_id": 0})
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge nicht gefunden")
    if ch.get("created_by") == user["id"]:
        raise HTTPException(status_code=400, detail="Als Ersteller kannst du nicht verlassen. Lösche die Challenge stattdessen.")
    if user["id"] not in (ch.get("participants") or []):
        raise HTTPException(status_code=404, detail="Du bist kein Teilnehmer")
    await db.challenges.update_one(
        {"id": payload.challenge_id},
        {"$pull": {"participants": user["id"]}},
    )
    return {"ok": True}


@router.delete("/challenges/{challenge_id}")
async def cancel_challenge(challenge_id: str, user: dict = Depends(get_current_user)) -> dict:
    ch = await db.challenges.find_one({"id": challenge_id}, {"_id": 0})
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge nicht gefunden")
    if ch.get("created_by") != user["id"]:
        raise HTTPException(status_code=403, detail="Nur der Ersteller kann eine Challenge löschen")
    await db.challenges.update_one(
        {"id": challenge_id},
        {"$set": {"status": "cancelled", "resolved_at": now_iso()}},
    )
    # Notify other participants
    for pid in (ch.get("participants") or []):
        if pid != user["id"]:
            asyncio.create_task(_push_to_user(
                pid,
                "Challenge abgebrochen",
                f"'{ch.get('title')}' wurde vom Ersteller beendet",
                "challenge_cancelled",
            ))
    return {"ok": True}
