"""Pagamentos via Stripe Connect: onboarding profissional, checkout, webhooks e admin."""

import hashlib
import logging

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.adapters.payments import StripeClient
from app.config import settings
from app.database import db
from app.dependencies import current_user, require_roles
from app.models.payments import CheckoutIn, ProfessionalOnboardIn, RefundRequestIn
from app.rate_limit import rate_limit
from app.utils.time import now_utc


router = APIRouter(prefix="/payments", tags=["payments"])
logger = logging.getLogger("ironmind.payments")
_stripe = StripeClient()

PROFESSIONAL_ROLES = {"nutritionist", "psychologist"}


# --------------- Professional onboarding (Stripe Connect) ---------------

@router.post(
    "/connect/onboard",
    dependencies=[Depends(rate_limit("payments_onboard", 5, 60))],
)
async def connect_onboard(
    data: ProfessionalOnboardIn, user: dict = Depends(current_user)
):
    user_roles = set(user.get("roles", []))
    if not user_roles.intersection(PROFESSIONAL_ROLES):
        raise HTTPException(403, "Apenas profissionais podem criar conta de pagamentos")

    user_id = str(user["_id"])
    existing = await db.professional_accounts.find_one({"user_id": user_id})
    if existing and existing.get("account_id"):
        link = await _stripe.create_account_link(
            account_id=existing["account_id"],
            refresh_url=f"{settings.app_public_url}/settings?stripe=refresh",
            return_url=f"{settings.app_public_url}/settings?stripe=return",
        )
        return {"account_id": existing["account_id"], "onboarding_url": link["url"]}

    account = await _stripe.create_connect_account(
        email=user.get("email", ""),
        country=data.country.upper(),
        metadata={"user_id": user_id, "platform": "ironmind360"},
    )
    now = now_utc()
    await db.professional_accounts.update_one(
        {"user_id": user_id},
        {"$set": {
            "account_id": account["account_id"],
            "charges_enabled": False,
            "payouts_enabled": False,
            "created_at": now,
            "updated_at": now,
        }},
        upsert=True,
    )
    link = await _stripe.create_account_link(
        account_id=account["account_id"],
        refresh_url=f"{settings.app_public_url}/settings?stripe=refresh",
        return_url=f"{settings.app_public_url}/settings?stripe=return",
    )
    return {"account_id": account["account_id"], "onboarding_url": link["url"]}


