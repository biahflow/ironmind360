from typing import Optional

from pydantic import BaseModel, Field


class ChecklistItemIn(BaseModel):
    text: str = Field(min_length=1, max_length=300)
    category: str = Field(default="general", max_length=50)
    checked: bool = False


class ChecklistIn(BaseModel):
    items: list[ChecklistItemIn] = Field(default_factory=list, max_length=100)


class RaceStrategyIn(BaseModel):
    swim_pace_per_100m: Optional[str] = Field(default=None, max_length=20)
    bike_power_watts: Optional[int] = Field(default=None, ge=0, le=1000)
    bike_speed_kmh: Optional[float] = Field(default=None, ge=0, le=100)
    run_pace_per_km: Optional[str] = Field(default=None, max_length=20)
    fueling_plan: str = Field(default="", max_length=3000)
    hydration_plan: str = Field(default="", max_length=2000)
    transition_notes: str = Field(default="", max_length=2000)
    mental_notes: str = Field(default="", max_length=2000)
    warm_up: str = Field(default="", max_length=1000)
    notes: str = Field(default="", max_length=3000)


class RaceRetrospectiveIn(BaseModel):
    overall_rating: int = Field(ge=1, le=5)
    swim_notes: str = Field(default="", max_length=2000)
    bike_notes: str = Field(default="", max_length=2000)
    run_notes: str = Field(default="", max_length=2000)
    nutrition_notes: str = Field(default="", max_length=2000)
    what_went_well: str = Field(default="", max_length=2000)
    what_to_improve: str = Field(default="", max_length=2000)
    finish_time: Optional[str] = Field(default=None, max_length=30)
    placement: Optional[str] = Field(default=None, max_length=50)
