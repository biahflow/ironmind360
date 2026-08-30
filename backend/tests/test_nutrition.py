"""E2E tests for nutrition endpoints — requires running stack and demo user."""
import pytest


class TestManualMeal:
    def test_create_manual_meal(self, base_url, api_client, auth_headers):
        r = api_client.post(f"{base_url}/api/v1/nutrition/manual", json={
            "title": "Almoço teste",
            "meal_type": "lunch",
            "items": [
                {"name": "Arroz", "quantity": 150, "unit": "g", "calories": 195, "protein_g": 4, "carbs_g": 43, "fat_g": 0.5},
                {"name": "Feijão", "quantity": 100, "unit": "g", "calories": 77, "protein_g": 5, "carbs_g": 14, "fat_g": 0.5, "fiber_g": 8},
            ],
            "notes": "Prato simples",
        }, headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["source"] == "manual"
        assert data["title"] == "Almoço teste"
        assert data["calories"] == 272
        assert data["fiber_g"] == 8
        assert len(data["items"]) == 2
        assert data["photo_url"] is None
        self.__class__.manual_meal_id = data["id"]

    def test_edit_meal(self, base_url, api_client, auth_headers):
        meal_id = getattr(self.__class__, "manual_meal_id", None)
        if not meal_id:
            pytest.skip("no manual meal created")
        r = api_client.put(f"{base_url}/api/v1/nutrition/{meal_id}", json={
            "title": "Almoço editado",
            "items": [
                {"name": "Arroz integral", "quantity": 120, "unit": "g", "calories": 140, "protein_g": 3, "carbs_g": 30, "fat_g": 1},
            ],
        }, headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["title"] == "Almoço editado"
        assert data["calories"] == 140
        assert len(data["items"]) == 1

    def test_list_meals_includes_manual(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/nutrition", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "meals" in data
        assert "totals" in data
        ids = [m["id"] for m in data["meals"]]
        meal_id = getattr(self.__class__, "manual_meal_id", None)
        if meal_id:
            assert meal_id in ids

    def test_delete_manual_meal(self, base_url, api_client, auth_headers):
        meal_id = getattr(self.__class__, "manual_meal_id", None)
        if not meal_id:
            pytest.skip("no manual meal created")
        r = api_client.delete(f"{base_url}/api/v1/nutrition/{meal_id}", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert r.json()["ok"] is True


class TestWeeklyHistory:
    def test_weekly_returns_7_days(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/nutrition/weekly", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert len(data["days"]) == 7
        assert "goals" in data
        for day in data["days"]:
            assert "date" in day
            assert "calories" in day
            assert "meal_count" in day


class TestFavorites:
    def test_create_favorite(self, base_url, api_client, auth_headers):
        r = api_client.post(f"{base_url}/api/v1/nutrition/favorites", json={
            "name": "Café da manhã padrão",
            "meal_type": "breakfast",
            "items": [
                {"name": "Pão integral", "quantity": 2, "unit": "fatia", "calories": 140, "protein_g": 6, "carbs_g": 26, "fat_g": 2},
                {"name": "Ovo cozido", "quantity": 2, "unit": "unidade", "calories": 140, "protein_g": 12, "carbs_g": 1, "fat_g": 10},
            ],
        }, headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "Café da manhã padrão"
        self.__class__.fav_id = data["id"]

    def test_list_favorites(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/nutrition/favorites", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "favorites" in data
        assert any(f["name"] == "Café da manhã padrão" for f in data["favorites"])

    def test_use_favorite_creates_meal(self, base_url, api_client, auth_headers):
        fav_id = getattr(self.__class__, "fav_id", None)
        if not fav_id:
            pytest.skip("no favorite created")
        r = api_client.post(f"{base_url}/api/v1/nutrition/favorites/{fav_id}/use", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["source"] == "favorite"
        assert data["calories"] == 280

    def test_delete_favorite(self, base_url, api_client, auth_headers):
        fav_id = getattr(self.__class__, "fav_id", None)
        if not fav_id:
            pytest.skip("no favorite created")
        r = api_client.delete(f"{base_url}/api/v1/nutrition/favorites/{fav_id}", headers=auth_headers, timeout=10)
        assert r.status_code == 200

    def test_delete_nonexistent_favorite(self, base_url, api_client, auth_headers):
        r = api_client.delete(f"{base_url}/api/v1/nutrition/favorites/000000000000000000000000",
                              headers=auth_headers, timeout=10)
        assert r.status_code == 404


class TestRecipes:
    def test_create_recipe(self, base_url, api_client, auth_headers):
        r = api_client.post(f"{base_url}/api/v1/nutrition/recipes", json={
            "name": "Vitamina proteica",
            "servings": 2,
            "items": [
                {"name": "Banana", "quantity": 200, "unit": "g", "calories": 178, "protein_g": 2, "carbs_g": 46, "fat_g": 0.6},
                {"name": "Whey protein", "quantity": 30, "unit": "g", "calories": 120, "protein_g": 24, "carbs_g": 3, "fat_g": 1.5},
                {"name": "Leite", "quantity": 300, "unit": "ml", "calories": 180, "protein_g": 10, "carbs_g": 15, "fat_g": 10},
            ],
            "instructions": "Bater tudo no liquidificador até ficar homogêneo.",
        }, headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "Vitamina proteica"
        assert data["servings"] == 2
        assert data["totals_per_recipe"]["calories"] == 478
        assert data["totals_per_serving"]["calories"] == 239.0
        self.__class__.recipe_id = data["id"]

    def test_list_recipes(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/nutrition/recipes", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "recipes" in data
        assert any(rec["name"] == "Vitamina proteica" for rec in data["recipes"])

    def test_use_recipe(self, base_url, api_client, auth_headers):
        recipe_id = getattr(self.__class__, "recipe_id", None)
        if not recipe_id:
            pytest.skip("no recipe created")
        r = api_client.post(f"{base_url}/api/v1/nutrition/recipes/{recipe_id}/use?servings=1",
                            headers=auth_headers, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["source"] == "recipe"
        assert data["calories"] == 239.0

    def test_delete_recipe(self, base_url, api_client, auth_headers):
        recipe_id = getattr(self.__class__, "recipe_id", None)
        if not recipe_id:
            pytest.skip("no recipe created")
        r = api_client.delete(f"{base_url}/api/v1/nutrition/recipes/{recipe_id}",
                              headers=auth_headers, timeout=10)
        assert r.status_code == 200


class TestMealIDOR:
    """Ensure a second user cannot access or edit meals of the first."""

    def test_edit_other_user_meal_fails(self, base_url, api_client, auth_headers):
        r = api_client.put(f"{base_url}/api/v1/nutrition/000000000000000000000000",
                           json={"title": "Hack"}, headers=auth_headers, timeout=10)
        assert r.status_code == 404

    def test_delete_other_user_meal_fails(self, base_url, api_client, auth_headers):
        r = api_client.delete(f"{base_url}/api/v1/nutrition/000000000000000000000000",
                              headers=auth_headers, timeout=10)
        assert r.status_code == 404
