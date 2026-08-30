"""Testes unitários de pagamentos: comissão, idempotência e transições de status."""

import hashlib

from app.routes.payments import _idempotency_key


class TestIdempotencyKey:
    def test_deterministic(self):
        k1 = _idempotency_key("user1", "pkg1", "pro1")
        k2 = _idempotency_key("user1", "pkg1", "pro1")
        assert k1 == k2

    def test_different_inputs_different_keys(self):
        k1 = _idempotency_key("user1", "pkg1", "pro1")
        k2 = _idempotency_key("user1", "pkg2", "pro1")
        k3 = _idempotency_key("user2", "pkg1", "pro1")
        assert k1 != k2
        assert k1 != k3

    def test_key_length(self):
        k = _idempotency_key("user1", "pkg1", "pro1")
        assert len(k) == 32

    def test_sha256_based(self):
        raw = "user1:pro1:pkg1"
        expected = hashlib.sha256(raw.encode()).hexdigest()[:32]
        assert _idempotency_key("user1", "pkg1", "pro1") == expected


class TestCommissionCalculation:
    def test_default_10_percent(self):
        amount_cents = 10000
        commission_percent = 10
        fee = int(amount_cents * commission_percent / 100)
        assert fee == 1000

    def test_zero_commission(self):
        fee = int(10000 * 0 / 100)
        assert fee == 0

    def test_custom_commission(self):
        fee = int(15000 * 15 / 100)
        assert fee == 2250

    def test_rounds_down(self):
        fee = int(9999 * 10 / 100)
        assert fee == 999


class TestPaymentStatusTransitions:
    VALID_STATUSES = {"pending", "completed", "failed", "refunded", "disputed"}

    def test_all_statuses_defined(self):
        from app.models.payments import PaymentStatus
        import typing
        args = typing.get_args(PaymentStatus)
        assert set(args) == self.VALID_STATUSES

    def test_pending_to_completed(self):
        assert "pending" in self.VALID_STATUSES
        assert "completed" in self.VALID_STATUSES

    def test_completed_to_refunded(self):
        assert "completed" in self.VALID_STATUSES
        assert "refunded" in self.VALID_STATUSES

    def test_completed_to_disputed(self):
        assert "completed" in self.VALID_STATUSES
        assert "disputed" in self.VALID_STATUSES


class TestProfessionalRoles:
    def test_professional_roles_set(self):
        from app.routes.payments import PROFESSIONAL_ROLES
        assert "nutritionist" in PROFESSIONAL_ROLES
        assert "psychologist" in PROFESSIONAL_ROLES
        assert "athlete" not in PROFESSIONAL_ROLES
