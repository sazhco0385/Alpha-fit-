"""Auth router (register, login, me, heartbeat) - extracted from server.py."""
from fastapi import APIRouter, Depends, HTTPException
import asyncio
import uuid
import logging

from server import (
    db, get_current_user, now_iso, log_activity,
    hash_password, verify_password, create_token, public_user,
    RegisterRequest, LoginRequest,
)

logger = logging.getLogger("alphafit")
router = APIRouter()


async def _send_welcome_email(user: dict) -> None:
    try:
        from email_service import send_email, render_welcome
        from server import create_unsub_token
        subject, html = render_welcome(user.get("name") or "Champion", create_unsub_token(user["id"]))
        email_id = await send_email(user["email"], subject, html, tag="welcome")
        await db.email_log.insert_one({
            "user_id": user["id"], "email": user["email"], "template": "welcome",
            "resend_id": email_id, "ok": bool(email_id), "sent_at": now_iso(),
        })
    except Exception as e:
        logger.error(f"welcome email failed for {user.get('email')}: {e}")


async def _notify_admin_new_signup(user: dict) -> None:
    """Send admin notification email for every new registration."""
    import os
    admin_email = os.environ.get("ADMIN_EMAIL")
    if not admin_email:
        return
    try:
        from email_service import send_email, render_admin_new_signup
        total_users = await db.users.count_documents({})
        subject, html = render_admin_new_signup(
            user_name=user.get("name") or "Unknown",
            user_email=user["email"],
            total_users=total_users,
        )
        await send_email(admin_email, subject, html, tag="admin_signup_notification")
    except Exception as e:
        logger.error(f"admin signup notification failed for {user.get('email')}: {e}")


@router.post("/auth/register")
async def register(payload: RegisterRequest):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="E-Mail bereits registriert")
    user = {
        "id": str(uuid.uuid4()),
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "is_admin": False,
        "is_premium": False,
        "premium_until": None,
        "trial_until": None,
        "onboarding_completed": False,
        "profile": None,
        "current_plan_id": None,
        "badges": [],
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    await log_activity(user["id"], user["name"], "registered", {})
    asyncio.create_task(_send_welcome_email(user))
    asyncio.create_task(_notify_admin_new_signup(user))
    token = create_token(user["id"])
    return {"token": token, "user": public_user(user)}


@router.post("/auth/login")
async def login(payload: LoginRequest):
    user = await db.users.find_one({"email": payload.email.lower()}, {"_id": 0})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    token = create_token(user["id"])
    return {"token": token, "user": public_user(user)}


@router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@router.post("/auth/heartbeat")
async def heartbeat(user: dict = Depends(get_current_user)):
    """User-Aktivität ping - jede Minute vom Frontend gesendet."""
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_active_at": now_iso()}}
    )
    return {"ok": True}
