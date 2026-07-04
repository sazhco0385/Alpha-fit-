"""Coach router (LLM plan generation, async plan-adjust jobs, chat, weekly insights)
extracted from server.py.
Shared helpers `_perform_plan_adjust` and `_run_adjust_job` intentionally REMAIN in
server.py because they are also used by sessions auto-adjust + bodyscan plan-adjust."""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
import asyncio
import json
import uuid
import logging

from server import (
    db, get_current_user, now_iso,
    build_coach_system, call_llm, parse_json_from_llm,
    generate_ai_plan, _perform_plan_adjust, _run_adjust_job,
    calculate_nutrition_goals,
    ChatMessage,
)
from routers.sessions import calculate_streak  # noqa: E402

logger = logging.getLogger("alphafit")
router = APIRouter()


@router.post("/coach/generate-plan")
async def coach_generate(user: dict = Depends(get_current_user)):
    if not user.get("profile"):
        raise HTTPException(status_code=400, detail="Onboarding erst abschließen")
    plan = await generate_ai_plan(user["id"], user["profile"])
    return {"plan": plan}


@router.get("/coach/plan-adjust-status")
async def plan_adjust_status(user: dict = Depends(get_current_user)):
    """Returns when the next auto plan-adjust will trigger and why.
    Used by the Dashboard to show "Bereit ✅" or "Cooldown 3 Tage" etc."""
    plan_id = user.get("current_plan_id")
    if not plan_id:
        return {"status": "no_plan", "message": "Noch kein aktiver Plan."}
    plan = await db.training_plans.find_one({"id": plan_id}, {"_id": 0, "days": 1})
    if not plan or not plan.get("days"):
        return {"status": "no_plan", "message": "Noch kein aktiver Plan."}

    # Cooldown
    last_auto = user.get("last_auto_adjust_at")
    days_since_last = 9999
    if last_auto:
        try:
            last_dt = datetime.fromisoformat(str(last_auto).replace("Z", "+00:00"))
            days_since_last = (datetime.now(timezone.utc) - last_dt).days
        except Exception:
            pass

    cooldown_days_left = max(0, 6 - days_since_last) if last_auto else 0

    # Done indices in last 7 days
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent = await db.workout_sessions.find(
        {"user_id": user["id"], "status": "completed", "completed_at": {"$gte": week_ago}},
        {"_id": 0, "day_index": 1},
    ).to_list(200)
    done_indices = sorted({s.get("day_index") for s in recent if s.get("day_index") is not None})
    plan_indices = sorted({d.get("day_index") for d in plan["days"] if d.get("day_index") is not None})
    missing = [d for d in plan_indices if d not in done_indices]
    sessions_count = len(recent)

    full_cycle = bool(plan_indices) and (not missing)
    partial_eligible = sessions_count >= 4 and days_since_last >= 7

    if cooldown_days_left > 0:
        status = "cooldown"
        msg = f"Cooldown — nächste Anpassung in {cooldown_days_left} Tag{'en' if cooldown_days_left != 1 else ''}."
    elif full_cycle or partial_eligible:
        status = "ready"
        msg = "Bereit für Anpassung — wird beim nächsten Workout-Abschluss ausgelöst."
    elif sessions_count >= 4:
        # 4+ sessions done but need more days since last adjust
        days_to_wait = max(0, 7 - days_since_last) if last_auto else 7 - sessions_count
        status = "needs_time"
        msg = f"Noch {max(1, days_to_wait)} Tag{'e' if max(1, days_to_wait) != 1 else ''} bis zur nächsten Anpassung."
    else:
        # need more sessions
        next_day = missing[0] if missing else (plan_indices[0] if plan_indices else 1)
        remaining = len(missing) if missing else max(0, 4 - sessions_count)
        status = "needs_sessions"
        if missing:
            msg = f"Noch {remaining} Trainingstag{'e' if remaining != 1 else ''} — als nächstes Tag {next_day}."
        else:
            msg = f"Noch {remaining} Sessions bis zur nächsten Anpassung."

    return {
        "status": status,
        "message": msg,
        "last_adjust_at": last_auto,
        "days_since_last": days_since_last if last_auto else None,
        "cooldown_days_left": cooldown_days_left,
        "sessions_last_7d": sessions_count,
        "plan_days_total": len(plan_indices),
        "plan_days_done": done_indices,
        "plan_days_missing": missing,
        "manual_override_available": True,
    }



