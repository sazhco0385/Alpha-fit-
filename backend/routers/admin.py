"""Admin router - stats, members, online users, activity feed, tickets, member ops.
Extracted from server.py."""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging

from server import (
    db, now_iso, require_admin,
    public_user, is_premium_active, is_recently_active, minutes_since,
    AdminPremiumRequest,
)

logger = logging.getLogger("alphafit")
router = APIRouter()


@router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_admin)):
    total_users = await db.users.count_documents({})
    premium_users = await db.users.count_documents({"is_premium": True})

    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc).isoformat()
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc).isoformat()

    paid_filter = {"payment_status": "paid"}
    today_pipeline = [
        {"$match": {**paid_filter, "completed_at": {"$gte": today_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    month_pipeline = [
        {"$match": {**paid_filter, "completed_at": {"$gte": month_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    all_pipeline = [
        {"$match": paid_filter},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]

    today_agg = await db.payment_transactions.aggregate(today_pipeline).to_list(1)
    month_agg = await db.payment_transactions.aggregate(month_pipeline).to_list(1)
    all_agg = await db.payment_transactions.aggregate(all_pipeline).to_list(1)

    daily_pipeline = [
        {"$match": paid_filter},
        {"$group": {
            "_id": {"$substr": ["$completed_at", 0, 10]},
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": -1}},
        {"$limit": 30}
    ]
    daily = await db.payment_transactions.aggregate(daily_pipeline).to_list(30)

    return {
        "total_users": total_users,
        "premium_users": premium_users,
        "online_users": await db.users.count_documents({"last_active_at": {"$gte": (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()}}),
        "revenue_today": today_agg[0]["total"] if today_agg else 0,
        "revenue_today_count": today_agg[0]["count"] if today_agg else 0,
        "revenue_month": month_agg[0]["total"] if month_agg else 0,
        "revenue_month_count": month_agg[0]["count"] if month_agg else 0,
        "revenue_total": all_agg[0]["total"] if all_agg else 0,
        "revenue_total_count": all_agg[0]["count"] if all_agg else 0,
        "daily_revenue": [{"date": d["_id"], "total": d["total"], "count": d["count"]} for d in daily],
    }


@router.get("/admin/members")
async def admin_members(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    out = []
    for u in users:
        pub = public_user(u)
        pub["last_active_at"] = u.get("last_active_at")
        pub["is_online"] = is_recently_active(u.get("last_active_at"))
        out.append(pub)
    return {"members": out}


@router.get("/admin/online")
async def admin_online(admin: dict = Depends(require_admin)):
    """Liste der User die in den letzten 5 Minuten aktiv waren."""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    users = await db.users.find(
        {"last_active_at": {"$gte": cutoff}},
        {"_id": 0, "password_hash": 0}
    ).sort("last_active_at", -1).to_list(200)
    return {
        "online": [
            {
                "id": u.get("id"),
                "name": u.get("name"),
                "email": u.get("email"),
                "is_premium": is_premium_active(u),
                "last_active_at": u.get("last_active_at"),
                "minutes_ago": minutes_since(u.get("last_active_at")),
            }
            for u in users
        ],
        "count": len(users),
    }


@router.get("/admin/activity")
async def admin_activity(admin: dict = Depends(require_admin), limit: int = 50):
    """Live-Aktivitäts-Feed - die letzten Events."""
    events = await db.activity_events.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"events": events}


@router.get("/admin/tickets")
async def admin_tickets(admin: dict = Depends(require_admin), status: Optional[str] = None):
    q = {}
    if status:
        q["status"] = status
    tickets = await db.support_tickets.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    open_count = await db.support_tickets.count_documents({"status": "open"})
    return {"tickets": tickets, "open_count": open_count}


@router.post("/admin/tickets/{ticket_id}/respond")
async def admin_respond_ticket(ticket_id: str, payload: dict, admin: dict = Depends(require_admin)):
    reply = payload.get("reply", "").strip()
    new_status = payload.get("status", "resolved")
    await db.support_tickets.update_one(
        {"id": ticket_id},
        {"$set": {"admin_reply": reply, "status": new_status, "updated_at": now_iso(), "responded_by": admin.get("name")}}
    )
    return {"ok": True}


@router.delete("/admin/tickets/{ticket_id}")
async def admin_delete_ticket(ticket_id: str, admin: dict = Depends(require_admin)):
    await db.support_tickets.delete_one({"id": ticket_id})
    return {"ok": True}


@router.delete("/admin/members/{user_id}")
async def admin_delete_member(user_id: str, admin: dict = Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Eigenes Konto kann nicht gelöscht werden")
    await db.users.delete_one({"id": user_id})
    await db.workout_sessions.delete_many({"user_id": user_id})
    await db.training_plans.delete_many({"user_id": user_id})
    await db.chat_messages.delete_many({"user_id": user_id})
    return {"ok": True}


@router.post("/admin/members/premium")
async def admin_set_premium(payload: AdminPremiumRequest, admin: dict = Depends(require_admin)):
    until = datetime.now(timezone.utc) + timedelta(days=payload.days)
    now_utc = datetime.now(timezone.utc)
    await db.users.update_one(
        {"id": payload.user_id},
        {"$set": {
            "is_premium": True,
            "premium_until": until.isoformat(),
            "streak_freezes_available": 1,
            "streak_freeze_last_grant_month": now_utc.strftime("%Y-%m"),
            "streak_freeze_last_grant_at": now_utc.isoformat(),
        }}
    )
    return {"ok": True, "premium_until": until.isoformat()}


@router.post("/admin/members/revoke-premium")
async def admin_revoke_premium(payload: dict, admin: dict = Depends(require_admin)):
    await db.users.update_one(
        {"id": payload.get("user_id")},
        {"$set": {"is_premium": False, "premium_until": None, "trial_until": None}}
    )
    return {"ok": True}



@router.get("/admin/funnel/trial-reminder")
async def admin_funnel_trial_reminder(admin: dict = Depends(require_admin)):
    """Trial-Reminder funnel: emails sent → clicks → checkouts → purchases.
    Each stage's conversion rate is computed against the previous stage.
    """
    # 1) Emails sent (by milestone)
    sent_48 = await db.email_log.count_documents({
        "template": "trial_usage_reminder", "milestone": "48h", "ok": True,
    })
    sent_24 = await db.email_log.count_documents({
        "template": "trial_usage_reminder", "milestone": "24h", "ok": True,
    })
    emails_sent = sent_48 + sent_24

    # 2) Distinct users who clicked
    clicks_total = await db.funnel_events.count_documents({"source": "trial_reminder"})
    clicker_users = await db.funnel_events.distinct("user_id", {"source": "trial_reminder"})
    clicks_unique = len(clicker_users)

    # 3) Checkouts started (transactions attributed)
    checkouts_started = await db.payment_transactions.count_documents({"attribution": "trial_reminder"})

    # 4) Purchases completed
    paid_filter = {"attribution": "trial_reminder", "payment_status": "paid"}
    paid_pipeline = [
        {"$match": paid_filter},
        {"$group": {"_id": None, "count": {"$sum": 1}, "revenue": {"$sum": "$amount"}}},
    ]
    paid_agg = await db.payment_transactions.aggregate(paid_pipeline).to_list(1)
    purchases = paid_agg[0]["count"] if paid_agg else 0
    revenue = float(paid_agg[0]["revenue"]) if paid_agg else 0.0

    def _rate(num, den):
        return round((num / den) * 100, 1) if den > 0 else 0.0

    return {
        "emails_sent": emails_sent,
        "emails_sent_48h": sent_48,
        "emails_sent_24h": sent_24,
        "clicks_total": clicks_total,
        "clicks_unique": clicks_unique,
        "checkouts_started": checkouts_started,
        "purchases": purchases,
        "revenue": revenue,
        "rate_click_through": _rate(clicks_unique, emails_sent),
        "rate_checkout": _rate(checkouts_started, clicks_unique),
        "rate_purchase": _rate(purchases, checkouts_started),
        "rate_overall": _rate(purchases, emails_sent),
    }



# ===== Email diagnostics (admin-only) =====
@router.get("/admin/email-diagnostics")
async def email_diagnostics(admin: dict = Depends(require_admin), limit: int = 30, email: Optional[str] = None):
    """Return the last N Resend send attempts with full diagnostic info.
    Use ?email=user@example.com to filter by recipient."""
    q = {}
    if email:
        q["to"] = email.lower()
    raw = await db.email_log_raw.find(q, {"_id": 0}).sort("sent_at", -1).limit(min(limit, 100)).to_list(limit)
    log = await db.email_log.find(q if not email else {"email": email.lower()}, {"_id": 0}).sort("sent_at", -1).limit(min(limit, 100)).to_list(limit)
    # Sender config summary (masked)
    import os as _os
    sender_email = _os.environ.get("RESEND_SENDER_EMAIL") or "onboarding@resend.dev"
    api_key_present = bool(_os.environ.get("RESEND_API_KEY"))
    return {
        "sender_email": sender_email,
        "api_key_present": api_key_present,
        "raw_sends": raw,
        "template_log": log,
        "raw_ok_count": sum(1 for r in raw if r.get("ok")),
        "raw_error_count": sum(1 for r in raw if not r.get("ok")),
    }


@router.post("/admin/email-test")
async def email_test(payload: dict, admin: dict = Depends(require_admin)):
    """Send a test verification email to a specific address and return the raw diagnostic result."""
    to = str(payload.get("email") or "").strip().lower()
    if not to or "@" not in to:
        raise HTTPException(status_code=400, detail="Ungültige E-Mail")
    from email_service import send_email, render_verify_email, APP_URL
    subject, html = render_verify_email("Test", f"{APP_URL}/verify-email?token=TEST_DIAG_TOKEN")
    email_id = await send_email(to, subject, html, tag="admin_test")
    # Return the last raw log for THIS specific to
    latest = await db.email_log_raw.find_one({"to": to}, {"_id": 0}, sort=[("sent_at", -1)])
    return {"ok": bool(email_id), "email_id": email_id, "diagnostic": latest}


@router.post("/admin/verify-user")
async def admin_verify_user(payload: dict, admin: dict = Depends(require_admin)):
    """Manually mark a user as email_verified — emergency bypass while mail delivery is broken."""
    email = str(payload.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Ungültige E-Mail")
    res = await db.users.update_one(
        {"email": email},
        {"$set": {"email_verified": True, "email_verified_at": now_iso(), "verified_by_admin": admin["email"]}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User nicht gefunden")
    logger.info(f"admin {admin['email']} manually verified {email}")
    return {"ok": True, "email": email, "modified": res.modified_count}


@router.get("/admin/auth-config")
async def admin_auth_config(admin: dict = Depends(require_admin)):
    """Show current auth-related env config so admin can see if EMAIL_VERIFICATION_REQUIRED is on/off."""
    import os as _os
    return {
        "email_verification_required": (_os.environ.get("EMAIL_VERIFICATION_REQUIRED", "false").lower() == "true"),
        "resend_api_key_present": bool(_os.environ.get("RESEND_API_KEY")),
        "resend_sender_email": _os.environ.get("RESEND_SENDER_EMAIL") or "onboarding@resend.dev",
    }
