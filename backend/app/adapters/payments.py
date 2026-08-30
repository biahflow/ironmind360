import asyncio
import logging

from fastapi import HTTPException

from app.config import settings


logger = logging.getLogger("ironmind.payments")

try:
    import stripe as _stripe
except ImportError:
    _stripe = None  # type: ignore[assignment]


def _require_stripe():
    if _stripe is None or not settings.stripe_secret_key:
        raise HTTPException(503, "Provider de pagamentos nao configurado")
    _stripe.api_key = settings.stripe_secret_key


class StripeClient:
    async def create_connect_account(
        self, *, email: str, country: str, metadata: dict
    ) -> dict:
        _require_stripe()

        def _create():
            return _stripe.Account.create(
                type="express",
                country=country,
                email=email,
                metadata=metadata,
                capabilities={
                    "card_payments": {"requested": True},
                    "transfers": {"requested": True},
                },
            )

        account = await asyncio.to_thread(_create)
        return {
            "account_id": account.id,
            "charges_enabled": account.charges_enabled,
            "payouts_enabled": account.payouts_enabled,
        }

    async def create_account_link(
        self, *, account_id: str, refresh_url: str, return_url: str
    ) -> dict:
        _require_stripe()

        def _create():
            return _stripe.AccountLink.create(
                account=account_id,
                refresh_url=refresh_url,
                return_url=return_url,
                type="account_onboarding",
            )

        link = await asyncio.to_thread(_create)
        return {"url": link.url, "expires_at": link.expires_at}

    async def retrieve_account(self, *, account_id: str) -> dict:
        _require_stripe()

        def _retrieve():
            return _stripe.Account.retrieve(account_id)

        account = await asyncio.to_thread(_retrieve)
        return {
            "account_id": account.id,
            "charges_enabled": account.charges_enabled,
            "payouts_enabled": account.payouts_enabled,
            "details_submitted": account.details_submitted,
        }

    async def create_login_link(self, *, account_id: str) -> dict:
        _require_stripe()

        def _create():
            return _stripe.Account.create_login_link(account_id)

        link = await asyncio.to_thread(_create)
        return {"url": link.url}

    async def create_checkout_session(
        self,
        *,
        account_id: str,
        amount_cents: int,
        currency: str,
        description: str,
        metadata: dict,
        commission_percent: int,
        success_url: str,
        cancel_url: str,
    ) -> dict:
        _require_stripe()
        fee = int(amount_cents * commission_percent / 100)

        def _create():
            return _stripe.checkout.Session.create(
                mode="payment",
                line_items=[{
                    "price_data": {
                        "currency": currency,
                        "unit_amount": amount_cents,
                        "product_data": {"name": description},
                    },
                    "quantity": 1,
                }],
                payment_intent_data={
                    "application_fee_amount": fee,
                    "transfer_data": {"destination": account_id},
                    "metadata": metadata,
                },
                metadata=metadata,
                success_url=success_url,
                cancel_url=cancel_url,
            )

        session = await asyncio.to_thread(_create)
        return {
            "session_id": session.id,
            "url": session.url,
            "payment_intent": session.payment_intent,
        }

    async def retrieve_checkout_session(self, *, session_id: str) -> dict:
        _require_stripe()

        def _retrieve():
            return _stripe.checkout.Session.retrieve(session_id)

        session = await asyncio.to_thread(_retrieve)
        return {
            "session_id": session.id,
            "status": session.status,
            "payment_status": session.payment_status,
            "payment_intent": session.payment_intent,
        }

    async def create_refund(
        self,
        *,
        payment_intent_id: str,
        amount_cents: int | None = None,
        reason: str = "",
    ) -> dict:
        _require_stripe()
        params: dict = {"payment_intent": payment_intent_id}
        if amount_cents is not None:
            params["amount"] = amount_cents
        if reason:
            params["metadata"] = {"reason": reason}

        def _create():
            return _stripe.Refund.create(**params)

        refund = await asyncio.to_thread(_create)
        return {"refund_id": refund.id, "status": refund.status, "amount": refund.amount}

    def construct_webhook_event(self, *, payload: bytes, sig_header: str) -> dict:
        _require_stripe()
        if not settings.stripe_webhook_secret:
            raise HTTPException(503, "Webhook secret nao configurado")
        try:
            event = _stripe.Webhook.construct_event(
                payload, sig_header, settings.stripe_webhook_secret
            )
        except _stripe.error.SignatureVerificationError:
            raise HTTPException(400, "Assinatura do webhook invalida")
        except Exception:
            raise HTTPException(400, "Payload do webhook invalido")
        return {"id": event.id, "type": event.type, "data": event.data.object}
