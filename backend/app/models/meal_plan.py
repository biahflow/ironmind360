from typing import Literal

from pydantic import BaseModel, Field


PlanStatus = Literal["draft", "professional_review", "published", "superseded"]

DayOfWeek = Literal["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


class PlanMealItem(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    quantity: float = Field(gt=0)
    unit: str = Field(default="g", max_length=30)
    calories: float = Field(default=0, ge=0)
    protein_g: float = Field(default=0, ge=0)
    carbs_g: float = Field(default=0, ge=0)
    fat_g: float = Field(default=0, ge=0)
    fiber_g: float = Field(default=0, ge=0)


class PlanMeal(BaseModel):
    meal_type: str = Field(max_length=30)
    title: str = Field(min_length=1, max_length=200)
    items: list[PlanMealItem] = Field(default_factory=list, max_length=30)
    substitutions: list[str] = Field(default_factory=list, max_length=10)
    notes: str = Field(default="", max_length=500)


class PlanDay(BaseModel):
    day: DayOfWeek
    label: str = Field(default="", max_length=100)
    meals: list[PlanMeal] = Field(default_factory=list, max_length=10)
    training_note: str = Field(default="", max_length=300)


class MealPlanCreateIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    goal: str = Field(default="", max_length=300)
    days: list[PlanDay] = Field(min_length=1, max_length=7)
    shopping_list: list[str] = Field(default_factory=list, max_length=200)
    notes: str = Field(default="", max_length=1000)


class MealPlanReviewIn(BaseModel):
    comments: str = Field(default="", max_length=2000)
    approved: bool = False


class NutritionScreeningIn(BaseModel):
    """Triagem de segurança nutricional para gerar planos."""
    height_cm: float = Field(ge=100, le=250)
    weight_kg: float = Field(ge=30, le=300)
    age: int = Field(ge=18, le=100)
    sex: Literal["male", "female"]
    activity_level: Literal["sedentary", "light", "moderate", "active", "very_active"]
    goal: Literal["maintenance", "fat_loss", "muscle_gain", "performance", "health"]
    medical_conditions: list[str] = Field(default_factory=list, max_length=20)
    medications: list[str] = Field(default_factory=list, max_length=20)
    pregnant_or_lactating: bool = False
    eating_disorder_history: bool = False
    supplements_current: list[str] = Field(default_factory=list, max_length=20)
