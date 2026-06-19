"""Background dispatchers (push notifications + email dispatch loop).
Extracted from server.py."""
from datetime import datetime, timezone, timedelta
from typing import Optional
import asyncio
import json
import os
import logging

from pywebpush import webpush, WebPushException

from server import (
    db, now_iso, create_unsub_token,
    VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT,
)

logger = logging.getLogger("alphafit")


def _send_web_push(sub: dict, title: str, body: str, url: str = "/dashboard", tag: str = "alphafit") -> bool:
    """Send a single web push. Returns True on success."""
    if not VAPID_PRIVATE_KEY:
        logger.warning("VAPID_PRIVATE_KEY not configured")
        return False
    try:
        webpush(
            subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]},
            data=json.dumps({"title": title, "body": body, "url": url, "tag": tag}),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_SUBJECT},
            ttl=86400,
        )
        return True
    except WebPushException as e:
        logger.warning(f"Push failed for {sub.get('endpoint','')[:60]}: {e}")
        # 404/410 = subscription gone, remove it
        status = getattr(getattr(e, 'response', None), 'status_code', None)
        if status in (404, 410):
            asyncio.create_task(db.push_subscriptions.delete_one(
                {"user_id": sub["user_id"], "endpoint": sub["endpoint"]}
            ))
        return False
    except Exception as e:
        logger.error(f"Push exception: {e}")
        return False


# /notifications/test moved to routers/push.py



async def push_dispatcher_loop():
    """Background loop: every minute, checks all subscriptions and sends scheduled pushes.
    Triggers: workout_reminder (daily at reminder_time), streak_protect (no activity in 24h before streak break),
    weekly_review (sunday 18:00 local)."""
    await asyncio.sleep(5)
    last_minute = None
    while True:
        try:
            now_utc = datetime.now(timezone.utc)
            current_minute = now_utc.strftime("%Y%m%d%H%M")
            if current_minute == last_minute:
                await asyncio.sleep(20)
                continue
            last_minute = current_minute

            subs = await db.push_subscriptions.find({}, {"_id": 0}).to_list(2000)
            for sub in subs:
                triggers = sub.get("triggers") or {}
                tz_offset = int(sub.get("timezone_offset") or 0)
                local_now = now_utc + timedelta(minutes=tz_offset)
                local_hhmm = local_now.strftime("%H:%M")
                local_dow = local_now.weekday()  # 0=Mon, 6=Sun
                reminder_time = sub.get("reminder_time") or "18:00"

                # Daily workout reminder
                if triggers.get("workout_reminder") and local_hhmm == reminder_time:
                    user = await db.users.find_one({"id": sub["user_id"]})
                    if user:
                        name = (user.get("name") or "Alpha").split()[0]
                        _send_web_push(sub,
                                       title=f"🛡️ {name}, dein Workout wartet",
                                       body="Zeit für Training. Heute leiden, morgen herrschen.",
                                       url="/plan", tag="workout-reminder")

                # Weekly review (Sunday 18:00 local)
                if triggers.get("weekly_review") and local_dow == 6 and local_hhmm == "18:00":
                    _send_web_push(sub,
                                   title="📊 Deine Alpha-Woche",
                                   body="Schau dir dein Coach-Insights & Fortschritts-Update an.",
                                   url="/coach", tag="weekly-review")

                # Streak protect: once per day at 20:00 local, check if user has logged today
                if triggers.get("streak_protect") and local_hhmm == "20:00":
                    today_local = local_now.strftime("%Y-%m-%d")
                    has_session = await db.workout_sessions.find_one(
                        {"user_id": sub["user_id"], "status": "completed",
                         "completed_at": {"$regex": f"^{today_local}"}}
                    )
                    if not has_session:
                        # Check if user has a current streak worth protecting (>=2)
                        user = await db.users.find_one({"id": sub["user_id"]})
                        streak = (user or {}).get("streak_days", 0) or 0
                        if streak >= 2:
                            _send_web_push(sub,
                                           title=f"🔥 Streak gefährdet ({streak} Tage)",
                                           body="Noch keine Aktivität heute. Schütz deine Serie!",
                                           url="/plan", tag="streak-protect")
        except Exception as e:
            logger.error(f"push_dispatcher_loop error: {e}")
        await asyncio.sleep(30)




