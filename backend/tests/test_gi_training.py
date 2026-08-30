import os

import pytest
import requests

API = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8000") + "/api/v1"


def _register(suffix=""):
    email = f"gi_test{suffix}_{os.getpid()}@test.com"
    r = requests.post(
        f"{API}/auth/register",
        json={"email": email, "password": "Test1234!", "name": "GI Tester"},
    )
    if r.status_code == 409:
        r = requests.post(
            f"{API}/auth/login",
            json={"email": email, "password": "Test1234!", "device_name": "test"},
        )
    return r.json()


class TestGITrainingPlan:
    @pytest.fixture(autouse=True, scope="class")
    def setup(self, request):
        tokens = _register("_plan")
        request.cls.headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    def test_create_plan_default(self):
        r = requests.post(
            f"{API}/fueling/gi-training/plan",
            json={},
            headers=self.headers,
        )
        assert r.status_code == 201
        data = r.json()
        assert data["status"] == "active"
        assert data["start_carb_g_per_hour"] == 30
        assert data["target_carb_g_per_hour"] == 90
        assert data["duration_weeks"] == 8
        assert len(data["schedule"]) == 8
        assert data["schedule"][0]["week"] == 1
        assert data["schedule"][0]["target_carb_g_per_hour"] == 30
        assert data["schedule"][-1]["week"] == 8
        assert data["schedule"][-1]["target_carb_g_per_hour"] == 90
        self.__class__.plan_id = data["id"]

    def test_create_plan_custom(self):
        r = requests.post(
            f"{API}/fueling/gi-training/plan",
            json={
                "start_carb_g_per_hour": 40,
                "target_carb_g_per_hour": 80,
                "duration_weeks": 6,
                "sessions_per_week": 3,
                "preferred_products": ["gel", "isotônico"],
            },
            headers=self.headers,
        )
        assert r.status_code == 201
        data = r.json()
        assert data["duration_weeks"] == 6
        assert data["sessions_per_week"] == 3
        assert len(data["schedule"]) == 6
        assert data["schedule"][0]["target_carb_g_per_hour"] == 40
        assert data["schedule"][-1]["target_carb_g_per_hour"] == 80
        self.__class__.plan_id = data["id"]

    def test_new_plan_supersedes_old(self):
        r = requests.post(
            f"{API}/fueling/gi-training/plan",
            json={"start_carb_g_per_hour": 30, "target_carb_g_per_hour": 60, "duration_weeks": 4},
            headers=self.headers,
        )
        assert r.status_code == 201
        data = r.json()
        assert data["target_carb_g_per_hour"] == 60
        self.__class__.plan_id = data["id"]

    def test_get_plan(self):
        r = requests.get(
            f"{API}/fueling/gi-training/plan",
            headers=self.headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == self.plan_id
        assert data["target_carb_g_per_hour"] == 60
        assert "schedule" in data

    def test_delete_plan(self):
        r = requests.delete(
            f"{API}/fueling/gi-training/plan/{self.plan_id}",
            headers=self.headers,
        )
        assert r.status_code == 200
        assert r.json()["ok"] is True

        r2 = requests.get(f"{API}/fueling/gi-training/plan", headers=self.headers)
        assert r2.status_code == 404


class TestGISessionLog:
    @pytest.fixture(autouse=True, scope="class")
    def setup(self, request):
        tokens = _register("_log")
        request.cls.headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        r = requests.post(
            f"{API}/fueling/gi-training/plan",
            json={"start_carb_g_per_hour": 30, "target_carb_g_per_hour": 90, "duration_weeks": 8},
            headers=request.cls.headers,
        )
        request.cls.plan_id = r.json()["id"]

    def test_log_session(self):
        r = requests.post(
            f"{API}/fueling/gi-training/log",
            json={
                "week": 1,
                "session_number": 1,
                "planned_carb_g_per_hour": 30,
                "actual_carb_g_per_hour": 28,
                "duration_min": 60,
                "tolerance_score": 5,
                "symptoms": [],
            },
            headers=self.headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert "id" in data
        assert data["plateau_recommended"] is False
        assert data["next_recommendation"]["action"] == "increase"

    def test_log_with_low_tolerance(self):
        for i in range(2):
            requests.post(
                f"{API}/fueling/gi-training/log",
                json={
                    "week": 3,
                    "session_number": i + 1,
                    "planned_carb_g_per_hour": 50,
                    "actual_carb_g_per_hour": 40,
                    "duration_min": 90,
                    "tolerance_score": 2,
                    "symptoms": ["nausea", "bloating"],
                },
                headers=self.headers,
            )

        r = requests.post(
            f"{API}/fueling/gi-training/log",
            json={
                "week": 3,
                "session_number": 3,
                "planned_carb_g_per_hour": 50,
                "actual_carb_g_per_hour": 45,
                "duration_min": 90,
                "tolerance_score": 1,
                "symptoms": ["nausea", "cramping"],
            },
            headers=self.headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["plateau_recommended"] is True
        assert data["next_recommendation"]["action"] == "hold"

    def test_list_logs(self):
        r = requests.get(
            f"{API}/fueling/gi-training/log",
            headers=self.headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert len(data["logs"]) >= 4

    def test_progress(self):
        r = requests.get(
            f"{API}/fueling/gi-training/progress",
            headers=self.headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["total_sessions"] >= 4
        assert data["expected_sessions"] == 16
        assert "tolerance_by_week" in data
        assert "symptom_frequency" in data
        assert "nausea" in data["symptom_frequency"]
        assert data["status"] in ("on_track", "behind", "not_started", "completed")
        assert "next_recommendation" in data

    def test_log_requires_active_plan(self):
        tokens2 = _register("_noplan")
        headers2 = {"Authorization": f"Bearer {tokens2['access_token']}"}
        r = requests.post(
            f"{API}/fueling/gi-training/log",
            json={
                "week": 1, "session_number": 1,
                "planned_carb_g_per_hour": 30, "actual_carb_g_per_hour": 30,
                "duration_min": 60, "tolerance_score": 4,
            },
            headers=headers2,
        )
        assert r.status_code == 400


class TestGITrainingIDOR:
    @pytest.fixture(autouse=True, scope="class")
    def setup(self, request):
        tokens_a = _register("_idor_a")
        tokens_b = _register("_idor_b")
        request.cls.headers_a = {"Authorization": f"Bearer {tokens_a['access_token']}"}
        request.cls.headers_b = {"Authorization": f"Bearer {tokens_b['access_token']}"}

    def test_user_a_creates_plan(self):
        r = requests.post(
            f"{API}/fueling/gi-training/plan",
            json={},
            headers=self.headers_a,
        )
        assert r.status_code == 201
        self.__class__.plan_id = r.json()["id"]

    def test_user_b_cannot_see_user_a_plan(self):
        r = requests.get(
            f"{API}/fueling/gi-training/plan",
            headers=self.headers_b,
        )
        assert r.status_code == 404

    def test_user_b_cannot_delete_user_a_plan(self):
        r = requests.delete(
            f"{API}/fueling/gi-training/plan/{self.plan_id}",
            headers=self.headers_b,
        )
        assert r.status_code == 404
