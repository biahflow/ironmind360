"""E2E tests for fueling, supplements, and sweat tests."""
import pytest


class TestSupplementCatalog:
    def test_get_catalog(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/fueling/supplement-catalog",
                           headers=auth_headers, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["version"] == "1.0.0"
        assert len(data["catalog"]) >= 8
        names = [s["name"] for s in data["catalog"]]
        assert "Creatina monoidratada" in names
        assert "Cafeína" in names

    def test_catalog_entries_have_required_fields(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/fueling/supplement-catalog",
                           headers=auth_headers, timeout=10)
        for entry in r.json()["catalog"]:
            assert "name" in entry
            assert "category" in entry
            assert "evidence_level" in entry
            assert "source" in entry
            assert "requires_professional" in entry


class TestSupplementLog:
    def test_log_supplement(self, base_url, api_client, auth_headers):
        r = api_client.post(f"{base_url}/api/v1/fueling/supplements", json={
            "supplement_name": "Creatina monoidratada",
            "category": "creatine",
            "product": "Creatina Creapure",
            "brand": "Integral Médica",
            "dose": "5g",
            "timing": "Pós-treino",
            "antidoping_cert": "Informed Sport",
            "notes": "",
        }, headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["supplement_name"] == "Creatina monoidratada"
        assert data["catalog_version"] == "1.0.0"
        self.__class__.supp_id = data["id"]

    def test_list_supplements(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/fueling/supplements",
                           headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert len(r.json()["supplements"]) >= 1

    def test_delete_supplement_log(self, base_url, api_client, auth_headers):
        supp_id = getattr(self.__class__, "supp_id", None)
        if not supp_id:
            pytest.skip("no supplement logged")
        r = api_client.delete(f"{base_url}/api/v1/fueling/supplements/{supp_id}",
                              headers=auth_headers, timeout=10)
        assert r.status_code == 200


class TestFuelingSession:
    def test_log_fueling(self, base_url, api_client, auth_headers):
        r = api_client.post(f"{base_url}/api/v1/fueling/sessions", json={
            "session_type": "bike",
            "duration_min": 120,
            "carb_g_per_hour": 60,
            "fluid_ml": 1500,
            "sodium_mg": 800,
            "products_used": ["Gel 30g carbo", "Isotônico 500ml"],
            "gi_symptoms": "Nenhum",
            "rpe": 7,
            "notes": "Long ride sábado",
        }, headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["carb_g_per_hour"] == 60
        assert data["fluid_ml"] == 1500
        self.__class__.fuel_id = data["id"]

    def test_list_fueling(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/fueling/sessions",
                           headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert len(r.json()["sessions"]) >= 1

    def test_delete_fueling(self, base_url, api_client, auth_headers):
        fuel_id = getattr(self.__class__, "fuel_id", None)
        if not fuel_id:
            pytest.skip("no fueling session")
        r = api_client.delete(f"{base_url}/api/v1/fueling/sessions/{fuel_id}",
                              headers=auth_headers, timeout=10)
        assert r.status_code == 200


class TestSweatTest:
    def test_log_sweat_test(self, base_url, api_client, auth_headers):
        r = api_client.post(f"{base_url}/api/v1/fueling/sweat-test", json={
            "weight_pre_kg": 75.0,
            "weight_post_kg": 73.5,
            "fluid_intake_ml": 500,
            "urine_ml": 100,
            "duration_min": 60,
            "temperature_c": 28,
            "humidity_pct": 65,
            "session_type": "run",
            "notes": "Corrida ao sol",
        }, headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["weight_loss_kg"] == 1.5
        assert data["net_fluid_loss_ml"] == 1900
        assert data["sweat_rate_ml_per_hour"] == 1900

    def test_list_sweat_tests(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/fueling/sweat-tests",
                           headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert len(r.json()["tests"]) >= 1


class TestFuelingStrategy:
    def test_strategy_short(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/fueling/strategy?duration_min=45",
                           headers=auth_headers, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["duration_min"] == 45
        assert len(data["recommendations"]) >= 2
        assert len(data["checklist"]) >= 4

    def test_strategy_long(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/fueling/strategy?duration_min=180",
                           headers=auth_headers, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert any("90 g/h" in rec["recommendation"] for rec in data["recommendations"])
        assert any("gastrointestinal" in rec["recommendation"].lower() for rec in data["recommendations"])

    def test_strategy_medium(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/fueling/strategy?duration_min=90",
                           headers=auth_headers, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert any("30-60 g/h" in rec["recommendation"] for rec in data["recommendations"])


class TestFuelingIDOR:
    def test_delete_nonexistent(self, base_url, api_client, auth_headers):
        r = api_client.delete(f"{base_url}/api/v1/fueling/supplements/000000000000000000000000",
                              headers=auth_headers, timeout=10)
        assert r.status_code == 404
