"""E2E tests for meal plans — requires running stack and demo user."""
import pytest


SAMPLE_PLAN = {
    "title": "Plano semanal teste",
    "goal": "Manutenção para treino de triatlo",
    "days": [
        {
            "day": "monday",
            "label": "Segunda - dia de corrida",
            "meals": [
                {
                    "meal_type": "breakfast",
                    "title": "Café da manhã",
                    "items": [
                        {"name": "Aveia", "quantity": 50, "unit": "g", "calories": 190, "protein_g": 7, "carbs_g": 34, "fat_g": 3.5},
                        {"name": "Banana", "quantity": 1, "unit": "unidade", "calories": 89, "protein_g": 1, "carbs_g": 23, "fat_g": 0.3},
                    ],
                    "substitutions": ["Granola no lugar da aveia"],
                    "notes": "",
                },
                {
                    "meal_type": "lunch",
                    "title": "Almoço",
                    "items": [
                        {"name": "Arroz integral", "quantity": 150, "unit": "g", "calories": 170, "protein_g": 4, "carbs_g": 36, "fat_g": 1.5},
                        {"name": "Frango grelhado", "quantity": 150, "unit": "g", "calories": 230, "protein_g": 35, "carbs_g": 0, "fat_g": 9},
                    ],
                    "substitutions": [],
                    "notes": "",
                },
            ],
            "training_note": "Corrida leve 45min",
        },
    ],
    "shopping_list": ["Aveia", "Banana", "Arroz integral", "Frango"],
    "notes": "Plano gerado para teste",
}

SAMPLE_SCREENING = {
    "height_cm": 178,
    "weight_kg": 75,
    "age": 32,
    "sex": "male",
    "activity_level": "active",
    "goal": "performance",
    "medical_conditions": [],
    "medications": [],
    "pregnant_or_lactating": False,
    "eating_disorder_history": False,
    "supplements_current": ["Whey", "Creatina"],
}


class TestScreening:
    def test_save_screening(self, base_url, api_client, auth_headers):
        r = api_client.post(f"{base_url}/api/v1/meal-plans/screening",
                            json=SAMPLE_SCREENING, headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True

    def test_get_screening(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/meal-plans/screening",
                           headers=auth_headers, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["screening"] is not None
        assert data["screening"]["weight_kg"] == 75
        assert data["screening"]["goal"] == "performance"

    def test_update_screening(self, base_url, api_client, auth_headers):
        updated = {**SAMPLE_SCREENING, "weight_kg": 74}
        r = api_client.post(f"{base_url}/api/v1/meal-plans/screening",
                            json=updated, headers=auth_headers, timeout=10)
        assert r.status_code == 200
        r2 = api_client.get(f"{base_url}/api/v1/meal-plans/screening",
                            headers=auth_headers, timeout=10)
        assert r2.json()["screening"]["weight_kg"] == 74


class TestMealPlanCRUD:
    def test_create_plan(self, base_url, api_client, auth_headers):
        existing = api_client.get(f"{base_url}/api/v1/meal-plans",
                                  headers=auth_headers, timeout=10)
        if existing.status_code == 200:
            for p in existing.json().get("plans", []):
                api_client.delete(f"{base_url}/api/v1/meal-plans/{p['id']}",
                                  headers=auth_headers, timeout=10)

        r = api_client.post(f"{base_url}/api/v1/meal-plans",
                            json=SAMPLE_PLAN, headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "draft"
        assert data["title"] == "Plano semanal teste"
        assert len(data["days"]) == 1
        assert len(data["days"][0]["meals"]) == 2
        self.__class__.plan_id = data["id"]

    def test_list_plans(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/meal-plans",
                           headers=auth_headers, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "plans" in data
        plan_id = getattr(self.__class__, "plan_id", None)
        if plan_id:
            assert any(p["id"] == plan_id for p in data["plans"])

    def test_get_plan(self, base_url, api_client, auth_headers):
        plan_id = getattr(self.__class__, "plan_id", None)
        if not plan_id:
            pytest.skip("no plan created")
        r = api_client.get(f"{base_url}/api/v1/meal-plans/{plan_id}",
                           headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert r.json()["id"] == plan_id

    def test_update_plan(self, base_url, api_client, auth_headers):
        plan_id = getattr(self.__class__, "plan_id", None)
        if not plan_id:
            pytest.skip("no plan created")
        updated = {**SAMPLE_PLAN, "title": "Plano editado"}
        r = api_client.put(f"{base_url}/api/v1/meal-plans/{plan_id}",
                           json=updated, headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert r.json()["title"] == "Plano editado"

    def test_submit_for_review(self, base_url, api_client, auth_headers):
        plan_id = getattr(self.__class__, "plan_id", None)
        if not plan_id:
            pytest.skip("no plan created")
        r = api_client.post(f"{base_url}/api/v1/meal-plans/{plan_id}/submit",
                            headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert r.json()["status"] == "professional_review"

    def test_cannot_edit_submitted_plan(self, base_url, api_client, auth_headers):
        plan_id = getattr(self.__class__, "plan_id", None)
        if not plan_id:
            pytest.skip("no plan created")
        r = api_client.put(f"{base_url}/api/v1/meal-plans/{plan_id}",
                           json=SAMPLE_PLAN, headers=auth_headers, timeout=10)
        assert r.status_code == 400

    def test_delete_plan(self, base_url, api_client, auth_headers):
        plan_id = getattr(self.__class__, "plan_id", None)
        if not plan_id:
            pytest.skip("no plan created")
        r = api_client.delete(f"{base_url}/api/v1/meal-plans/{plan_id}",
                              headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert r.json()["ok"] is True


class TestMealPlanIDOR:
    def test_get_nonexistent(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/meal-plans/000000000000000000000000",
                           headers=auth_headers, timeout=10)
        assert r.status_code == 404

    def test_delete_nonexistent(self, base_url, api_client, auth_headers):
        r = api_client.delete(f"{base_url}/api/v1/meal-plans/000000000000000000000000",
                              headers=auth_headers, timeout=10)
        assert r.status_code == 404


class TestTemplates:
    def test_list_templates(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/meal-plans/templates",
                           headers=auth_headers, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert len(data["templates"]) >= 3
        for t in data["templates"]:
            assert "disclaimer" in t
            assert "educativo" in t["disclaimer"].lower() or "modelo" in t["title"].lower()

    def test_screening_alerts_lea(self, base_url, api_client, auth_headers):
        r = api_client.post(f"{base_url}/api/v1/meal-plans/screening", json={
            "height_cm": 178, "weight_kg": 75, "age": 32, "sex": "male",
            "activity_level": "very_active", "goal": "performance",
            "medical_conditions": [], "medications": [],
            "pregnant_or_lactating": False, "eating_disorder_history": False,
            "supplements_current": [],
        }, headers=auth_headers, timeout=10)
        assert r.status_code == 200
        r2 = api_client.get(f"{base_url}/api/v1/meal-plans/screening",
                            headers=auth_headers, timeout=10)
        assert r2.status_code == 200
        data = r2.json()
        assert "alerts" in data


class TestReviewQueue:
    def test_review_queue_requires_nutritionist(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/meal-plans/review/queue",
                           headers=auth_headers, timeout=10)
        assert r.status_code == 403
