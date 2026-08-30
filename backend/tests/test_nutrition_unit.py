"""Unit tests for nutrition models — no external dependencies."""
import pytest
from pydantic import ValidationError

from app.models.nutrition import (
    FavoriteIn,
    ManualMealIn,
    MealEditIn,
    MealItemIn,
    RecipeIn,
    HOUSEHOLD_MEASURES,
)


class TestMealItemIn:
    def test_valid_item(self):
        item = MealItemIn(name="Arroz", quantity=150, unit="g", calories=195, protein_g=4, carbs_g=43, fat_g=0.5)
        assert item.name == "Arroz"
        assert item.quantity == 150

    def test_defaults(self):
        item = MealItemIn(name="Ovo", quantity=1)
        assert item.unit == "g"
        assert item.fiber_g == 0
        assert item.sodium_mg == 0
        assert item.sugar_g == 0

    def test_empty_name_rejected(self):
        with pytest.raises(ValidationError):
            MealItemIn(name="", quantity=1)

    def test_negative_quantity_rejected(self):
        with pytest.raises(ValidationError):
            MealItemIn(name="Arroz", quantity=-1)

    def test_negative_macros_rejected(self):
        with pytest.raises(ValidationError):
            MealItemIn(name="Arroz", quantity=100, calories=-10)


class TestManualMealIn:
    def test_valid_manual(self):
        m = ManualMealIn(
            title="Almoço",
            meal_type="lunch",
            items=[MealItemIn(name="Arroz", quantity=150).model_dump()],
        )
        assert m.title == "Almoço"
        assert m.meal_type == "lunch"

    def test_default_type(self):
        m = ManualMealIn(title="Lanche")
        assert m.meal_type == "meal"
        assert m.items == []

    def test_invalid_type_rejected(self):
        with pytest.raises(ValidationError):
            ManualMealIn(title="X", meal_type="brunch")

    def test_all_meal_types(self):
        for t in ["breakfast", "morning_snack", "lunch", "afternoon_snack",
                   "dinner", "supper", "pre_workout", "post_workout", "meal"]:
            m = ManualMealIn(title="X", meal_type=t)
            assert m.meal_type == t

    def test_too_many_items(self):
        with pytest.raises(ValidationError):
            ManualMealIn(title="X", items=[{"name": f"i{i}", "quantity": 1} for i in range(51)])


class TestMealEditIn:
    def test_all_none(self):
        e = MealEditIn()
        assert e.title is None
        assert e.items is None

    def test_partial_update(self):
        e = MealEditIn(title="Novo título")
        assert e.title == "Novo título"
        assert e.items is None


class TestFavoriteIn:
    def test_valid(self):
        f = FavoriteIn(name="Café padrão", items=[{"name": "Pão", "quantity": 2, "unit": "unidade"}])
        assert f.name == "Café padrão"
        assert len(f.items) == 1

    def test_empty_items_rejected(self):
        with pytest.raises(ValidationError):
            FavoriteIn(name="Vazio", items=[])


class TestRecipeIn:
    def test_valid(self):
        r = RecipeIn(
            name="Vitamina",
            servings=2,
            items=[{"name": "Banana", "quantity": 200}, {"name": "Whey", "quantity": 30}],
            instructions="Bater tudo no liquidificador.",
        )
        assert r.servings == 2
        assert len(r.items) == 2

    def test_zero_servings_rejected(self):
        with pytest.raises(ValidationError):
            RecipeIn(name="X", servings=0, items=[{"name": "A", "quantity": 1}])

    def test_empty_items_rejected(self):
        with pytest.raises(ValidationError):
            RecipeIn(name="X", items=[])


class TestHouseholdMeasures:
    def test_known_measures(self):
        assert HOUSEHOLD_MEASURES["colher_sopa"] == 15
        assert HOUSEHOLD_MEASURES["xicara"] == 240
        assert HOUSEHOLD_MEASURES["g"] == 1
        assert "ml" in HOUSEHOLD_MEASURES
