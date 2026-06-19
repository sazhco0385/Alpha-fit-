"""Payments router (Stripe Checkout + Webhook) - extracted from server.py."""
from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timezone, timedelta
import uuid
import os
import logging
import stripe

from server import (
    db, get_current_user, now_iso, log_activity,
    CheckoutRequest, PLANS, TRIAL_DAYS,
)

logger = logging.getLogger("alphafit")
router = APIRouter()


@router.post("/payments/checkout")
async def create_checkout(payload: CheckoutRequest, user: dict = Depends(get_current_user)):
    if payload.plan not in PLANS:
        raise HTTPException(status_code=400, detail="Ungültiger Plan")
    p = PLANS[payload.plan]
    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/payment-return?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/premium"

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            customer_email=user["email"],
            line_items=[{
                "price_data": {
                    "currency": p["currency"],
                    "product_data": {"name": f"alpha-fit Premium - {p['label']}"},
                    "recurring": {"interval": p["interval"], "interval_count": p["interval_count"]},
                    "unit_amount": int(p["amount"] * 100),
                },
                "quantity": 1,
            }],
            subscription_data={"trial_period_days": TRIAL_DAYS, "metadata": {"user_id": user["id"], "plan": payload.plan}},
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"user_id": user["id"], "plan": payload.plan},
        )
    except Exception as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=500, detail=f"Stripe Fehler: {str(e)}")

    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_email": user["email"],
        "session_id": session.id,
        "plan": payload.plan,
        "amount": p["amount"],
        "currency": p["currency"],
        "status": "initiated",
        "payment_status": "pending",
        "created_at": now_iso(),
    })
    await log_activity(user["id"], user.get("name", ""), "checkout_started", {"plan": payload.plan, "amount": p["amount"]})
    return {"url": session.url, "session_id": session.id}

@router.get("/payments/status/{session_id}")
async def payment_status(session_id: str, user: dict = Depends(get_current_user)):
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaktion nicht gefunden")

    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    payment_status_str = session.get("payment_status") or "unpaid"
    status_str = session.get("status") or "open"

    # idempotent update
    if tx.get("payment_status") != "paid" and (payment_status_str in ("paid", "no_payment_required") or status_str == "complete"):
        # activate premium
        plan = PLANS.get(tx["plan"])
        if plan:
            until = datetime.now(timezone.utc) + timedelta(days=TRIAL_DAYS + plan["days"])
            await db.users.update_one(
                {"id": tx["user_id"]},
                {"$set": {
                    "is_premium": True,
                    "premium_until": until.isoformat(),
                    "trial_until": (datetime.now(timezone.utc) + timedelta(days=TRIAL_DAYS)).isoformat(),
                    "stripe_customer_id": session.get("customer"),
                    "stripe_subscription_id": session.get("subscription"),
                }}
            )
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": status_str, "payment_status": "paid", "completed_at": now_iso()}}
        )
        await log_activity(tx["user_id"], "", "payment_succeeded", {"plan": tx["plan"], "amount": tx.get("amount")})

    return {
        "status": status_str,
        "payment_status": payment_status_str,
        "amount_total": session.get("amount_total"),
        "currency": session.get("currency"),
    }

@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    try:
        if secret:
            event = stripe.Webhook.construct_event(body, sig, secret)
        else:
            event = json.loads(body.decode())
    except Exception as e:
        logger.error(f"Webhook parse error: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")

    etype = event.get("type") if isinstance(event, dict) else event["type"]
    data_obj = event["data"]["object"] if isinstance(event, dict) else event.data.object

    if etype == "checkout.session.completed":
        sid = data_obj.get("id")
        meta = data_obj.get("metadata") or {}
        user_id = meta.get("user_id")
        plan = meta.get("plan")
        p = PLANS.get(plan or "")
        if user_id and p:
            until = datetime.now(timezone.utc) + timedelta(days=TRIAL_DAYS + p["days"])
            await db.users.update_one(
                {"id": user_id},
                {"$set": {
                    "is_premium": True,
                    "premium_until": until.isoformat(),
                    "trial_until": (datetime.now(timezone.utc) + timedelta(days=TRIAL_DAYS)).isoformat(),
                    "stripe_customer_id": data_obj.get("customer"),
                    "stripe_subscription_id": data_obj.get("subscription"),
                }}
            )
        await db.payment_transactions.update_one(
            {"session_id": sid},
            {"$set": {"payment_status": "paid", "status": "complete", "completed_at": now_iso()}}
        )
    return {"received": True}


# ===== Admin =====
