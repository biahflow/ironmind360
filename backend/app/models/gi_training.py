from pydantic import BaseModel, Field


class GITrainingPlanIn(BaseModel):
    target_carb_g_per_hour: int = Field(default=90, ge=30, le=120)
    start_carb_g_per_hour: int = Field(default=30, ge=15, le=60)
    duration_weeks: int = Field(default=8, ge=4, le=16)
    sessions_per_week: int = Field(default=2, ge=1, le=4)
    preferred_products: list[str] = Field(default_factory=list, max_length=10)


class GISessionLogIn(BaseModel):
    week: int = Field(ge=1, le=16)
    session_number: int = Field(ge=1)
    planned_carb_g_per_hour: float = Field(ge=0, le=120)
    actual_carb_g_per_hour: float = Field(ge=0, le=120)
    duration_min: int = Field(ge=10, le=480)
    fluid_ml: int = Field(default=0, ge=0, le=10000)
    products_used: list[str] = Field(default_factory=list, max_length=10)
    tolerance_score: int = Field(ge=1, le=5)
    symptoms: list[str] = Field(default_factory=list, max_length=10)
    notes: str = Field(default="", max_length=500)
    activity_type: str = Field(default="running", max_length=50)
