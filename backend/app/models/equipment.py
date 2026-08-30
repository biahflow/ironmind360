from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class EquipmentCategory(str, Enum):
    shoes = "shoes"
    bike = "bike"
    component = "component"
    wetsuit = "wetsuit"
    accessory = "accessory"


class EquipmentIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: EquipmentCategory
    brand: str = Field(default="", max_length=100)
    model: str = Field(default="", max_length=100)
    purchase_date: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    max_distance_km: Optional[float] = Field(default=None, ge=0, le=100_000)
    max_hours: Optional[float] = Field(default=None, ge=0, le=50_000)
    maintenance_interval_km: Optional[float] = Field(default=None, ge=0, le=50_000)
    maintenance_interval_hours: Optional[float] = Field(default=None, ge=0, le=10_000)
    notes: str = Field(default="", max_length=2000)
    activity_types: list[str] = Field(default_factory=list, max_length=10)
    retired: bool = False
