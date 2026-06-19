"""Sessions / Plans router - extracted from server.py.
Includes: workout session lifecycle (start/log/complete), training plan retrieval,
badge calculation on completion, streak + volume helpers, and auto-plan-adjust trigger."""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
import asyncio
import uuid
import logging

from server import (
    db, get_current_user, now_iso, log_activity,
    _send_web_push, _perform_plan_adjust,
    LogSetRequest,
)

logger = logging.getLogger("alphafit")
router = APIRouter()


@router.get("/plans/current")
async def get_current_plan(user: dict = Depends(get_current_user)):
    plan_id = user.get("current_plan_id")
    if not plan_id:
        return {"plan": None}
    plan = await db.training_plans.find_one({"id": plan_id}, {"_id": 0})
    return {"plan": plan}


# ===== Workout Sessions =====
@router.post("/sessions/start")
async def start_session(payload: dict, user: dict = Depends(get_current_user)):
    day_index = int(payload.get("day_index", 1))
    # If active session for this day exists, return it (resume)
    active = await db.workout_sessions.find_one(
        {"user_id": user["id"], "day_index": day_index, "status": "active"},
        {"_id": 0}
    )
    if active:
        return {"session": active, "resumed": True}

    plan_id = user.get("current_plan_id")
    if not plan_id:
        raise HTTPException(status_code=400, detail="Kein aktiver Plan")

    session = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "plan_id": plan_id,
        "day_index": day_index,
        "status": "active",
        "current_exercise_index": 0,
        "current_set_index": 0,
        "logged_sets": [],
        "started_at": now_iso(),
        "completed_at": None,
    }
    await db.workout_sessions.insert_one(session)
    session.pop("_id", None)
    day_index_val = session.get("day_index")
    await log_activity(user["id"], user.get("name", ""), "workout_started", {"day_index": day_index_val})
    return {"session": session, "resumed": False}

@router.get("/sessions/active")
async def get_active_session(user: dict = Depends(get_current_user)):
    s = await db.workout_sessions.find_one(
        {"user_id": user["id"], "status": "active"}, {"_id": 0}
    )
    return {"session": s}

