V1 = "/api/v1"


class TestBodyMetrics:
    def test_weight_recorded_and_returned(self, base_url, auth_headers, api_client):
        api_client.put(
            f"{base_url}{V1}/habits", headers=auth_headers,
            json={"date": "2026-08-25", "weight_kg": 74.2},
        )
        r = api_client.get(f"{base_url}{V1}/analytics/body-metrics?days=90", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert any(abs(p["value"] - 74.2) < 0.01 for p in data["weight"])
        assert data["weight_summary"]["latest"] is not None

    def test_requires_auth(self, base_url, api_client):
        r = api_client.get(f"{base_url}{V1}/analytics/body-metrics")
        assert r.status_code == 401