@router.get("/connect/status")
async def connect_status(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    doc = await db.professional_accounts.find_one({"user_id": user_id})
    if not doc or not doc.get("account_id"):
        return {"connected": False, "charges_enabled": False, "payouts_enabled": False}

    try:
        status = await _stripe.retrieve_account(account_id=doc["account_id"])
        await db.professional_accounts.update_one(
            {"user_id": user_id},
            {"$set": {
                "charges_enabled": status["charges_enabled"],
                "payouts_enabled": status["payouts_enabled"],
                "updated_at": now_utc(),
            }},
        )
        return {
            "connected": True,
            "account_id": doc["account_id"],
            "charges_enabled": status["charges_enabled"],
            "payouts_enabled": status["payouts_enabled"],
            "details_submitted": status.get("details_submitted", False),
        }
    except HTTPException:
        return {
            "connected": True,
            "account_id": doc["account_id"],
            "charges_enabled": doc.get("charges_enabled", False),
            "payouts_enabled": doc.get("payouts_enabled", False),
        }


@router.post(
    "/connect/dashboard-link",
    dependencies=[Depends(rate_limit("payments_dashboard", 10, 60))],
)
async def connect_dashboard_link(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    doc = await db.professional_accounts.find_one({"user_id": user_id})
    if not doc or not doc.get("account_id"):
        raise HTTPException(404, "Conta de pagamentos nao encontrada")
    link = await _stripe.create_login_link(account_id=doc["account_id"])
    return {"url": link["url"]}


# --------------- Checkout ---------------

def _idempotency_key(payer_id: str, package_id: str, professional_id: str) -> str:
    raw = f"{payer_id}:{professional_id}:{package_id}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


@router.post(
    "/checkout",
    dependencies=[Depends(rate_limit("payments_checkout", 10, 60))],
)
async def create_checkout(data: CheckoutIn, user: dict = Depends(current_user)):
    payer_id = str(user["_id"])
    if not ObjectId.is_valid(data.professional_user_id):
        raise HTTPException(404, "Profissional nao encontrado")

    professional = await db.users.find_one({
        "_id": ObjectId(data.professional_user_id),
        "deleted_at": None,
    })
    if not professional:
        raise HTTPException(404, "Profissional nao encontrado")
    pro_roles = set(professional.get("roles", []))
    if not pro_roles.intersection(PROFESSIONAL_ROLES):
        raise HTTPException(404, "Profissional nao encontrado")

    pro_account = await db.professional_accounts.find_one({
        "user_id": data.professional_user_id
    })
    if not pro_account or not pro_account.get("charges_enabled"):
        raise HTTPException(400, "Profissional ainda nao pode receber pagamentos")

    idem_key = _idempotency_key(payer_id, data.package_id, data.professional_user_id)
    existing = await db.payments.find_one({
        "idempotency_key": idem_key, "status": "pending",
    })
    if existing:
        return {
            "payment_id": str(existing["_id"]),
            "checkout_url": existing.get("checkout_url", ""),
            "status": "pending",
        }

    amount_cents = 10000
    commission = settings.stripe_commission_percent
    commission_cents = int(amount_cents * commission / 100)
    now = now_utc()

    session = await _stripe.create_checkout_session(
        account_id=pro_account["account_id"],
        amount_cents=amount_cents,
        currency="brl",
        description=f"Pacote {data.package_id}",
        metadata={
            "payer_id": payer_id,
            "professional_id": data.professional_user_id,
            "package_id": data.package_id,
        },
        commission_percent=commission,
        success_url=f"{settings.app_public_url}/payments/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{settings.app_public_url}/payments/cancel",
    )

    payment_doc = {
        "payer_user_id": payer_id,
        "receiver_user_id": data.professional_user_id,
        "package_id": data.package_id,
        "amount_cents": amount_cents,
        "currency": "brl",
        "commission_cents": commission_cents,
        "status": "pending",
        "stripe_session_id": session["session_id"],
        "stripe_payment_intent_id": session.get("payment_intent"),
        "checkout_url": session["url"],
        "idempotency_key": idem_key,
        "created_at": now,
        "completed_at": None,
        "refunded_at": None,
        "disputed_at": None,
        "refund_reason": None,
    }
    result = await db.payments.insert_one(payment_doc)
    return {
        "payment_id": str(result.inserted_id),
        "checkout_url": session["url"],
        "status": "pending",
    }


# --------------- Payment history ---------------

@router.get("/history")
async def payment_history(
    limit: int = Query(default=20, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
    user: dict = Depends(current_user),
):
    user_id = str(user["_id"])
    user_roles = set(user.get("roles", []))
    query: dict
    if user_roles.intersection(PROFESSIONAL_ROLES):
        query = {"$or": [
            {"payer_user_id": user_id},
            {"receiver_user_id": user_id},
        ]}
    else:
        query = {"payer_user_id": user_id}

    docs = await db.payments.find(query).sort("created_at", -1).skip(skip).to_list(limit)
    payments = []
    for d in docs:
        payments.append({
            "id": str(d["_id"]),
            "payer_user_id": d["payer_user_id"],
            "receiver_user_id": d["receiver_user_id"],
            "package_id": d["package_id"],
            "amount_cents": d["amount_cents"],
            "currency": d["currency"],
            "commission_cents": d["commission_cents"],
            "status": d["status"],
            "created_at": d["created_at"].isoformat() if d.get("created_at") else None,
            "completed_at": d["completed_at"].isoformat() if d.get("completed_at") else None,
        })
    return {"payments": payments, "count": len(payments)}


# --------------- Webhook ---------------

@router.post(
    "/webhook",
    dependencies=[Depends(rate_limit("payments_webhook", 100, 60))],
)
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature", "")
    if not sig_header:
        raise HTTPException(400, "Assinatura ausente")

    event = _stripe.construct_webhook_event(payload=payload, sig_header=sig_header)
    event_id = event["id"]

    existing = await db.payment_events.find_one({"event_id": event_id})
    if existing:
        return {"ok": True, "duplicate": True}

    await db.payment_events.insert_one({
        "event_id": event_id,
        "type": event["type"],
        "processed_at": now_utc(),
    })

    event_type = event["type"]
    data_obj = event["data"]
    now = now_utc()

    if event_type == "checkout.session.completed":
        session_id = data_obj.get("id") if isinstance(data_obj, dict) else getattr(data_obj, "id", None)
        if session_id:
            payment_intent = (
                data_obj.get("payment_intent")
                if isinstance(data_obj, dict)
                else getattr(data_obj, "payment_intent", None)
            )
            await db.payments.update_one(
                {"stripe_session_id": session_id},
                {"$set": {
                    "status": "completed",
                    "stripe_payment_intent_id": payment_intent,
                    "completed_at": now,
                }},
            )

    elif event_type == "charge.refunded":
        pi_id = (data_obj.get("payment_intent") if isinstance(data_obj, dict)
                 else getattr(data_obj, "payment_intent", None))
        if pi_id:
            await db.payments.update_one(
                {"stripe_payment_intent_id": pi_id},
                {"$set": {"status": "refunded", "refunded_at": now}},
            )

    elif event_type == "charge.dispute.created":
        pi_id = (data_obj.get("payment_intent") if isinstance(data_obj, dict)
                 else getattr(data_obj, "payment_intent", None))
        if pi_id:
            await db.payments.update_one(
                {"stripe_payment_intent_id": pi_id},
                {"$set": {"status": "disputed", "disputed_at": now}},
            )

    return {"ok": True}


# --------------- Admin ---------------

@router.post("/refund", dependencies=[Depends(rate_limit("payments_refund", 10, 60))])
async def admin_refund(
    data: RefundRequestIn,
    user: dict = Depends(require_roles("administrator")),
):
    if not ObjectId.is_valid(data.payment_id):
        raise HTTPException(404, "Pagamento nao encontrado")

    payment = await db.payments.find_one({"_id": ObjectId(data.payment_id)})
    if not payment:
        raise HTTPException(404, "Pagamento nao encontrado")
    if payment["status"] != "completed":
        raise HTTPException(400, "Apenas pagamentos concluidos podem ser reembolsados")
    if not payment.get("stripe_payment_intent_id"):
        raise HTTPException(400, "Pagamento sem referencia no Stripe")

    refund = await _stripe.create_refund(
        payment_intent_id=payment["stripe_payment_intent_id"],
        reason=data.reason,
    )

    await db.payments.update_one(
        {"_id": payment["_id"]},
        {"$set": {
            "status": "refunded",
            "refunded_at": now_utc(),
            "refund_reason": data.reason or None,
        }},
    )

    await db.audit_events.insert_one({
        "actor_user_id": str(user["_id"]),
        "action": "payment_refund",
        "target_id": str(payment["_id"]),
        "details": {"refund_id": refund["refund_id"], "reason": data.reason},
        "created_at": now_utc(),
    })

    return {"ok": True, "refund_id": refund["refund_id"], "status": refund["status"]}


@router.get("/admin/transactions")
async def admin_transactions(
    status: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    skip: int = Query(default=0, ge=0),
    user: dict = Depends(require_roles("administrator")),
):
    query: dict = {}
    if status:
        query["status"] = status

    docs = await db.payments.find(query).sort("created_at", -1).skip(skip).to_list(limit)
    total = await db.payments.count_documents(query)

    transactions = []
    for d in docs:
        transactions.append({
            "id": str(d["_id"]),
            "payer_user_id": d["payer_user_id"],
            "receiver_user_id": d["receiver_user_id"],
            "package_id": d["package_id"],
            "amount_cents": d["amount_cents"],
            "currency": d["currency"],
            "commission_cents": d["commission_cents"],
            "status": d["status"],
            "created_at": d["created_at"].isoformat() if d.get("created_at") else None,
            "completed_at": d["completed_at"].isoformat() if d.get("completed_at") else None,
            "refunded_at": d["refunded_at"].isoformat() if d.get("refunded_at") else None,
            "disputed_at": d["disputed_at"].isoformat() if d.get("disputed_at") else None,
            "refund_reason": d.get("refund_reason"),
        })

    return {"transactions": transactions, "total": total}
