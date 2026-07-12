"""Muscle group statistics — count how often each muscle group was trained in the
last N weeks (default 4), returning a percentage vs. an ideal frequency baseline.

Baseline: 2 sessions per muscle group per week = 100 %. Capped at 100.
"""
from datetime import datetime, timedelta, timezone
from typing import Dict, List
from fastapi import APIRouter, Depends

from server import db, get_current_user

router = APIRouter()

# Canonical German muscle-group labels (matches plan.days[].exercises[].target_muscle)
_GROUPS: List[Dict] = [
    {"key": "brust",     "name": "Brust",     "aliases": ["brust", "chest", "pecs"]},
    {"key": "ruecken",   "name": "Rücken",    "aliases": ["ruecken", "rücken", "back", "lats", "latissimus"]},
    {"key": "beine",     "name": "Beine",     "aliases": ["beine", "legs", "quadriceps", "quads", "hamstrings", "waden", "calves"]},
    {"key": "schultern", "name": "Schultern", "aliases": ["schultern", "shoulders", "delts", "deltoids"]},
    {"key": "arme",      "name": "Arme",      "aliases": ["arme", "arms", "bizeps", "biceps", "trizeps", "triceps"]},
    {"key": "bauch",     "name": "Bauch",     "aliases": ["bauch", "core", "abs", "abdominals"]},
    {"key": "gesaess",   "name": "Gesäß",     "aliases": ["gesaess", "gesäß", "glutes", "po"]},
]


def _canonical_group(raw: str) -> str:
    if not raw:
        return ""
    s = str(raw).strip().lower()
    for g in _GROUPS:
        for a in g["aliases"]:
            if a in s:
                return g["key"]
    return ""


@router.get("/muscle-groups/stats")
async def muscle_group_stats(weeks: int = 4, user: dict = Depends(get_current_user)):
    weeks = max(1, min(12, int(weeks)))
    since = datetime.now(timezone.utc) - timedelta(weeks=weeks)
    since_iso = since.isoformat()

    # Get completed sessions in window
    sessions = await db.workout_sessions.find(
        {"user_id": user["id"], "status": "completed", "completed_at": {"$gte": since_iso}},
        {"_id": 0, "plan_id": 1, "day_index": 1, "logged_sets": 1},
    ).to_list(500)

    # Preload plans referenced (cache to avoid repeated fetches)
    plan_ids = list({s.get("plan_id") for s in sessions if s.get("plan_id")})
    plans = {}
    if plan_ids:
        async for p in db.training_plans.find({"id": {"$in": plan_ids}}, {"_id": 0, "id": 1, "days": 1}):
            plans[p["id"]] = p

    # Counts per group
    session_hits: Dict[str, int] = {g["key"]: 0 for g in _GROUPS}
    exercise_hits: Dict[str, int] = {g["key"]: 0 for g in _GROUPS}

    for s in sessions:
        plan = plans.get(s.get("plan_id"))
        if not plan:
            continue
        day = next((d for d in (plan.get("days") or []) if d.get("day_index") == s.get("day_index")), None)
        if not day:
            continue
        touched_this_session: set = set()
        # only count exercises where at least one set was logged
        logged_indices = {ls.get("exercise_index") for ls in (s.get("logged_sets") or []) if isinstance(ls.get("exercise_index"), int)}
        for i, ex in enumerate(day.get("exercises") or []):
            if i not in logged_indices:
                continue
            g = _canonical_group(ex.get("target_muscle") or ex.get("muscle_group") or "")
            if not g:
                continue
            exercise_hits[g] += 1
            touched_this_session.add(g)
        for g in touched_this_session:
            session_hits[g] += 1

    # Baseline: 2 sessions/week per group = 100 %
    baseline_sessions = 2 * weeks
    result = []
    for g in _GROUPS:
        hits = session_hits[g["key"]]
        pct = min(100, round((hits / baseline_sessions) * 100)) if baseline_sessions > 0 else 0
        result.append({
            "key": g["key"],
            "name": g["name"],
            "sessions_hit": hits,
            "exercises_completed": exercise_hits[g["key"]],
            "percent": pct,
        })
    return {
        "weeks": weeks,
        "baseline_sessions_per_group": baseline_sessions,
        "total_sessions": len(sessions),
        "groups": result,
    }
