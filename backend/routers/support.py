"""Support tickets router - extracted from server.py."""
from fastapi import APIRouter, Depends
import uuid
import logging

from server import (
    db, get_current_user, now_iso, log_activity, SUPPORT_EMAIL,
    SupportTicketRequest,
)

logger = logging.getLogger("alphafit")
router = APIRouter()


@router.post("/support/ticket")
async def create_support_ticket(payload: SupportTicketRequest, user: dict = Depends(get_current_user)):
    ticket = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user.get("name"),
        "user_email": user.get("email"),
        "subject": payload.subject.strip()[:200],
        "message": payload.message.strip()[:5000],
        "category": payload.category or "general",
        "status": "open",
        "admin_reply": None,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.support_tickets.insert_one(ticket)
    await log_activity(user["id"], user.get("name", ""), "support_ticket_created", {"subject": ticket["subject"], "category": ticket["category"]})
    return {"ok": True, "ticket_id": ticket["id"], "support_email": SUPPORT_EMAIL}


@router.get("/support/my-tickets")
async def my_tickets(user: dict = Depends(get_current_user)):
    tickets = await db.support_tickets.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"tickets": tickets, "support_email": SUPPORT_EMAIL}


@router.get("/support/info")
async def support_info():
    return {"support_email": SUPPORT_EMAIL}
