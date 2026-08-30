from typing import Literal

from pydantic import BaseModel, Field


SupplementCategory = Literal[
    "protein", "caffeine", "creatine", "nitrate", "beta_alanine",
    "bicarbonate", "vitamin", "mineral", "iron", "other",
]

EvidenceLevel = Literal["strong", "moderate", "limited", "emerging"]


class SupplementCatalogEntry(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: SupplementCategory
    evidence_level: EvidenceLevel = "moderate"
    purpose: str = Field(max_length=500)
    form: str = Field(default="", max_length=100)
    dose_min: str = Field(default="", max_length=100)
    dose_max: str = Field(default="", max_length=100)
    timing: str = Field(default="", max_length=200)
    contraindications: list[str] = Field(default_factory=list, max_length=20)
    requires_professional: bool = False
    source: str = Field(default="", max_length=300)
    version: str = Field(default="1.0.0", max_length=20)


class SupplementLogIn(BaseModel):
    supplement_name: str = Field(min_length=1, max_length=200)
    category: SupplementCategory
    product: str = Field(default="", max_length=200)
    brand: str = Field(default="", max_length=100)
    dose: str = Field(min_length=1, max_length=100)
    timing: str = Field(default="", max_length=100)
    antidoping_cert: str = Field(default="", max_length=200)
    notes: str = Field(default="", max_length=500)


class FuelingLogIn(BaseModel):
    session_type: str = Field(default="", max_length=50)
    duration_min: int = Field(ge=0, le=1440)
    carb_g_per_hour: float = Field(default=0, ge=0, le=120)
    fluid_ml: int = Field(default=0, ge=0, le=10000)
    sodium_mg: int = Field(default=0, ge=0, le=5000)
    products_used: list[str] = Field(default_factory=list, max_length=20)
    gi_symptoms: str = Field(default="", max_length=300)
    rpe: int = Field(default=0, ge=0, le=10)
    notes: str = Field(default="", max_length=500)


class SweatTestIn(BaseModel):
    weight_pre_kg: float = Field(ge=30, le=300)
    weight_post_kg: float = Field(ge=30, le=300)
    fluid_intake_ml: int = Field(default=0, ge=0, le=10000)
    urine_ml: int = Field(default=0, ge=0, le=5000)
    duration_min: int = Field(ge=1, le=1440)
    temperature_c: float = Field(default=0, ge=-20, le=55)
    humidity_pct: int = Field(default=0, ge=0, le=100)
    session_type: str = Field(default="", max_length=50)
    notes: str = Field(default="", max_length=500)
