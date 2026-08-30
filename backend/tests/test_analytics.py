"""Testes E2E de analytics."""


class TestTrainingLoad:
    def test_load(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/analytics/load?days=28", headers=auth_headers)
        assert r.status_code == 200
        assert "data" in r.json()
        assert r.json()["days"] == 28


class TestConsistency:
    def test_consistency(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/analytics/consistency?days=28", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "activity_days" in data
        assert "checkin_rate" in data
        assert data["total_days"] == 28


class TestWellnessTrends:
    def test_wellness_trends(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/analytics/wellness-trends?days=28", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert "sleep_hours" in data
        assert "fatigue" in data
        assert "pain" in data


class TestNutritionTrends:
    def test_nutrition_trends(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/analytics/nutrition-trends?days=28", headers=auth_headers)
        assert r.status_code == 200
        assert "data" in r.json()


class TestStrengthProgress:
    def test_strength_progress(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/analytics/strength-progress?days=90", headers=auth_headers)
        assert r.status_code == 200
        assert "data" in r.json()


class TestPersonalRecords:
    def test_personal_records(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/analytics/personal-records", headers=auth_headers)
        assert r.status_code == 200
        records = r.json()["records"]
        assert "running" in records
        assert "cycling" in records
        assert "swimming" in records
        assert "strength" in records


class TestRaceHistory:
    def test_race_history(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/analytics/race-history", headers=auth_headers)
        assert r.status_code == 200
        assert "races" in r.json()


class TestCorrelations:
    def test_correlations(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/analytics/correlations?days=28", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "disclaimer" in data
        assert "observations" in data
        assert "observacional" in data["disclaimer"].lower() or "observacion" in data["disclaimer"].lower()


class TestShareReport:
    def test_create_and_read_shared_report(self, base_url, api_client, auth_headers):
        r = api_client.post(
            f"{base_url}/api/v1/analytics/share-report?days=28&scope=load&scope=consistency",
            headers=auth_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert "token" in data
        assert data["expires_in_days"] == 7

        token = data["token"]
        r2 = api_client.get(f"{base_url}/api/v1/analytics/shared/{token}")
        assert r2.status_code == 200
        shared = r2.json()
        assert "data" in shared
        assert "load" in shared["data"]["scope"]

    def test_expired_token(self, base_url, api_client):
        r = api_client.get(f"{base_url}/api/v1/analytics/shared/nonexistent-token")
        assert r.status_code == 404


class TestAnalyticsAuth:
    def test_endpoints_require_auth(self, base_url, api_client):
        endpoints = [
            "/analytics/load",
            "/analytics/consistency",
            "/analytics/wellness-trends",
            "/analytics/nutrition-trends",
            "/analytics/strength-progress",
            "/analytics/personal-records",
            "/analytics/race-history",
            "/analytics/correlations",
        ]
        for path in endpoints:
            r = api_client.get(f"{base_url}/api/v1{path}")
            assert r.status_code in (401, 403), f"GET {path} returned {r.status_code}"