@router.post("/coach/adjust-plan")
async def coach_adjust(user: dict = Depends(get_current_user)):
    """Synchronous adjust (kept for backward compat). Hard 60s timeout to avoid Cloudflare 524.
    Frontend should use /coach/adjust-plan/start + /coach/adjust-plan/status/{job_id}."""
    plan_id = user.get("current_plan_id")
    if not plan_id:
        raise HTTPException(status_code=400, detail="Kein aktiver Plan")
    plan = await db.training_plans.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan nicht gefunden")
    try:
        new_plan = await asyncio.wait_for(_perform_plan_adjust(user, plan), timeout=60)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="KI antwortet zu langsam - bitte erneut versuchen")
    return {"plan": new_plan}


@router.post("/coach/adjust-plan/start")
async def coach_adjust_start(user: dict = Depends(get_current_user)):
    """Start an async plan-adjust job. Returns instantly with a job_id; poll /status/{job_id}.

    Stale-job safety: if an existing 'pending' job is older than 5 minutes, it's
    considered orphaned (server restart lost the asyncio task) and we mark it as
    errored + start a fresh one. This prevents the button from being 'stuck' forever."""
    plan_id = user.get("current_plan_id")
    if not plan_id:
        raise HTTPException(status_code=400, detail="Kein aktiver Plan")
    plan = await db.training_plans.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan nicht gefunden")

    existing = await db.plan_adjust_jobs.find_one(
        {"user_id": user["id"], "status": "pending"}, {"_id": 0}
    )
    if existing:
        # Consider a pending job older than 5 minutes orphaned (server restart / crashed worker)
        try:
            created = datetime.fromisoformat(str(existing.get("created_at", "")).replace("Z", "+00:00"))
            age_seconds = (datetime.now(timezone.utc) - created).total_seconds()
        except Exception:
            age_seconds = 99999
        if age_seconds < 5 * 60:
            return {"job_id": existing["id"], "status": "pending"}
        # Sweep the stale job
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
    })
    # Update last_auto_adjust_at so the auto-trigger respects the manual adjust cooldown too
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_auto_adjust_at": now_iso()}},
    )
    asyncio.create_task(_run_adjust_job(job_id, user, plan))
    return {"job_id": job_id, "status": "pending"}


@router.get("/coach/adjust-plan/status/{job_id}")
async def coach_adjust_status(job_id: str, user: dict = Depends(get_current_user)):
    job = await db.plan_adjust_jobs.find_one({"id": job_id, "user_id": user["id"]}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job nicht gefunden")
    return job


@router.post("/coach/chat")
async def coach_chat(msg: ChatMessage, user: dict = Depends(get_current_user)):
    profile_ctx = json.dumps(user.get("profile") or {})
    sys = build_coach_system() + f"\n\nUser-Profil: {profile_ctx}"
    text = await call_llm(sys, msg.text, f"chat-{user['id']}")
    await db.chat_messages.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_text": msg.text,
        "ai_text": text,
        "created_at": now_iso(),
    })
    return {"reply": text}


@router.get("/coach/chat/history")
async def chat_history(user: dict = Depends(get_current_user)):
    msgs = await db.chat_messages.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return {"messages": msgs}


