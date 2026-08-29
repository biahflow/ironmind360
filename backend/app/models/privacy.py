from typing import Literal

from pydantic import BaseModel, Field


ConsentPurpose = Literal[
    "terms",
    "privacy",
    "health_data",
    "ai_processing",
    "community",
]


class ConsentIn(BaseModel):
    purpose: ConsentPurpose
    version: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$")


class DeleteAccountIn(BaseModel):
    password: str = Field(min_length=1, max_length=128)
