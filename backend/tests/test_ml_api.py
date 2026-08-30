"""E2E do proxy de ML (Fase 5). Requer o stack com o serviço `ml` no ar."""


class TestMLProxy:
    def test_status_requires_auth(self, base_url, api_client):
        r = api_client.get(f"{base_url}/api/v1/ml/status")
        assert r.status_code == 401

    def test_status_authenticated(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/ml/status", headers=auth_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("status") in {"ok", "degraded"}
        assert "mongo" in body
        assert "feature_schema_version" in body

    def test_retrain_requires_auth(self, base_url, api_client):
        r = api_client.post(f"{base_url}/api/v1/ml/retrain", json={})
        assert r.status_code == 401

    def test_retrain_forbidden_for_athlete(self, base_url, api_client, auth_headers):
        # O usuário demo é atleta; retreino exige administrador.
        r = api_client.post(f"{base_url}/api/v1/ml/retrain", json={}, headers=auth_headers)
        assert r.status_code == 403

    def test_overtraining_requires_auth(self, base_url, api_client):
        r = api_client.post(f"{base_url}/api/v1/ml/overtraining-risk", json={})
        assert r.status_code == 401

    def test_overtraining_risk_for_demo(self, base_url, api_client, auth_headers):
        r = api_client.post(f"{base_url}/api/v1/ml/overtraining-risk", json={}, headers=auth_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["risk_level"] in {"baixo", "moderado", "alto", "critico", "indeterminado"}
        assert "recommendation" in body
        assert "model_version" in body
        # O demo é semeado com atividades → deve haver ACWR e fatores estruturados.
        assert "factors" in body and isinstance(body["factors"], list)

    def test_anomalies_requires_auth(self, base_url, api_client):
        r = api_client.post(f"{base_url}/api/v1/ml/anomalies")
        assert r.status_code == 401

    def test_anomalies_for_demo(self, base_url, api_client, auth_headers):
        r = api_client.post(f"{base_url}/api/v1/ml/anomalies", headers=auth_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "anomalies" in body
        assert isinstance(body["anomalies"], list)
        assert "model_version" in body
        assert "types_analyzed" in body

    def test_anomalies_filter_by_type(self, base_url, api_client, auth_headers):
        r = api_client.post(
            f"{base_url}/api/v1/ml/anomalies?activity_type=Run",
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        for t in body.get("types_analyzed", []):
            assert t == "Run"

    def test_race_prediction_requires_auth(self, base_url, api_client):
        r = api_client.post(f"{base_url}/api/v1/ml/race-prediction", json={})
        assert r.status_code == 401

    def test_race_prediction_triathlon(self, base_url, api_client, auth_headers):
        r = api_client.post(
            f"{base_url}/api/v1/ml/race-prediction",
            json={"race_type": "olympic"},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["race_type"] == "olympic"
        assert body["status"] in ("ok", "partial")
        assert "legs" in body
        assert "model_version" in body

    def test_race_prediction_single_discipline(self, base_url, api_client, auth_headers):
        r = api_client.post(
            f"{base_url}/api/v1/ml/race-prediction",
            json={"discipline": "Run", "distance_m": 10000},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["discipline"] == "Run"
        assert body["distance_m"] == 10000

    def test_race_prediction_validation(self, base_url, api_client, auth_headers):
        r = api_client.post(
            f"{base_url}/api/v1/ml/race-prediction",
            json={},
            headers=auth_headers,
        )
        assert r.status_code == 422

    def test_dashboard_includes_overtraining(self, base_url, api_client, auth_headers):
        r = api_client.get(f"{base_url}/api/v1/dashboard", headers=auth_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "overtraining" in body
        assert "anomalies" in body