@router.post("/sessions/log-set")
async def log_set(payload: LogSetRequest, user: dict = Depends(get_current_user)):
    session = await db.workout_sessions.find_one({"id": payload.session_id, "user_id": user["id"]}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session nicht gefunden")
    logged = session.get("logged_sets", [])
    logged.append({
        "exercise_index": payload.exercise_index,
        "set_index": payload.set_index,
        "reps": payload.reps,
        "weight_kg": payload.weight_kg,
        "completed_at": now_iso(),
    })
    await db.workout_sessions.update_one(
        {"id": payload.session_id},
        {"$set": {
            "logged_sets": logged,
            "current_exercise_index": payload.exercise_index,
            "current_set_index": payload.set_index + 1,
        }}
    )
    return {"ok": True, "logged_count": len(logged)}

@router.post("/sessions/update-progress")
async def update_progress(payload: dict, user: dict = Depends(get_current_user)):
    """Save current exercise/set pointer (when user moves between exercises)."""
    sid = payload.get("session_id")
    s = await db.workout_sessions.find_one({"id": sid, "user_id": user["id"]}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Session nicht gefunden")
    await db.workout_sessions.update_one(
        {"id": sid},
        {"$set": {
            "current_exercise_index": int(payload.get("exercise_index", 0)),
            "current_set_index": int(payload.get("set_index", 0)),
        }}
    )
    return {"ok": True}

@router.post("/sessions/complete")
async def complete_session(payload: dict, user: dict = Depends(get_current_user)):
    sid = payload.get("session_id")
    s = await db.workout_sessions.find_one({"id": sid, "user_id": user["id"]}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Session nicht gefunden")
    await db.workout_sessions.update_one(
        {"id": sid},
        {"$set": {"status": "completed", "completed_at": now_iso()}}
    )
    await log_activity(user["id"], user.get("name", ""), "workout_completed", {"day_index": s.get("day_index"), "sets": len(s.get("logged_sets", []))})
    # Reload user + sessions for badge calc
    user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    badges = user.get("badges", [])
    existing_ids = {b["id"] for b in badges}
    new_badges = []

    # 1) WORKOUT COUNT BADGES
    completed_count = await db.workout_sessions.count_documents({"user_id": user["id"], "status": "completed"})
    workout_def = [
        (1, "first_workout", "Erstes Blut", "1 Training absolviert"),
        (3, "warm_up", "Aufgewärmt", "3 Trainings absolviert"),
        (5, "five_workouts", "5er Streak", "5 Trainings absolviert"),
        (10, "ten_workouts", "Eisenwille", "10 Trainings absolviert"),
        (15, "fifteen", "Stahlhart", "15 Trainings absolviert"),
        (25, "warrior", "Krieger", "25 Trainings absolviert"),
        (40, "granite", "Granit", "40 Trainings absolviert"),
        (50, "alpha", "Alpha", "50 Trainings - Du bist Alpha"),
        (75, "titan", "Titan", "75 Trainings absolviert"),
        (100, "centurion", "Zenturio", "100 Trainings - Legende"),
        (150, "spartan", "Spartaner", "150 Trainings absolviert"),
        (200, "olympian", "Olympier", "200 Trainings absolviert"),
        (300, "demigod", "Halbgott", "300 Trainings absolviert"),
        (365, "year_warrior", "Jahres-Krieger", "365 Trainings - Ein Jahr Eisen"),
        (500, "immortal", "Unsterblich", "500 Trainings absolviert"),
        (750, "myth", "Mythos", "750 Trainings absolviert"),
        (1000, "legend", "Legende", "1000 Trainings - Gott-Tier"),
    ]
    for threshold, bid, title, desc in workout_def:
        if completed_count >= threshold and bid not in existing_ids:
            new_badges.append({"id": bid, "title": title, "description": desc, "earned_at": now_iso()})

    # 2) STREAK BADGES (consecutive days with workouts)
    streak = await calculate_streak(user["id"])
    streak_def = [
        (3, "streak_3", "3-Tage Streak", "3 Tage in Folge trainiert"),
        (7, "streak_7", "Wochen-Krieger", "7 Tage in Folge trainiert"),
        (14, "streak_14", "Zwei-Wochen Fokus", "14 Tage in Folge trainiert"),
        (30, "streak_30", "Monats-Beast", "30 Tage in Folge trainiert"),
        (60, "streak_60", "Konsistenz-King", "60 Tage in Folge trainiert"),
        (100, "streak_100", "Eiserne Disziplin", "100 Tage in Folge trainiert"),
    ]
    for threshold, bid, title, desc in streak_def:
        if streak >= threshold and bid not in existing_ids:
            new_badges.append({"id": bid, "title": title, "description": desc, "earned_at": now_iso()})

    # 3) VOLUME BADGES (total kg lifted across all sessions)
    total_volume = await calculate_total_volume(user["id"])
    volume_def = [
        (10000, "vol_10t", "10 Tonnen Club", "10.000 kg insgesamt gehoben"),
        (50000, "vol_50t", "50 Tonnen Club", "50.000 kg insgesamt gehoben"),
        (100000, "vol_100t", "100 Tonnen Club", "100.000 kg insgesamt gehoben"),
        (250000, "vol_250t", "Quarter Million", "250.000 kg insgesamt gehoben"),
        (500000, "vol_500t", "Halbe Million", "500.000 kg insgesamt gehoben"),
        (1000000, "vol_1m", "Millionär", "1.000.000 kg insgesamt gehoben"),
    ]
    for threshold, bid, title, desc in volume_def:
        if total_volume >= threshold and bid not in existing_ids:
            new_badges.append({"id": bid, "title": title, "description": desc, "earned_at": now_iso()})

    if new_badges:
        await db.users.update_one({"id": user["id"]}, {"$push": {"badges": {"$each": new_badges}}})

    # ===== Auto Plan-Anpassung (nach kompletter Trainingswoche) =====
    await _maybe_trigger_auto_plan_adjust(user)

    return {
        "ok": True,
        "new_badges": new_badges,
        "total_completed": completed_count,
        "current_streak": streak,
        "total_volume_kg": total_volume,
    }


async def _maybe_trigger_auto_plan_adjust(user: dict) -> None:
    """Wenn der User in den letzten 7 Tagen jeden Plan-Tag mindestens 1× abgeschlossen hat
    UND die letzte Auto-Anpassung mind. 6 Tage her ist → starte einen Plan-Adjust Job im Hintergrund.
    Sendet bei Erfolg einen Push 'Plan wurde angepasst'."""
    try:
        plan_id = user.get("current_plan_id")
        if not plan_id:
            return
        plan = await db.training_plans.find_one({"id": plan_id}, {"_id": 0})
        if not plan or not plan.get("days"):
            return

        last_auto = user.get("last_auto_adjust_at")
        if last_auto:
            try:
                last_dt = datetime.fromisoformat(str(last_auto).replace("Z", "+00:00"))
                if (datetime.now(timezone.utc) - last_dt).days < 6:
                    return
            except Exception:
                pass

        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        recent = await db.workout_sessions.find(
            {"user_id": user["id"], "status": "completed", "completed_at": {"$gte": week_ago}},
            {"_id": 0, "day_index": 1},
        ).to_list(200)
        done_indices = {s.get("day_index") for s in recent if s.get("day_index") is not None}
        plan_indices = {d.get("day_index") for d in plan["days"] if d.get("day_index") is not None}
        if not plan_indices or not plan_indices.issubset(done_indices):
            return  # not all days completed yet this cycle

        # Avoid spawning a duplicate job
        existing = await db.plan_adjust_jobs.find_one(
            {"user_id": user["id"], "status": "pending"}, {"_id": 0}
        )
        if existing:
            return

        job_id = str(uuid.uuid4())
        await db.plan_adjust_jobs.insert_one({
            "id": job_id,
            "user_id": user["id"],
            "status": "pending",
            "created_at": now_iso(),
            "plan_id": plan_id,
            "source": "auto_weekly",
        })
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"last_auto_adjust_at": now_iso()}}
        )
        asyncio.create_task(_run_auto_adjust_then_notify(job_id, user, plan))
    except Exception as e:
        logger.error(f"_maybe_trigger_auto_plan_adjust error: {e}")


