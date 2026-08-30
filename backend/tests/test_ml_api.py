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
