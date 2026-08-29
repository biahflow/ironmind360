from typing import Literal, Optional

from pydantic import BaseModel, Field

RaceType = Literal["sprint", "olympic", "half_ironman", "ironman", "custom"]
RacePriority = Literal["A", "B", "C"]


class RaceIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    race_type: RaceType
    priority: RacePriority = "B"
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    location: str = Field(default="", max_length=200)
    goal: str = Field(default="", max_length=500)
    result: Optional[str] = Field(default=None, max_length=500)
    notes: str = Field(default="", max_length=2000)