@router.get("/coach/insights")
async def coach_insights(user: dict = Depends(get_current_user)):
    """Alpha Coach 2.0 - proaktive Wochen-Insights mit Stats & Empfehlungen.
    Verwendet KALENDERWOCHE (Mo 00:00 UTC bis Mo 00:00 UTC der Folgewoche) statt rollender 7 Tage,
    damit die Zählung mit der echten Wahrnehmung des Users übereinstimmt."""
    now = datetime.now(timezone.utc)
    # Start of current calendar week (Monday 00:00 UTC)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today - timedelta(days=today.weekday())  # weekday(): Mon=0
    last_week_start = week_start - timedelta(days=7)
    week_start_iso = week_start.isoformat()
    last_week_start_iso = last_week_start.isoformat()

    this_week = await db.workout_sessions.find(
        {"user_id": user["id"], "status": "completed", "completed_at": {"$gte": week_start_iso}},
        {"_id": 0}
    ).to_list(50)
    last_week = await db.workout_sessions.find(
        {"user_id": user["id"], "status": "completed",
         "completed_at": {"$gte": last_week_start_iso, "$lt": week_start_iso}},
        {"_id": 0}
    ).to_list(50)

    def volume(sessions):
        return sum(
            log.get("reps", 0) * log.get("weight_kg", 0)
            for s in sessions for log in s.get("logged_sets", [])
        )

    this_vol = volume(this_week)
    last_vol = volume(last_week)
    vol_change_pct = None
    if last_vol > 0:
        vol_change_pct = round(((this_vol - last_vol) / last_vol) * 100, 1)

    streak = await calculate_streak(user["id"])
    total_completed = await db.workout_sessions.count_documents({"user_id": user["id"], "status": "completed"})

    plan_id = user.get("current_plan_id")
    plan = await db.training_plans.find_one({"id": plan_id}, {"_id": 0}) if plan_id else None

    exercise_recs = []
    if plan and this_week:
        from collections import defaultdict
        ex_perf = defaultdict(list)
        for s in this_week:
            day = next((d for d in plan["days"] if d["day_index"] == s.get("day_index")), None)
            if not day:
                continue
            for log in s.get("logged_sets", []):
                idx = log.get("exercise_index")
                if 0 <= idx < len(day.get("exercises", [])):
                    ex = day["exercises"][idx]
                    ex_perf[ex["name"]].append({
                        "target_reps": ex.get("reps", 0),
                        "target_weight": ex.get("weight_kg", 0),
                        "actual_reps": log.get("reps", 0),
                        "actual_weight": log.get("weight_kg", 0),
                    })
        for name, logs in list(ex_perf.items())[:3]:
            target_w = logs[0]["target_weight"]
            target_r = logs[0]["target_reps"]
            avg_reps = sum(lg["actual_reps"] for lg in logs) / len(logs)
            last_w = logs[-1]["actual_weight"]
            if avg_reps >= target_r and last_w >= target_w:
                inc = 2.5 if last_w < 50 else 5.0
                exercise_recs.append({
                    "exercise": name,
                    "current_weight": last_w,
                    "recommended_weight": last_w + inc,
                    "reason": f"Du hast {target_r} Whdh sauber geschafft.",
                })

    insights = []
    count = len(this_week)
    if count > 0:
        insights.append({
            "type": "workouts",
            "icon": "flame",
            "title": f"{count} Workouts diese Woche",
            "text": (
                f"Du hast diese Woche {count} Training{'s' if count > 1 else ''} absolviert. "
                + (f"Letzte Woche: {len(last_week)}. " if last_week else "")
                + ("Solid Arbeit!" if count >= 3 else "Push mehr — Ziel sind 3+.")
            ),
        })
    else:
        insights.append({
            "type": "workouts",
            "icon": "alert",
            "title": "0 Workouts diese Woche",
            "text": "Du hast diese Woche noch nicht trainiert. Zeit für die nächste Einheit, Alpha.",
        })

    if vol_change_pct is not None and last_vol > 0:
        arrow = "⬆" if vol_change_pct > 0 else ("⬇" if vol_change_pct < 0 else "→")
        insights.append({
            "type": "volume",
            "icon": "trending",
            "title": f"Volumen {arrow} {abs(vol_change_pct)}%",
            "text": (
                f"Dein Trainings-Volumen ist um {abs(vol_change_pct)}% "
                + ("gestiegen — exzellent!" if vol_change_pct > 0 else
                   "gefallen. Push härter nächste Woche." if vol_change_pct < 0 else "stabil geblieben.")
                + f" ({int(this_vol):,} kg vs. {int(last_vol):,} kg)"
            ),
        })
    elif this_vol > 0:
        insights.append({
            "type": "volume",
            "icon": "trending",
            "title": f"{int(this_vol):,} kg Volumen",
            "text": f"Du hast diese Woche {int(this_vol):,} kg insgesamt bewegt. Starker Start!",
        })

    if streak >= 3:
        insights.append({
            "type": "streak",
            "icon": "fire",
            "title": f"{streak}-Tage Streak 🔥",
            "text": f"Du trainierst seit {streak} Tagen in Folge. Brich den Streak nicht!",
        })

    for rec in exercise_recs:
        insights.append({
            "type": "progression",
            "icon": "sparkles",
            "title": f"Steigere {rec['exercise']}",
            "text": f"{rec['reason']} Nächste Woche: **{rec['recommended_weight']} kg** (aktuell {rec['current_weight']} kg).",
            "exercise": rec["exercise"],
            "current_weight": rec["current_weight"],
            "recommended_weight": rec["recommended_weight"],
        })

    three_weeks_ago = (now - timedelta(days=21)).isoformat()
    stagnation_sessions = await db.workout_sessions.find(
        {"user_id": user["id"], "status": "completed", "completed_at": {"$gte": three_weeks_ago}},
        {"_id": 0}
    ).to_list(50)
    if plan and len(stagnation_sessions) >= 4:
        from collections import defaultdict
        ex_weights = defaultdict(set)
        for s in stagnation_sessions:
            day = next((d for d in plan["days"] if d["day_index"] == s.get("day_index")), None)
            if not day:
                continue
            for log in s.get("logged_sets", []):
                idx = log.get("exercise_index")
                if 0 <= idx < len(day.get("exercises", [])):
                    ex_weights[day["exercises"][idx]["name"]].add(log.get("weight_kg", 0))
        for name, weights in ex_weights.items():
            if len(weights) == 1 and list(weights)[0] > 0:
                w = list(weights)[0]
                if any(r["exercise"] == name for r in exercise_recs):
                    continue
                insights.append({
                    "type": "stagnation",
                    "icon": "alert",
                    "title": f"Stagnation: {name}",
                    "text": f"Du arbeitest seit 3+ Wochen mit {w} kg auf {name}. Zeit zu steigern oder Übung zu wechseln.",
                })
                break

    profile = user.get("profile") or {}
    goals = calculate_nutrition_goals(profile)
    target_protein = goals.get("protein_g", 0)
    if target_protein > 0:
        nutrition_pipeline = [
            {"$match": {"user_id": user["id"], "date": {"$gte": (now - timedelta(days=7)).strftime("%Y-%m-%d")}}},
            {"$group": {"_id": "$date", "protein": {"$sum": "$protein_g"}, "calories": {"$sum": "$calories"}}}
        ]
        nut_days = await db.nutrition_entries.aggregate(nutrition_pipeline).to_list(7)
        if nut_days:
            avg_protein = round(sum(d["protein"] for d in nut_days) / len(nut_days))
            avg_cal = round(sum(d["calories"] for d in nut_days) / len(nut_days))
            target_cal = goals.get("calories", 2000)
            if avg_protein < target_protein * 0.85:
                insights.append({
                    "type": "nutrition_protein",
                    "icon": "alert",
                    "title": f"Protein-Defizit: {avg_protein}g/Tag",
                    "text": f"Du erreichst diese Woche nur {avg_protein}g Protein pro Tag. Ziel sind {target_protein}g. Mehr Hähnchen, Quark, Whey.",
                })
            elif avg_protein >= target_protein:
                insights.append({
                    "type": "nutrition_protein",
                    "icon": "sparkles",
                    "title": f"Protein-Ziel erreicht: {avg_protein}g/Tag",
                    "text": f"Du hittest dein Protein-Ziel von {target_protein}g. So baust du Muskeln.",
                })
            goal_type = profile.get("goal", "")
            if goal_type == "fat_loss" and avg_cal > target_cal * 1.1:
                insights.append({
                    "type": "nutrition_cal",
                    "icon": "alert",
                    "title": f"Zu viele Kalorien: {avg_cal}/Tag",
                    "text": f"Dein Ziel ist Fettabbau, aber du isst {avg_cal} kcal/Tag (Ziel: {target_cal}). Reduziere um {avg_cal - target_cal} kcal.",
                })
            elif goal_type == "muscle_gain" and avg_cal < target_cal * 0.9:
                insights.append({
                    "type": "nutrition_cal",
                    "icon": "alert",
                    "title": f"Zu wenig Kalorien: {avg_cal}/Tag",
                    "text": f"Für Muskelaufbau brauchst du {target_cal} kcal/Tag. Du isst nur {avg_cal}. Iss {target_cal - avg_cal} kcal mehr.",
                })

    if total_completed > 0 and total_completed % 10 == 0:
        insights.append({
            "type": "milestone",
            "icon": "trophy",
            "title": f"{total_completed} Workouts insgesamt",
            "text": f"Krass — du hast {total_completed} Trainings absolviert. Das ist Disziplin.",
        })

    return {
        "insights": insights,
        "stats": {
            "this_week_workouts": count,
            "last_week_workouts": len(last_week),
            "this_week_volume_kg": this_vol,
            "last_week_volume_kg": last_vol,
            "volume_change_pct": vol_change_pct,
            "current_streak": streak,
            "total_completed": total_completed,
        },
    }
