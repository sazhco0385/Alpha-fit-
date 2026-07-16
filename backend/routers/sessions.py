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


@router.put("/plans/current")
async def update_current_plan(payload: dict, user: dict = Depends(get_current_user)):
    """User-driven plan editing. Validates structure, bumps version, replaces current plan."""
    plan_id = user.get("current_plan_id")
    if not plan_id:
        raise HTTPException(status_code=400, detail="Kein aktiver Plan")
    current = await db.training_plans.find_one({"id": plan_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Plan nicht gefunden")

    name = (payload.get("name") or current.get("name") or "Mein Plan")[:120]
    progression_notes = (payload.get("progression_notes") or "")[:500]
    days_in = payload.get("days")
    if not isinstance(days_in, list) or not days_in:
        raise HTTPException(status_code=400, detail="Plan muss mindestens einen Tag haben")
    if len(days_in) > 7:
        raise HTTPException(status_code=400, detail="Maximal 7 Trainingstage")

    def _clean_exercise(ex, idx_for_error):
        if not isinstance(ex, dict):
            raise HTTPException(status_code=400, detail=f"Übung {idx_for_error}: ungültiges Format")
        ex_name = str(ex.get("name") or "").strip()
        if not ex_name:
            raise HTTPException(status_code=400, detail=f"Übung {idx_for_error}: Name fehlt")
        def _int(v, default, lo, hi):
            try:
                n = int(round(float(v))) if v is not None else default
                return max(lo, min(hi, n))
            except Exception:
                return default
        def _num(v, default, lo, hi):
            try:
                n = float(v) if v is not None else default
                return max(lo, min(hi, n))
            except Exception:
                return default
        return {
            "name": ex_name[:120],
            "target_muscle": str(ex.get("target_muscle") or "").strip()[:60],
            "sets": _int(ex.get("sets"), 3, 1, 20),
            "reps": _int(ex.get("reps"), 10, 1, 100),
            "weight_kg": round(_num(ex.get("weight_kg"), 0, 0, 1000), 2),
            "rest_seconds": _int(ex.get("rest_seconds") or ex.get("rest_sec"), 60, 0, 600),
            "notes": str(ex.get("notes") or "")[:300],
        }

    days_clean = []
    for di, d in enumerate(days_in):
        if not isinstance(d, dict):
            raise HTTPException(status_code=400, detail=f"Tag {di+1}: ungültiges Format")
        exercises = d.get("exercises") or []
        if not isinstance(exercises, list) or not exercises:
            raise HTTPException(status_code=400, detail=f"Tag {di+1}: mindestens 1 Übung erforderlich")
        if len(exercises) > 15:
            raise HTTPException(status_code=400, detail=f"Tag {di+1}: maximal 15 Übungen")
        clean_exs = [_clean_exercise(ex, f"{di+1}.{ei+1}") for ei, ex in enumerate(exercises)]
        days_clean.append({
            "day_index": di + 1,
            "name": (str(d.get("name") or f"Tag {di+1}")).strip()[:80],
            "exercises": clean_exs,
        })

    new_plan = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": name,
        "weeks": int(current.get("weeks", 4)),
        "progression_notes": progression_notes,
        "days": days_clean,
        "created_at": now_iso(),
        "version": int(current.get("version", 1)) + 1,
        "previous_plan_id": plan_id,
        "source": "user_edited",
    }
    await db.training_plans.insert_one(new_plan)
    new_plan.pop("_id", None)
    await db.users.update_one({"id": user["id"]}, {"$set": {"current_plan_id": new_plan["id"]}})
    await log_activity(user["id"], user.get("name", ""), "plan_edited", {"plan_id": new_plan["id"], "version": new_plan["version"]})
    return {"plan": new_plan}


@router.get("/plans/exercise-suggestions")
async def exercise_suggestions(user: dict = Depends(get_current_user)):
    """Curated list of exercises grouped by muscle for the plan editor's 'Add Exercise' UI."""
    return {
        "groups": [
            {"muscle": "Brust", "exercises": ["Bankdrücken", "Schrägbankdrücken Kurzhantel", "Schrägbankdrücken Langhantel", "Kurzhantel Fliegende", "Liegestütze", "Cable Crossover", "Dips"]},
            {"muscle": "Rücken", "exercises": ["Klimmzüge", "Langhantelrudern", "Latziehen", "Kurzhantelrudern einarmig", "T-Bar Rudern", "Kreuzheben", "Hyperextensions", "Face Pulls"]},
            {"muscle": "Schulter", "exercises": ["Schulterdrücken Langhantel", "Schulterdrücken Kurzhantel", "Seitheben", "Frontheben", "Reverse Flys", "Arnold Press", "Upright Row"]},
            {"muscle": "Beine", "exercises": ["Kniebeugen", "Beinpresse", "Ausfallschritte", "Rumänisches Kreuzheben", "Beinstrecker", "Beinbeuger", "Wadenheben", "Bulgarian Split Squats", "Hip Thrust"]},
            {"muscle": "Bizeps", "exercises": ["Langhantel Curl", "Kurzhantel Curl", "Hammer Curl", "Konzentrations Curl", "Preacher Curl"]},
            {"muscle": "Trizeps", "exercises": ["Trizeps Drücken Kabel", "French Press", "Dips eng", "Overhead Trizeps Extension", "Diamond Push-ups"]},
            {"muscle": "Bauch", "exercises": ["Crunches", "Beinheben hängend", "Plank", "Russian Twists", "Cable Crunches", "Ab Wheel Rollout"]},
            {"muscle": "Cardio", "exercises": ["Laufband", "Crosstrainer", "Rudergerät", "Stairmaster", "Fahrrad", "Burpees", "Box Jumps"]},
        ],
    }


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

    # Real-time PR check for cinematic feedback (does not persist — final persistence at session/complete)
    pr = None
    try:
        plan_id = user.get("current_plan_id")
        if plan_id:
            plan = await db.training_plans.find_one({"id": plan_id}, {"_id": 0})
            if plan:
                day = next((d for d in (plan.get("days") or []) if d.get("day_index") == session.get("day_index")), None)
                if day:
                    exs = day.get("exercises") or []
                    if 0 <= payload.exercise_index < len(exs):
                        ex_name = (exs[payload.exercise_index].get("name") or "").strip()
                        if ex_name:
                            from routers.personal_records import check_set_pr
                            pr = await check_set_pr(
                                user["id"], ex_name,
                                float(payload.weight_kg), int(payload.reps),
                                session_logged_sets=logged,
                                exercise_index=payload.exercise_index,
                            )
    except Exception as e:
        logger.warning(f"log-set PR check failed: {e}")

    return {"ok": True, "logged_count": len(logged), "pr": pr}

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

    # ===== Personal Records Detection =====
    plan_for_pr = None
    if s.get("plan_id"):
        plan_for_pr = await db.training_plans.find_one({"id": s["plan_id"]}, {"_id": 0})
    from routers.personal_records import detect_prs_for_session
    new_prs = await detect_prs_for_session(s, plan_for_pr)

    # ===== Auto Plan-Anpassung (nach kompletter Trainingswoche) =====
    await _maybe_trigger_auto_plan_adjust(user)

    return {
        "ok": True,
        "new_badges": new_badges,
        "new_prs": new_prs,
        "total_completed": completed_count,
        "current_streak": streak,
        "total_volume_kg": total_volume,
    }


async def _maybe_trigger_auto_plan_adjust(user: dict) -> None:
    """Triggers an AI plan-adjust job when EITHER:
      (a) the user completed every plan day at least once in the last 7 days, OR
      (b) the user logged ≥ 4 sessions AND last auto-adjust is more than 7 days ago.
    Cooldown: min 6 days between adjustments. Sends a push 'Plan wurde angepasst' on success.
    """
    try:
        plan_id = user.get("current_plan_id")
        if not plan_id:
            return
        plan = await db.training_plans.find_one({"id": plan_id}, {"_id": 0})
        if not plan or not plan.get("days"):
            return

        # Cooldown: 6 days minimum between adjustments
        last_auto = user.get("last_auto_adjust_at")
        days_since_last = 9999
        if last_auto:
            try:
                last_dt = datetime.fromisoformat(str(last_auto).replace("Z", "+00:00"))
                days_since_last = (datetime.now(timezone.utc) - last_dt).days
                if days_since_last < 6:
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

        full_cycle = bool(plan_indices) and plan_indices.issubset(done_indices)
        # Fallback: even if not all plan days hit yet, trigger after 4+ sessions and 7+ days since last adjust
        partial_with_volume = len(recent) >= 4 and (days_since_last >= 7)

        if not (full_cycle or partial_with_volume):
            return  # not enough data yet

        # Avoid spawning a duplicate job — but sweep stale ones (>5 min = orphaned by server restart)
        existing = await db.plan_adjust_jobs.find_one(
            {"user_id": user["id"], "status": "pending"}, {"_id": 0}
        )
        if existing:
            try:
                created = datetime.fromisoformat(str(existing.get("created_at", "")).replace("Z", "+00:00"))
                age_seconds = (datetime.now(timezone.utc) - created).total_seconds()
            except Exception:
                age_seconds = 99999
            if age_seconds < 5 * 60:
                return
            # Sweep the stale job so we can spawn a fresh one
            await db.plan_adjust_jobs.update_one(
                {"id": existing["id"]},
                {"$set": {"status": "error", "error": "Job abgebrochen (Server-Neustart). Erneut versuchen.", "finished_at": now_iso()}},
            )

        job_id = str(uuid.uuid4())
        await db.plan_adjust_jobs.insert_one({
            "id": job_id,
            "user_id": user["id"],
            "status": "pending",
            "created_at": now_iso(),
            "plan_id": plan_id,
            "source": "auto_weekly" if full_cycle else "auto_partial",
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
    """Berechnet die aktuelle Streak (konsekutive Tage mit abgeschlossenem Training).
    Premium-Streak-Freeze überbrückt automatisch genau 1-Tag-Lücken (1× pro Monat).
    Bereits gebridge Lücken werden via streak_freeze_bridges Log idempotent erkannt."""
    sessions = await db.workout_sessions.find(
        {"user_id": user_id, "status": "completed"}, {"_id": 0, "completed_at": 1}
    ).sort("completed_at", -1).to_list(500)
    if not sessions:
        return 0
    dates = sorted({(s.get("completed_at") or "")[:10] for s in sessions if s.get("completed_at")}, reverse=True)
    if not dates:
        return 0
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    yesterday_str = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    two_days_str = (datetime.now(timezone.utc) - timedelta(days=2)).strftime("%Y-%m-%d")
    # Existing bridge log so we don't double-consume freezes on re-reads
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0, "streak_freeze_bridges": 1})
    bridges = set((user_doc or {}).get("streak_freeze_bridges") or [])
    from routers.streak import consume_freeze_if_available
    # Streak only valid if last training is today/yesterday OR 2 days ago AND user has freeze
    if dates[0] not in (today_str, yesterday_str):
        if dates[0] == two_days_str:
            bridge_key = f"{yesterday_str}->{dates[0]}"
            if bridge_key in bridges:
                pass  # already bridged previously
            elif not await consume_freeze_if_available(user_id, bridge_key):
                return 0
            else:
                bridges.add(bridge_key)
        else:
            return 0
    streak = 1
    for i in range(1, len(dates)):
        prev_date = datetime.fromisoformat(dates[i-1])
        curr_date = datetime.fromisoformat(dates[i])
        gap = (prev_date - curr_date).days
        if gap == 1:
            streak += 1
        elif gap == 2:
            bridge_key = f"{dates[i-1]}->{dates[i]}"
            if bridge_key in bridges:
                streak += 1
            elif await consume_freeze_if_available(user_id, bridge_key):
                bridges.add(bridge_key)
                streak += 1
            else:
                break
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