async def _run_auto_adjust_then_notify(job_id: str, user: dict, plan: dict) -> None:
    """Background: same as _run_adjust_job + sends push notification on success."""
    try:
        new_plan = await asyncio.wait_for(_perform_plan_adjust(user, plan), timeout=180)
        await db.plan_adjust_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "done", "plan": new_plan, "finished_at": now_iso()}},
        )
        # Push notification to all subs of this user
        subs = await db.push_subscriptions.find({"user_id": user["id"]}, {"_id": 0}).to_list(10)
        for s in subs:
            _send_web_push(
                s,
                title="🛡️ Plan automatisch angepasst",
                body=f"Du hast eine Woche durchgezogen. Coach hat dir '{new_plan.get('name','dein Plan')}' gebaut.",
                url="/plan",
                tag="auto-plan-adjust",
            )
    except asyncio.TimeoutError:
        await db.plan_adjust_jobs.update_one(
            {"id": job_id}, {"$set": {"status": "error", "error": "Timeout", "finished_at": now_iso()}},
        )
    except Exception as e:
        logger.error(f"auto-adjust job {job_id} failed: {e}")
        await db.plan_adjust_jobs.update_one(
            {"id": job_id}, {"$set": {"status": "error", "error": "Auto-Anpassung fehlgeschlagen", "finished_at": now_iso()}},
        )

async def calculate_streak(user_id: str) -> int:
    """Berechnet die aktuelle Streak (konsekutive Tage mit abgeschlossenem Training)."""
    sessions = await db.workout_sessions.find(
        {"user_id": user_id, "status": "completed"}, {"_id": 0, "completed_at": 1}
    ).sort("completed_at", -1).to_list(500)
    if not sessions:
        return 0
    # Convert to date strings (YYYY-MM-DD), unique sorted desc
    dates = sorted({(s.get("completed_at") or "")[:10] for s in sessions if s.get("completed_at")}, reverse=True)
    if not dates:
        return 0
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    yesterday_str = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    # Streak only valid if last training is today or yesterday
    if dates[0] != today_str and dates[0] != yesterday_str:
        return 0
    streak = 1
    for i in range(1, len(dates)):
        prev_date = datetime.fromisoformat(dates[i-1])
        curr_date = datetime.fromisoformat(dates[i])
        if (prev_date - curr_date).days == 1:
            streak += 1
        else:
            break
    return streak

async def calculate_total_volume(user_id: str) -> float:
    """Summiert das Gesamtvolumen (reps * weight_kg) aller abgeschlossenen Sessions."""
    pipeline = [
        {"$match": {"user_id": user_id, "status": "completed"}},
        {"$unwind": "$logged_sets"},
        {"$group": {
            "_id": None,
            "total": {"$sum": {"$multiply": ["$logged_sets.reps", "$logged_sets.weight_kg"]}}
        }}
    ]
    result = await db.workout_sessions.aggregate(pipeline).to_list(1)
    return result[0]["total"] if result else 0

