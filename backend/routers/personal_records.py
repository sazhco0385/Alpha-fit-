"""Personal Records (PR) detection & API.

A PR happens when a user lifts a weight×reps combination that beats their
previous best for that exercise. We use **estimated 1RM** (one-rep max) as
the canonical metric so that "100kg×5" and "110kg×3" can be compared fairly
across sets.

  e1rm = weight * (1 + reps/30)   (Epley formula)

For each completed session we look at every logged set, group by exercise,
and check if any set's e1RM beats the previous best.

Rarity is derived from % improvement (or set absolute weight thresholds):
  - bronze  : first-ever PR for that exercise OR <5% improvement
  - silver  : 5-12% improvement
  - gold    : 12-25% improvement OR weight >= 100kg
  - mythic  : 25%+ improvement OR weight >= 200kg OR triple-PR session
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime, timezone
import uuid
import logging

from server import db, get_current_user, now_iso

logger = logging.getLogger("alphafit")
router = APIRouter()


def _e1rm(weight: float, reps: int) -> float:
    """Epley estimated one-rep max."""
    if weight <= 0 or reps <= 0:
        return 0.0
    return round(float(weight) * (1.0 + reps / 30.0), 2)


def _rarity_for(weight: float, improvement_pct: float, multi_count: int = 1) -> str:
    if multi_count >= 3:
        return "mythic"
    if weight >= 200:
        return "mythic"
    if improvement_pct >= 25:
        return "mythic"
    if weight >= 100:
        return "gold"
    if improvement_pct >= 12:
        return "gold"
    if improvement_pct >= 5:
        return "silver"
    return "bronze"


async def detect_prs_for_session(session: dict, plan: Optional[dict] = None) -> list[dict]:
    """Check all logged sets for new PRs.
    Returns list of newly created PR documents.
    Should be called from the /sessions/complete endpoint right after status flip.
    """
    user_id = session.get("user_id")
    logged_sets = session.get("logged_sets") or []
    if not user_id or not logged_sets:
        return []

    # Build exercise name lookup from plan days
    exercise_names = {}
    if plan:
        for d in plan.get("days") or []:
            for idx, ex in enumerate(d.get("exercises") or []):
                # Multiple days may reuse exercises; use (day_index, ex_index) → name
                exercise_names[(d.get("day_index"), idx)] = (ex.get("name") or "").strip()

    # Group sets by exercise name
    day_index = session.get("day_index")
    by_exercise = {}
    for s in logged_sets:
        ex_idx = s.get("exercise_index")
        name = exercise_names.get((day_index, ex_idx)) or f"Übung #{(ex_idx or 0)+1}"
        if not name:
            continue
        by_exercise.setdefault(name, []).append(s)

    new_prs = []
    for name, sets in by_exercise.items():
        # Get best e1RM in THIS session for this exercise
        best_set = max(sets, key=lambda x: _e1rm(x.get("weight_kg") or 0, x.get("reps") or 0))
        weight = float(best_set.get("weight_kg") or 0)
        reps = int(best_set.get("reps") or 0)
        if weight <= 0 or reps <= 0:
            continue
        e1rm_new = _e1rm(weight, reps)

        # Fetch previous best for this user+exercise (last PR doc)
        prev = await db.personal_records.find_one(
            {"user_id": user_id, "exercise_name": name},
            {"_id": 0}, sort=[("e1rm", -1)],
        )
        prev_e1rm = float(prev.get("e1rm")) if prev else 0.0

        # Improvement check (must be > 0.5 kg improvement on e1RM to count)
        if e1rm_new <= prev_e1rm + 0.5:
            continue

        improvement_pct = ((e1rm_new - prev_e1rm) / prev_e1rm * 100.0) if prev_e1rm > 0 else 100.0
        rarity = _rarity_for(weight, improvement_pct if prev else 0)

        pr_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "exercise_name": name,
            "weight_kg": weight,
            "reps": reps,
            "e1rm": e1rm_new,
            "previous_e1rm": prev_e1rm,
            "improvement_pct": round(improvement_pct, 1) if prev else None,
            "is_first": not bool(prev),
            "rarity": rarity,
            "session_id": session.get("id"),
            "achieved_at": now_iso(),
        }
        new_prs.append(pr_doc)

    # Bump rarity for multi-PR sessions (3+) → mythic
    if len(new_prs) >= 3:
        for p in new_prs:
            p["rarity"] = "mythic"
            p["multi_pr"] = True

    if new_prs:
        await db.personal_records.insert_many([dict(p) for p in new_prs])

    return new_prs


# ===== Endpoints =====
@router.get("/personal-records")
async def list_personal_records(user: dict = Depends(get_current_user)) -> dict:
    """Returns the user's best PR per exercise, plus a flat history."""
    rows = await db.personal_records.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("achieved_at", -1).to_list(500)

    # Best per exercise (highest e1rm)
    best = {}
    for r in rows:
        name = r["exercise_name"]
        if name not in best or r["e1rm"] > best[name]["e1rm"]:
            best[name] = r
    best_list = sorted(best.values(), key=lambda x: x["e1rm"], reverse=True)
    return {
        "best_per_exercise": best_list,
        "history": rows,
        "total_prs": len(rows),
        "rarity_counts": {
            "bronze": sum(1 for r in rows if r.get("rarity") == "bronze"),
            "silver": sum(1 for r in rows if r.get("rarity") == "silver"),
            "gold":   sum(1 for r in rows if r.get("rarity") == "gold"),
            "mythic": sum(1 for r in rows if r.get("rarity") == "mythic"),
        },
    }


@router.get("/personal-records/{pr_id}")
async def get_pr(pr_id: str, user: dict = Depends(get_current_user)) -> dict:
    pr = await db.personal_records.find_one({"id": pr_id, "user_id": user["id"]}, {"_id": 0})
    if not pr:
        raise HTTPException(status_code=404, detail="PR nicht gefunden")
    # Hydrate user name for share card
    pr["user_name"] = user.get("name") or "Champion"
    return {"pr": pr}
