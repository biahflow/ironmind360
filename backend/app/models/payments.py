from typing import Literal

from pydantic import BaseModel, Field


PaymentStatus = Literal["pending", "completed", "failed", "refunded", "disputed"]


class ProfessionalOnboardIn(BaseModel):
    country: str = Field(default="BR", min_length=2, max_length=2)


class CheckoutIn(BaseModel):
    professional_user_id: str
    package_id: str


class RefundRequestIn(BaseModel):
    payment_id: str
    reason: str = Field(default="", max_length=500)
