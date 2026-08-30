"""Testes E2E de pagamentos: onboarding, checkout, webhook, histórico e admin."""

import hashlib
import json

import pytest


class TestPaymentsConnect:
    def test_onboard_requires_auth(self, base_url, api_client):
        r = api_client.post(f"{base_url}/api/v1/payments/connect/onboard")
        assert r.status_code in (401, 403)

    def test_onboard_requires_professional_role(self, base_url, api_client, auth_headers):
        r = api_client.post(
            f"{base_url}/api/v1/payments/connect/onboard",
            json={"country": "BR"},
            headers=auth_headers,
        )
        assert r.status_code == 403

    def test_onboard_503_without_stripe(self, base_url, api_client, auth_headers):
        r = api_client.post(
            f"{base_url}/api/v1/payments/connect/onboard",
            json={"country": "BR"},
            headers=auth_headers,
        )
        assert r.status_code in (403, 503)

    def test_connect_status_no_account(self, base_url, api_client, auth_headers):
        r = api_client.get(
            f"{base_url}/api/v1/payments/connect/status",
            headers=auth_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["connected"] is False
        assert data["charges_enabled"] is False

    def test_dashboard_link_no_account(self, base_url, api_client, auth_headers):
        r = api_client.post(
            f"{base_url}/api/v1/payments/connect/dashboard-link",
            headers=auth_headers,
        )
        assert r.status_code == 404


class TestPaymentsCheckout:
    def test_checkout_invalid_professional(self, base_url, api_client, auth_headers):
        r = api_client.post(
            f"{base_url}/api/v1/payments/checkout",
            json={
                "professional_user_id": "000000000000000000000000",
                "package_id": "pkg-test",
            },
            headers=auth_headers,
        )
        assert r.status_code == 404

    def test_checkout_requires_auth(self, base_url, api_client):
        r = api_client.post(
            f"{base_url}/api/v1/payments/checkout",
            json={
                "professional_user_id": "000000000000000000000000",
                "package_id": "pkg-test",
            },
        )
        assert r.status_code in (401, 403)


class TestPaymentsHistory:
    def test_history_empty(self, base_url, api_client, auth_headers):
        r = api_client.get(
            f"{base_url}/api/v1/payments/history",
            headers=auth_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert "payments" in data
        assert isinstance(data["payments"], list)

    def test_history_requires_auth(self, base_url, api_client):
        r = api_client.get(f"{base_url}/api/v1/payments/history")
        assert r.status_code in (401, 403)


class TestPaymentsWebhook:
    def test_webhook_missing_signature(self, base_url, api_client):
        r = api_client.post(
            f"{base_url}/api/v1/payments/webhook",
            data=json.dumps({"type": "test"}),
            headers={"Content-Type": "application/json"},
        )
        assert r.status_code == 400

    def test_webhook_invalid_signature(self, base_url, api_client):
        r = api_client.post(
            f"{base_url}/api/v1/payments/webhook",
            data=json.dumps({"type": "test"}),
            headers={
                "Content-Type": "application/json",
                "Stripe-Signature": "t=123,v1=invalid",
            },
        )
        assert r.status_code in (400, 503)


class TestPaymentsAdmin:
    def test_admin_transactions_requires_admin(self, base_url, api_client, auth_headers):
        r = api_client.get(
            f"{base_url}/api/v1/payments/admin/transactions",
            headers=auth_headers,
        )
        assert r.status_code == 403

    def test_refund_requires_admin(self, base_url, api_client, auth_headers):
        r = api_client.post(
            f"{base_url}/api/v1/payments/refund",
            json={"payment_id": "000000000000000000000000"},
            headers=auth_headers,
        )
        assert r.status_code == 403
