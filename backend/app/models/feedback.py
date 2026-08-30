from pydantic import BaseModel, Field


class SupplementFeedbackIn(BaseModel):
    supplement_log_id: str = Field(min_length=1, max_length=30)
    benefit_perceived: int = Field(ge=0, le=10, default=5)
    energy_level: int = Field(ge=0, le=10, default=5)
    rpe_change: int = Field(ge=-5, le=5, default=0)
    hr_change: int = Field(ge=-30, le=30, default=0)
    sleep_quality: int = Field(ge=0, le=10, default=5)
    anxiety_level: int = Field(ge=0, le=10, default=0)
    palpitation: bool = False
    gi_symptoms: str = Field(default="", max_length=300)
    notes: str = Field(default="", max_length=500)


class NutritionFeedbackIn(BaseModel):
    meal_plan_id: str = Field(default="", max_length=30)
    date: str = Field(min_length=10, max_length=10)
    energy_level: int = Field(ge=0, le=10, default=5)
    satiety: int = Field(ge=0, le=10, default=5)
    gi_comfort: int = Field(ge=0, le=10, default=5)
    adherence_pct: int = Field(ge=0, le=100, default=100)
    notes: str = Field(default="", max_length=500)
