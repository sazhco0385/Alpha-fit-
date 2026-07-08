"""Email verification flow — POST /register creates unverified user + sends token link,
GET /verify-email?token=XYZ activates account, POST /resend re-issues the mail.

Storage: db.email_verifications collection with fields:
{ token: str, user_id: str, email: str, created_at: iso, expires_at: iso, used: bool, sent_at: iso }
Token = secrets.token_urlsafe(32). Single-use, 24h expiration.
"""
import secrets
import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from server import db, now_iso

logger = logging.getLogger("alphafit")
router = APIRouter()

TOKEN_TTL_HOURS = 24
RESEND_COOLDOWN_SECONDS = 60  # min. seconds between resend attempts for the same email


class ResendRequest(BaseModel):
    email: EmailStr


def _generate_token() -> str:
    return secrets.token_urlsafe(32)


async def create_and_send_verification(user: dict) -> None:
    """Create a verification token doc + send the email. Non-throwing."""
    try:
        token = _generate_token()
        now = datetime.now(timezone.utc)
        expires = now + timedelta(hours=TOKEN_TTL_HOURS)
        await db.email_verifications.insert_one({
            "token": token,
            "user_id": user["id"],
            "email": user["email"],
            "created_at": now.isoformat(),
            "expires_at": expires.isoformat(),
            "used": False,
            "sent_at": now.isoformat(),
        })
        # Send the mail
        from email_service import send_email, render_verify_email, APP_URL
        verify_url = f"{APP_URL}/verify-email?token={token}"
        subject, html = render_verify_email(user.get("name") or "Champion", verify_url)
        email_id = await send_email(user["email"], subject, html, tag="verify_email")
        await db.email_log.insert_one({
            "user_id": user["id"], "email": user["email"], "template": "verify_email",
            "resend_id": email_id, "ok": bool(email_id), "sent_at": now_iso(),
        })
        logger.info(f"verify email queued for {user.get('email')} (token stored, email_id={email_id})")
    except Exception as e:
        logger.error(f"verify email creation failed for {user.get('email')}: {e}")


@router.get("/auth/verify-email")
async def verify_email(token: str):
    if not token or len(token) < 20:
        raise HTTPException(status_code=400, detail="Ungültiger Token")
    doc = await db.email_verifications.find_one({"token": token}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Token nicht gefunden")
    if doc.get("used"):
        return {"ok": True, "already_verified": True, "email": doc.get("email")}
    try:
        expires = datetime.fromisoformat(str(doc["expires_at"]).replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(status_code=400, detail="Ungültiges Token-Format")
    if datetime.now(timezone.utc) > expires:
        raise HTTPException(status_code=410, detail="Token abgelaufen - bitte erneut anfordern")

    # Mark user verified + token used
    await db.users.update_one(
        {"id": doc["user_id"]},
        {"$set": {"email_verified": True, "email_verified_at": now_iso()}},
    )
    await db.email_verifications.update_one(
        {"token": token},
        {"$set": {"used": True, "used_at": now_iso()}},
    )
    logger.info(f"user {doc.get('email')} email verified via token")
    return {"ok": True, "already_verified": False, "email": doc.get("email")}


@router.post("/auth/resend-verification")
async def resend_verification(payload: ResendRequest):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    # Do NOT reveal whether the email exists (email enumeration protection)
    if not user:
        return {"ok": True, "message": "Falls die E-Mail registriert ist, wurde eine Bestätigungsmail versendet."}
    if user.get("email_verified"):
        return {"ok": True, "already_verified": True, "message": "E-Mail ist bereits bestätigt."}

    # Rate-limit: check most recent sent_at for this email
    recent = await db.email_verifications.find(
        {"email": email}, {"_id": 0}
    ).sort("sent_at", -1).limit(1).to_list(1)
    if recent:
        try:
            last = datetime.fromisoformat(str(recent[0]["sent_at"]).replace("Z", "+00:00"))
            age = (datetime.now(timezone.utc) - last).total_seconds()
            if age < RESEND_COOLDOWN_SECONDS:
                wait = int(RESEND_COOLDOWN_SECONDS - age)
                raise HTTPException(
                    status_code=429,
                    detail=f"Bitte warte noch {wait}s bevor du erneut anforderst.",
                )
        except HTTPException:
            raise
        except Exception:
            pass

    await create_and_send_verification(user)
    return {"ok": True, "message": "Bestätigungsmail versendet"}
