from typing import Optional

from pydantic import BaseModel, Field


class RecipeIdeasIn(BaseModel):
    ingredients: list[str] = Field(min_length=1, max_length=30)
    meal_type: Optional[str] = Field(default=None, max_length=40)


class MealItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    quantity: float = Field(gt=0)
    unit: str = Field(default="g", max_length=30)
    calories: float = Field(default=0, ge=0)
    protein_g: float = Field(default=0, ge=0)
    carbs_g: float = Field(default=0, ge=0)
    fat_g: float = Field(default=0, ge=0)
    fiber_g: float = Field(default=0, ge=0)
    sodium_mg: float = Field(default=0, ge=0)
    sugar_g: float = Field(default=0, ge=0)


class ManualMealIn(BaseModel):
    meal_type: str = Field(
        default="meal",
        pattern=r"^(breakfast|morning_snack|lunch|afternoon_snack|dinner|supper|pre_workout|post_workout|meal)$",
    )
    title: str = Field(min_length=1, max_length=200)
    items: list[MealItemIn] = Field(default_factory=list, max_length=50)
    notes: str = Field(default="", max_length=500)


class MealEditIn(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    meal_type: Optional[str] = Field(
        default=None,
        pattern=r"^(breakfast|morning_snack|lunch|afternoon_snack|dinner|supper|pre_workout|post_workout|meal)$",
    )
    items: Optional[list[MealItemIn]] = Field(default=None, max_length=50)
    notes: Optional[str] = Field(default=None, max_length=500)


class FavoriteIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    meal_type: str = Field(
        default="meal",
        pattern=r"^(breakfast|morning_snack|lunch|afternoon_snack|dinner|supper|pre_workout|post_workout|meal)$",
    )
    items: list[MealItemIn] = Field(min_length=1, max_length=50)


class RecipeIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    servings: int = Field(ge=1, le=50, default=1)
    items: list[MealItemIn] = Field(min_length=1, max_length=100)
    instructions: str = Field(default="", max_length=2000)


HOUSEHOLD_MEASURES = {
    "colher_sopa": 15,
    "colher_cha": 5,
    "colher_sobremesa": 10,
    "xicara": 240,
    "copo": 200,
    "fatia": 30,
    "unidade": 1,
    "porcao": 1,
    "g": 1,
    "ml": 1,
    "kg": 1000,
    "litro": 1000,
}
