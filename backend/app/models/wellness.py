from typing import Literal, Optional

from pydantic import BaseModel, Field


class PainEntry(BaseModel):
    location: str = Field(min_length=1, max_length=80)
    intensity: int = Field(ge=1, le=10)
    notes: str = Field(default="", max_length=500)


class PainCheckIn(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    entries: list[PainEntry] = Field(default_factory=list, max_length=20)


HabitKind = Literal["boolean", "quantity", "duration_min"]


class CustomHabitIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    kind: HabitKind = "boolean"
    target: Optional[float] = Field(default=None, ge=0)
    unit: str = Field(default="", max_length=30)
    icon: str = Field(default="ellipse-outline", max_length=40)


class CustomHabitLogIn(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    value: float = Field(ge=0)


class BodyPhotoIn(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
