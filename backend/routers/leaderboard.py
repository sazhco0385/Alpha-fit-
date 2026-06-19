"""Leaderboard router - Phase C of social features.

A single flexible endpoint that returns ranked users for various
metric/period/scope combinations.

Metrics:
  - workouts    -> count of completed workout_sessions in period
  - volume      -> sum of reps*weight_kg from logged_sets in period
  - streak      -> current consecutive-day streak (period is ignored)

Periods (for workouts/volume only): 7d | 30d | all
Scopes: friends (current user + accepted friends) | global (top users overall)

Response shape:
{
  "metric": "...",
  "period": "...",
  "scope": "...",
  "rows": [{rank, user_id, name, is_premium, value, is_self}, ...],
  "you": {rank, value} | null,   # always set when scope=friends; for global only when user is in top-N
  "generated_at": iso
}
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import logging

from server import db, get_current_user, now_iso

logger = logging.getLogger("alphafit")
router = APIRouter()


# ===== Helpers =====
async def _accepted_friend_ids(user_id: str) -> List[str]:
    rows = await db.friendships.find(
        {"status": "accepted", "$or": [{"from_user_id": user_id}, {"to_user_id": user_id}]},
        {"_id": 0, "from_user_id": 1, "to_user_id": 1},
    ).to_list(2000)
    ids = []
    for r in rows:
        other = r["to_user_id"] if r["from_user_id"] == user_id else r["from_user_id"]
        ids.append(other)
    return ids


def _period_start_iso(period: str) -> Optional[str]:
    if period == "7d":
        return (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    if period == "30d":
        return (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    return None  # "all" -> no lower bound


async def _aggregate_workouts(candidate_ids: Optional[List[str]], since_iso: Optional[str], limit: int) -> List[dict]:
    """Returns [{user_id, value}] sorted desc by count."""
    match = {"status": "completed"}
    if candidate_ids is not None:
        match["user_id"] = {"$in": candidate_ids}
    if since_iso:
        match["completed_at"] = {"$gte": since_iso}
    pipeline = [
        {"$match": match},
        {"$group": {"_id": "$user_id", "value": {"$sum": 1}}},
        {"$sort": {"value": -1}},
        {"$limit": int(limit)},
    ]
    return [{"user_id": r["_id"], "value": float(r["value"])} async for r in db.workout_sessions.aggregate(pipeline)]


async def _aggregate_volume(candidate_ids: Optional[List[str]], since_iso: Optional[str], limit: int) -> List[dict]:
    match = {"status": "completed"}
    if candidate_ids is not None:
        match["user_id"] = {"$in": candidate_ids}
    if since_iso:
        match["completed_at"] = {"$gte": since_iso}
    pipeline = [
        {"$match": match},
        {"$unwind": "$logged_sets"},
        {"$group": {
            "_id": "$user_id",
            "value": {"$sum": {"$multiply": [
                {"$ifNull": ["$logged_sets.reps", 0]},
                {"$ifNull": ["$logged_sets.weight_kg", 0]},
            ]}},
        }},
        {"$sort": {"value": -1}},
        {"$limit": int(limit)},
    ]
    rows = []
    async for r in db.workout_sessions.aggregate(pipeline):
        rows.append({"user_id": r["_id"], "value": round(float(r["value"]), 1)})
    return rows


async def _streak_rows(candidate_ids: List[str], limit: int) -> List[dict]:
    """Compute current-streak for each candidate user. Bounded N keeps cost ok."""
    from routers.sessions import calculate_streak
    out = []
    for uid in candidate_ids:
        s = await calculate_streak(uid)
        if s > 0:
            out.append({"user_id": uid, "value": float(s)})
    out.sort(key=lambda r: r["value"], reverse=True)
    return out[:limit]


async def _global_streak_candidates(limit: int = 200) -> List[str]:
    """Pre-filter for global streak: users with a completed workout in last 7d.
    Streak by definition needs recent activity."""
    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    pipeline = [
        {"$match": {"status": "completed", "completed_at": {"$gte": since}}},
        {"$group": {"_id": "$user_id"}},
        {"$limit": int(limit)},
    ]
    return [r["_id"] async for r in db.workout_sessions.aggregate(pipeline)]


async def _hydrate_rows(rows: List[dict], current_user_id: str) -> List[dict]:
    if not rows:
        return []
    ids = [r["user_id"] for r in rows]
    users = await db.users.find(
        {"id": {"$in": ids}},
        {"_id": 0, "id": 1, "name": 1, "is_premium": 1},
    ).to_list(len(ids) + 1)
    by_id = {u["id"]: u for u in users}
    out = []
    for idx, r in enumerate(rows):
        u = by_id.get(r["user_id"]) or {}
        out.append({
            "rank": idx + 1,
            "user_id": r["user_id"],
            "name": u.get("name") or "Unknown",
            "is_premium": bool(u.get("is_premium")),
            "value": r["value"],
            "is_self": r["user_id"] == current_user_id,
        })
    return out


METRIC_LABELS = {"workouts": "Workouts", "volume": "Volumen", "streak": "Streak"}


# ===== Endpoint =====
@router.get("/leaderboard")
async def get_leaderboard(
    metric: str = Query("workouts", pattern="^(workouts|volume|streak)$"),
    period: str = Query("30d", pattern="^(7d|30d|all)$"),
    scope: str = Query("friends", pattern="^(friends|global)$"),
    limit: int = Query(50, ge=1, le=100),
    user: dict = Depends(get_current_user),
) -> dict:
    uid = user["id"]
    since_iso = _period_start_iso(period)

    # Determine candidate user set
    if scope == "friends":
        friend_ids = await _accepted_friend_ids(uid)
        candidate_ids = list(set(friend_ids + [uid]))
    else:
        candidate_ids = None  # signal "global" (use as None in aggregations)

    # Compute rows per metric
    if metric == "workouts":
        rows = await _aggregate_workouts(candidate_ids, since_iso, limit)
    elif metric == "volume":
        rows = await _aggregate_volume(candidate_ids, since_iso, limit)
    else:  # streak
        if scope == "friends":
            streak_candidates = candidate_ids
        else:
            streak_candidates = await _global_streak_candidates(limit=200)
        rows = await _streak_rows(streak_candidates, limit)

    hydrated = await _hydrate_rows(rows, uid)

    # Compute "you" - always present for friends scope, optional for global
    you = next((h for h in hydrated if h["is_self"]), None)
    if you is None:
        # User not in top-N. Compute their value standalone (only if relevant scope).
        if scope == "friends":
            # User is always in candidate_ids but value might be 0 -> they got dropped by streak filter.
            you_value = 0.0
        elif metric == "streak":
            from routers.sessions import calculate_streak
            you_value = float(await calculate_streak(uid))
        else:
            # Compute single-user value via aggregation
            single = await (
                _aggregate_workouts([uid], since_iso, 1) if metric == "workouts"
                else _aggregate_volume([uid], since_iso, 1)
            )
            you_value = single[0]["value"] if single else 0.0
        you = {"rank": None, "user_id": uid, "name": user.get("name"), "is_premium": bool(user.get("is_premium")), "value": you_value, "is_self": True}

    return {
        "metric": metric,
        "metric_label": METRIC_LABELS[metric],
        "period": period,
        "scope": scope,
        "rows": hydrated,
        "you": you,
        "generated_at": now_iso(),
    }
