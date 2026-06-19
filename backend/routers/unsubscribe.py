"""Public unsubscribe router - one-click email opt-out via signed token.
NO authentication required (links are sent via email)."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import logging

from server import db, now_iso, decode_unsub_token
from routers.push import EmailPrefs, DEFAULT_EMAIL_PREFS, DEFAULT_PUSH_PREFS

logger = logging.getLogger("alphafit")
router = APIRouter()


class UnsubVerifyResponse(BaseModel):
    email: str
    name: str
    email_prefs: EmailPrefs


class UnsubUpdateRequest(BaseModel):
    token: str
    email_prefs: EmailPrefs


async def _load_user_from_token(token: str) -> dict:
    user_id = decode_unsub_token(token)
    if not user_id:
        raise HTTPException(status_code=400, detail="Ungültiger oder abgelaufener Link")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User nicht gefunden")
    return user


@router.get("/unsubscribe/verify", response_model=UnsubVerifyResponse)
async def unsubscribe_verify(token: str) -> UnsubVerifyResponse:
    """Validate token + return current email preferences. Used by the public /unsubscribe page on load."""
    user = await _load_user_from_token(token)
    prefs = user.get("notification_prefs") or {}
    email_data = {**DEFAULT_EMAIL_PREFS, **(prefs.get("email") or {})}
    return UnsubVerifyResponse(
        email=user.get("email") or "",
        name=user.get("name") or "Champion",
        email_prefs=EmailPrefs(**email_data),
    )


@router.post("/unsubscribe/update")
async def unsubscribe_update(payload: UnsubUpdateRequest) -> dict:
    """Update only the email_prefs (push prefs untouched)."""
    user = await _load_user_from_token(payload.token)
    existing = user.get("notification_prefs") or {}
    push_data = {**DEFAULT_PUSH_PREFS, **(existing.get("push") or {})}
    new_prefs = {"email": payload.email_prefs.model_dump(), "push": push_data}
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"notification_prefs": new_prefs, "unsubscribe_updated_at": now_iso()}},
    )
    return {"ok": True, "email_prefs": payload.email_prefs.model_dump()}


@router.post("/unsubscribe/all")
async def unsubscribe_all(payload: dict) -> dict:
    """One-click 'Alle Emails abbestellen' - sets all 4 email triggers to False."""
    token = (payload or {}).get("token") or ""
    user = await _load_user_from_token(token)
    existing = user.get("notification_prefs") or {}
    push_data = {**DEFAULT_PUSH_PREFS, **(existing.get("push") or {})}
    all_off = {k: False for k in DEFAULT_EMAIL_PREFS}
    new_prefs = {"email": all_off, "push": push_data}
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"notification_prefs": new_prefs, "unsubscribe_updated_at": now_iso()}},
    )
    return {"ok": True, "email_prefs": all_off}
