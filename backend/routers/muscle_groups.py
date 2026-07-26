"""Muscle group statistics — count how often each muscle group was trained in the
last N weeks (default 4), returning a percentage.

Two modes:
- **relative** (default): each muscle % is scaled vs. the *most-hit* muscle in the window.
  This is the "heatmap" view — always exposes imbalances, always changes as training shifts.
- **absolute**: each muscle % is scaled vs. an ideal frequency baseline (3 sessions/week).
  Caps at 100. Useful for absolute goals like "have I hit shoulders enough?"
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
async def muscle_group_stats(weeks: int = 4, mode: str = "relative", user: dict = Depends(get_current_user)):
    weeks = max(1, min(12, int(weeks)))
    mode = mode if mode in ("relative", "absolute") else "relative"
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
    set_counts:   Dict[str, int] = {g["key"]: 0 for g in _GROUPS}

    for s in sessions:
        plan = plans.get(s.get("plan_id"))
        day = None
        if plan:
            day = next((d for d in (plan.get("days") or []) if d.get("day_index") == s.get("day_index")), None)
        touched_this_session: set = set()
        logged_sets = s.get("logged_sets") or []
        sets_per_ex: Dict[int, int] = {}
        for ls in logged_sets:
            i = ls.get("exercise_index")
            if isinstance(i, int):
                sets_per_ex[i] = sets_per_ex.get(i, 0) + 1

        # Prefer snapshotted target_muscle from the logged set itself (works even if plan is gone).
        # Fall back to plan-day lookup for older sessions that pre-date snapshotting.
        counted_exs: set = set()
        for ls in logged_sets:
            i = ls.get("exercise_index")
            raw = (ls.get("target_muscle") or "").strip()
            if not raw and day and isinstance(i, int):
                exs = day.get("exercises") or []
                if 0 <= i < len(exs):
                    raw = (exs[i].get("target_muscle") or exs[i].get("muscle_group") or "")
            g = _canonical_group(raw)
            if not g:
                continue
            set_counts[g] += 1
            if (i, g) not in counted_exs and isinstance(i, int):
                exercise_hits[g] += 1
                counted_exs.add((i, g))
            touched_this_session.add(g)
        for g in touched_this_session:
            session_hits[g] += 1

    # Compute percentages
    # Volume-weighted score (2× set-weighted + session bonus) exposes imbalances better than pure counts
    scores: Dict[str, float] = {g["key"]: session_hits[g["key"]] * 1.0 + set_counts[g["key"]] * 0.25 for g in _GROUPS}
    max_score = max(scores.values()) if scores else 0

    # Absolute baseline: 3 sessions/week per group ≈ 100 %
    baseline_sessions = 3 * weeks

    result = []
    for g in _GROUPS:
        key = g["key"]
        hits = session_hits[key]
        if mode == "relative":
            pct = round((scores[key] / max_score) * 100) if max_score > 0 else 0
        else:
            pct = min(100, round((hits / baseline_sessions) * 100)) if baseline_sessions > 0 else 0
        result.append({
            "key": key,
            "name": g["name"],
            "sessions_hit": hits,
            "exercises_completed": exercise_hits[key],
            "sets_logged": set_counts[key],
            "percent": pct,
        })
    return {
        "weeks": weeks,
        "mode": mode,
        "baseline_sessions_per_group": baseline_sessions,
        "total_sessions": len(sessions),
        "groups": result,
    }
