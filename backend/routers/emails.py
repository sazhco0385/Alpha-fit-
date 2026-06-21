"""Emails router - test/preview endpoints + admin manual triggers.
Transactional sending is done from in-process flows (auth/register, payments, dispatcher loop)."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import logging

from server import db, get_current_user, require_admin
from email_service import (
    send_email,
    render_welcome, render_payment_success, render_trial_ending,
    render_streak_reminder, render_weekly_summary, render_winback,
    render_trial_usage_reminder,
)

logger = logging.getLogger("alphafit")
router = APIRouter()


class EmailTestRequest(BaseModel):
    to: str | None = None  # if missing → send to caller
    template: str = "welcome"  # welcome | payment_success | trial_ending | streak_reminder | weekly_summary


@router.post("/emails/test")
async def emails_test(payload: EmailTestRequest, user: dict = Depends(get_current_user)):
    """Send a preview email to yourself or any address (admin only).
    Free users can only send to themselves."""
    to_email = (payload.to or user["email"]).strip().lower()
    if to_email != user["email"].lower() and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Nur Admins können an andere Adressen senden")

    name = user.get("name", "Champion")
    from server import create_unsub_token
    unsub = create_unsub_token(user["id"])
    t = (payload.template or "welcome").lower()
    if t == "welcome":
        subject, html = render_welcome(name, unsub)
    elif t == "payment_success":
        subject, html = render_payment_success(name, "monthly", 9.99, "EUR", unsub)
    elif t == "trial_ending":
        subject, html = render_trial_ending(name, 2, unsub)
        html = html.replace("{streak_workouts}", "4")
    elif t == "streak_reminder":
        subject, html = render_streak_reminder(name, 4, unsub)
    elif t == "weekly_summary":
        subject, html = render_weekly_summary(name, {
            "workouts": 4, "volume_kg": 12500, "streak": 12, "delta_pct": 8.5,
        }, unsub)
    elif t == "winback":
        subject, html = render_winback(name, total_workouts=47, total_volume_kg=58400, discount_pct=30, unsub_token=unsub)
    elif t in ("trial_usage_reminder", "trial_usage_48h", "trial_usage_24h"):
        hours = 24 if t == "trial_usage_24h" else 48
        subject, html = render_trial_usage_reminder(
            name.split()[0] if name else "Champion",
            hours,
            {"workouts": 5, "volume_kg": 14200, "coach_msgs": 12, "body_scans": 2, "prs": 3, "badges": 6},
            unsub,
        )
    else:
        raise HTTPException(status_code=400, detail="Unbekanntes Template")

    email_id = await send_email(to_email, subject, html, tag=f"test-{t}")
    if not email_id:
        raise HTTPException(status_code=502, detail="Email konnte nicht versendet werden (Resend-Fehler)")
    return {"ok": True, "email_id": email_id, "template": t, "to": to_email}


@router.post("/admin/emails/run-dispatcher")
async def emails_run_dispatcher(admin: dict = Depends(require_admin)):
    """Manually trigger the daily email dispatcher (otherwise runs automatically every 6h)."""
    from server import run_email_dispatcher_once
    result = await run_email_dispatcher_once()
    return {"ok": True, "result": result}


@router.get("/admin/emails/log")
async def emails_log(admin: dict = Depends(require_admin), limit: int = 100):
    """Recent transactional email log entries (last N)."""
    entries = await db.email_log.find({}, {"_id": 0}).sort("sent_at", -1).to_list(min(max(limit, 1), 500))
    return {"entries": entries}
