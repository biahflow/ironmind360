"""E2E tests for nutrition feedback."""


class TestSupplementFeedback:
    def test_log_feedback(self, base_url, api_client, auth_headers):
        r = api_client.post(f"{base_url}/api/v1/nutrition-feedback/supplement", json={
            "supplement_log_id": "000000000000000000000000",
            "benefit_perceived": 7,
            "energy_level": 8,
            "rpe_change": -1,
            "hr_change": 0,
            "sleep_quality": 6,
            "anxiety_level": 2,
            "palpitation": False,
            "gi_symptoms": "",
            "notes": "Senti mais energia",
        }, headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["benefit_perceived"] == 7
        assert data["action_accepted"] is None
        self.__class__.feedback_id = data["id"]

    def test_list_feedback(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/nutrition-feedback",
                           headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert len(r.json()["feedbacks"]) >= 1

    def test_accept_action(self, base_url, api_client, auth_headers):
        fid = getattr(self.__class__, "feedback_id", None)
        if not fid:
            return
        r = api_client.post(f"{base_url}/api/v1/nutrition-feedback/{fid}/accept",
                            headers=auth_headers, timeout=10)
        assert r.status_code == 200

    def test_reject_nonexistent(self, base_url, api_client, auth_headers):
        r = api_client.post(f"{base_url}/api/v1/nutrition-feedback/000000000000000000000000/reject",
                            headers=auth_headers, timeout=10)
        assert r.status_code == 404


class TestMealPlanFeedback:
    def test_log_meal_plan_feedback(self, base_url, api_client, auth_headers):
        r = api_client.post(f"{base_url}/api/v1/nutrition-feedback/meal-plan", json={
            "meal_plan_id": "",
            "date": "2026-08-29",
            "energy_level": 7,
            "satiety": 8,
            "gi_comfort": 9,
            "adherence_pct": 90,
            "notes": "Dia bom de alimentação",
        }, headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["type"] == "meal_plan"
