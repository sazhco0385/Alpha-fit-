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
        logger.warning("ADMIN_EMAIL not set; skipping admin signup notification")
        return
    try:
        from email_service import send_email, render_admin_new_signup
        total_users = await db.users.count_documents({})
        subject, html = render_admin_new_signup(
            user_name=user.get("name") or "Unknown",
            user_email=user["email"],
            total_users=total_users,
        )
        logger.info(f"admin signup notification: sending to {admin_email} for new user {user.get('email')}")
        email_id = await send_email(admin_email, subject, html, tag="admin_signup_notification")
        await db.email_log.insert_one({
            "user_id": user["id"], "email": admin_email, "template": "admin_signup_notification",
            "new_user_email": user["email"], "resend_id": email_id, "ok": bool(email_id), "sent_at": now_iso(),
        })
        if email_id:
            logger.info(f"admin signup notification: SENT id={email_id}")
        else:
            logger.error(f"admin signup notification: send_email returned None for {user.get('email')}")
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
        "email_verified": False,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    await log_activity(user["id"], user["name"], "registered", {})
    asyncio.create_task(_notify_admin_new_signup(user))
    # If verification is not required (feature flag off), auto-login + welcome mail like before
    if not _email_verification_required():
        asyncio.create_task(_send_welcome_email(user))
        await db.users.update_one({"id": user["id"]}, {"$set": {"email_verified": True, "welcome_email_sent": True}})
        user["email_verified"] = True
        token = create_token(user["id"])
        return {"token": token, "user": public_user(user)}
    # Otherwise send verification mail; user must click link before login
    from routers.email_verify import create_and_send_verification
    asyncio.create_task(create_and_send_verification(user))
    return {
        "ok": True,
        "email_verification_required": True,
        "email": user["email"],
        "message": "Registrierung erfolgreich. Bitte prüfe dein Postfach und bestätige deine E-Mail-Adresse.",
    }


import os
def _email_verification_required() -> bool:
    """Env-var toggle. Default is 'false' (email verification OFF) to keep the app usable
    while Resend/DKIM/DMARC delivery is being sorted out. Set EMAIL_VERIFICATION_REQUIRED=true
    once your DNS records + Resend domain are fully wired up to re-enable strict verification."""
    return (os.environ.get("EMAIL_VERIFICATION_REQUIRED", "false").lower() == "true")


@router.post("/auth/login")
async def login(payload: LoginRequest):
    user = await db.users.find_one({"email": payload.email.lower()}, {"_id": 0})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    # Enforce email verification for new users (existing users are grandfathered via migration)
    if _email_verification_required() and not user.get("email_verified", False):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "email_not_verified",
                "email": user["email"],
                "message": "Bitte bestätige zuerst deine E-Mail-Adresse. Du hast eine Mail von uns bekommen.",
            },
        )
    # Send welcome email lazily on FIRST verified login if not yet sent
    if not user.get("welcome_email_sent"):
        asyncio.create_task(_send_welcome_email(user))
        await db.users.update_one({"id": user["id"]}, {"$set": {"welcome_email_sent": True}})
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