async def run_email_dispatcher_once() -> dict:
    """Single pass: send trial-ending (≤48h), streak-reminder (3+ inactive days), weekly-summary (Sundays),
    win-back (premium expired 7-14 days ago). All sends are idempotent via db.email_log."""
    from email_service import (
        send_email, render_trial_ending, render_streak_reminder, render_weekly_summary,
        render_winback,
    )
    now = datetime.now(timezone.utc)
    today_iso = now.date().isoformat()
    sent = {"trial_ending": 0, "streak_reminder": 0, "weekly_summary": 0, "winback": 0, "errors": 0}

    def _email_pref(u: dict, key: str) -> bool:
        prefs = (u.get("notification_prefs") or {}).get("email") or {}
        return bool(prefs.get(key, True))

    # --- 1) Trial ending in ≤ 48h ---
    cutoff_in_48h = (now + timedelta(hours=48)).isoformat()
    cutoff_now = now.isoformat()
    trial_users = await db.users.find({
        "trial_until": {"$ne": None, "$gt": cutoff_now, "$lte": cutoff_in_48h},
        "is_premium": True,
    }, {"_id": 0}).to_list(500)
    for u in trial_users:
        try:
            if not _email_pref(u, "trial_ending"):
                continue
            already = await db.email_log.find_one({
                "user_id": u["id"], "template": "trial_ending",
            })
            if already:
                continue
            try:
                trial_end = datetime.fromisoformat(u["trial_until"].replace("Z", "+00:00"))
                hours_left = max(0, (trial_end - now).total_seconds() / 3600)
                days_left = max(1, int(round(hours_left / 24)))
            except Exception:
                days_left = 2
            wk_ago = (now - timedelta(days=7)).isoformat()
            wk_workouts = await db.workout_sessions.count_documents({
                "user_id": u["id"], "status": "completed", "completed_at": {"$gte": wk_ago},
            })
            subject, html = render_trial_ending(u.get("name") or "Champion", days_left, create_unsub_token(u["id"]))
            html = html.replace("{streak_workouts}", str(wk_workouts))
            email_id = await send_email(u["email"], subject, html, tag="trial_ending")
            await db.email_log.insert_one({
                "user_id": u["id"], "email": u["email"], "template": "trial_ending",
                "resend_id": email_id, "ok": bool(email_id), "sent_at": now_iso(),
            })
            if email_id:
                sent["trial_ending"] += 1
            else:
                sent["errors"] += 1
        except Exception as e:
            logger.error(f"email_dispatcher trial_ending err for {u.get('email')}: {e}")
            sent["errors"] += 1

    # --- 2) Streak reminder: last completed workout 3-14 days ago ---
    three_days_ago = (now - timedelta(days=3)).isoformat()
    fourteen_days_ago = (now - timedelta(days=14)).isoformat()
    users_for_streak = await db.users.find({"email": {"$exists": True}}, {"_id": 0}).to_list(2000)
    for u in users_for_streak:
        try:
            if not _email_pref(u, "streak_reminder"):
                continue
            last_session = await db.workout_sessions.find_one(
                {"user_id": u["id"], "status": "completed"},
                {"_id": 0, "completed_at": 1},
                sort=[("completed_at", -1)],
            )
            if not last_session or not last_session.get("completed_at"):
                continue
            last_at = last_session["completed_at"]
            if not (fourteen_days_ago < last_at < three_days_ago):
                continue
            # Throttle: max 1 streak reminder per 14 days
            cutoff_14d = (now - timedelta(days=14)).isoformat()
            already = await db.email_log.find_one({
                "user_id": u["id"], "template": "streak_reminder",
                "sent_at": {"$gte": cutoff_14d},
            })
            if already:
                continue
            try:
                last_dt = datetime.fromisoformat(last_at.replace("Z", "+00:00"))
                days_since = max(3, int((now - last_dt).total_seconds() / 86400))
            except Exception:
                days_since = 3
            subject, html = render_streak_reminder(u.get("name") or "Champion", days_since, create_unsub_token(u["id"]))
            email_id = await send_email(u["email"], subject, html, tag="streak_reminder")
            await db.email_log.insert_one({
                "user_id": u["id"], "email": u["email"], "template": "streak_reminder",
                "resend_id": email_id, "ok": bool(email_id), "sent_at": now_iso(),
            })
            if email_id:
                sent["streak_reminder"] += 1
            else:
                sent["errors"] += 1
        except Exception as e:
            logger.error(f"email_dispatcher streak err for {u.get('email')}: {e}")
            sent["errors"] += 1

    # --- 3) Weekly summary: every Sunday ---
    if now.weekday() == 6:
        week_start = (now - timedelta(days=7)).isoformat()
        two_weeks_ago = (now - timedelta(days=14)).isoformat()
        for u in users_for_streak:
            try:
                if not _email_pref(u, "weekly_summary"):
                    continue
                this_week_key = now.strftime("%G-W%V")  # ISO week
                already = await db.email_log.find_one({
                    "user_id": u["id"], "template": "weekly_summary", "week_key": this_week_key,
                })
                if already:
                    continue
                this_week = await db.workout_sessions.find(
                    {"user_id": u["id"], "status": "completed", "completed_at": {"$gte": week_start}},
                    {"_id": 0},
                ).to_list(50)
                if not this_week:
                    continue
                last_week = await db.workout_sessions.find(
                    {"user_id": u["id"], "status": "completed",
                     "completed_at": {"$gte": two_weeks_ago, "$lt": week_start}},
                    {"_id": 0},
                ).to_list(50)
                def _vol(sessions):
                    return sum(
                        log.get("reps", 0) * log.get("weight_kg", 0)
                        for s in sessions for log in s.get("logged_sets", [])
                    )
                tv, lv = _vol(this_week), _vol(last_week)
                delta_pct = round(((tv - lv) / lv) * 100, 1) if lv > 0 else None
                # streak via sessions router helper
                from routers.sessions import calculate_streak  # noqa: E402
                streak = await calculate_streak(u["id"])
                subject, html = render_weekly_summary(u.get("name") or "Champion", {
                    "workouts": len(this_week), "volume_kg": tv, "streak": streak, "delta_pct": delta_pct,
                }, create_unsub_token(u["id"]))
                email_id = await send_email(u["email"], subject, html, tag="weekly_summary")
                await db.email_log.insert_one({
                    "user_id": u["id"], "email": u["email"], "template": "weekly_summary",
                    "week_key": this_week_key, "resend_id": email_id, "ok": bool(email_id),
                    "sent_at": now_iso(),
                })
                if email_id:
                    sent["weekly_summary"] += 1
                else:
                    sent["errors"] += 1
            except Exception as e:
                logger.error(f"email_dispatcher weekly err for {u.get('email')}: {e}")
                sent["errors"] += 1

    # --- 4) Win-Back: premium expired 7-14 days ago, was premium for 14+ days total, ≥1 workout ---
    expired_lo = (now - timedelta(days=14)).isoformat()
    expired_hi = (now - timedelta(days=7)).isoformat()
    winback_candidates = await db.users.find({
        "is_premium": False,
        "premium_until": {"$ne": None, "$gt": expired_lo, "$lte": expired_hi},
    }, {"_id": 0}).to_list(2000)
    for u in winback_candidates:
        try:
            if not _email_pref(u, "winback"):
                continue
            already = await db.email_log.find_one({"user_id": u["id"], "template": "winback"})
            if already:
                continue
            sessions = await db.workout_sessions.find(
                {"user_id": u["id"], "status": "completed"}, {"_id": 0},
            ).to_list(500)
            total_workouts = len(sessions)
            if total_workouts < 1:
                continue
            total_volume = int(sum(
                log.get("reps", 0) * log.get("weight_kg", 0)
                for s in sessions for log in s.get("logged_sets", [])
            ))
            subject, html = render_winback(u.get("name") or "Champion", total_workouts, total_volume, discount_pct=30, unsub_token=create_unsub_token(u["id"]))
            email_id = await send_email(u["email"], subject, html, tag="winback")
            await db.email_log.insert_one({
                "user_id": u["id"], "email": u["email"], "template": "winback",
                "resend_id": email_id, "ok": bool(email_id), "sent_at": now_iso(),
                "stats": {"workouts": total_workouts, "volume_kg": total_volume},
            })
            if email_id:
                sent["winback"] += 1
            else:
                sent["errors"] += 1
        except Exception as e:
            logger.error(f"email_dispatcher winback err for {u.get('email')}: {e}")
            sent["errors"] += 1

    logger.info(f"email dispatcher run: {sent}")
    return {**sent, "ran_at": now_iso(), "date": today_iso}


async def email_dispatcher_loop():
    """Run the dispatcher every 6h."""
    while True:
        try:
            await run_email_dispatcher_once()
        except Exception as e:
            logger.error(f"email_dispatcher_loop error: {e}")
        await asyncio.sleep(6 * 3600)  # 6h