@router.get("/sessions/history")
async def session_history(user: dict = Depends(get_current_user)):
    sessions = await db.workout_sessions.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("started_at", -1).to_list(50)
    return {"sessions": sessions}

@router.get("/sessions/stats")
async def user_stats(user: dict = Depends(get_current_user)):
    """Streak + Volume + Workout-Count für Dashboard."""
    completed_count = await db.workout_sessions.count_documents({"user_id": user["id"], "status": "completed"})
    streak = await calculate_streak(user["id"])
    total_volume = await calculate_total_volume(user["id"])
    return {
        "total_completed": completed_count,
        "current_streak": streak,
        "total_volume_kg": total_volume,
    }

@router.get("/sessions/suggestion/{day_index}/{exercise_index}")
async def progression_suggestion(day_index: int, exercise_index: int, user: dict = Depends(get_current_user)):
    """KI-Progressions-Empfehlung für eine Übung basierend auf bisheriger Performance."""
    plan_id = user.get("current_plan_id")
    if not plan_id:
        return {"has_history": False, "message": "Kein Plan aktiv"}
    plan = await db.training_plans.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        return {"has_history": False, "message": "Plan nicht gefunden"}

    day = next((d for d in plan["days"] if d["day_index"] == day_index), None)
    if not day or exercise_index >= len(day.get("exercises", [])):
        return {"has_history": False, "message": "Übung nicht gefunden"}

    target_ex = day["exercises"][exercise_index]
    target_reps = target_ex.get("reps", 0)
    target_weight = target_ex.get("weight_kg", 0)

    # Get last 3 completed sessions for this day
    sessions = await db.workout_sessions.find(
        {"user_id": user["id"], "day_index": day_index, "status": "completed"}, {"_id": 0}
    ).sort("completed_at", -1).to_list(3)

    if not sessions:
        return {
            "has_history": False,
            "target_weight": target_weight,
            "target_reps": target_reps,
            "suggested_weight": target_weight,
            "suggested_reps": target_reps,
            "message": "Erstes Mal - Starte mit dem Zielgewicht.",
            "delta_weight": 0,
        }

    # Collect logged sets for this exercise across sessions
    history = []
    for s in sessions:
        for log in s.get("logged_sets", []):
            if log.get("exercise_index") == exercise_index:
                history.append({
                    "reps": log.get("reps", 0),
                    "weight_kg": log.get("weight_kg", 0),
                    "completed_at": log.get("completed_at"),
                })

    if not history:
        return {
            "has_history": False,
            "target_weight": target_weight,
            "target_reps": target_reps,
            "suggested_weight": target_weight,
            "suggested_reps": target_reps,
            "message": "Noch keine Daten für diese Übung.",
            "delta_weight": 0,
        }

    # Last session performance (sets of last session only)
    last_session = sessions[0]
    last_sets = [log for log in last_session.get("logged_sets", []) if log.get("exercise_index") == exercise_index]
    if not last_sets:
        last_sets = history[:1]

    avg_reps = sum(s["reps"] for s in last_sets) / len(last_sets)
    last_weight = last_sets[-1].get("weight_kg", target_weight)

    # Progression logic
    if avg_reps >= target_reps:
        # Hit all reps -> increase weight
        increment = 2.5 if last_weight < 50 else 5.0
        suggested_weight = last_weight + increment
        suggested_reps = target_reps
        msg = f"Letztes Mal: {int(avg_reps)} Whdh @ {last_weight}kg sauber. Steigere auf {suggested_weight}kg."
        delta = increment
    elif avg_reps >= target_reps - 2:
        # Close to target -> keep weight, push reps
        suggested_weight = last_weight
        suggested_reps = target_reps
        msg = f"Letztes Mal: {int(avg_reps)} Whdh @ {last_weight}kg. Heute auf {target_reps} pushen."
        delta = 0
    else:
        # Undershoot -> reduce weight
        decrement = 2.5
        suggested_weight = max(0, last_weight - decrement)
        suggested_reps = target_reps
        msg = f"Letztes Mal: nur {int(avg_reps)} Whdh @ {last_weight}kg. Reduziere auf {suggested_weight}kg."
        delta = -decrement

    return {
        "has_history": True,
        "target_weight": target_weight,
        "target_reps": target_reps,
        "suggested_weight": suggested_weight,
        "suggested_reps": suggested_reps,
        "last_weight": last_weight,
        "last_avg_reps": round(avg_reps, 1),
        "message": msg,
        "delta_weight": delta,
    }
