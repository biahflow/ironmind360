from fastapi.testclient import TestClient

from app import cache, db
from app.main import app


def test_health_ok_when_mongo_up(monkeypatch):
    monkeypatch.setattr(db, "ping", lambda: True)
    monkeypatch.setattr(cache, "ping", lambda: True)
    with TestClient(app) as client:
        r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["mongo"] is True
    assert "feature_schema_version" in body


def test_health_degraded_when_mongo_down(monkeypatch):
    monkeypatch.setattr(db, "ping", lambda: False)
    monkeypatch.setattr(cache, "ping", lambda: False)
    with TestClient(app) as client:
        r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "degraded"


def test_retrain_registers_version(monkeypatch):
    with TestClient(app) as client:
        r = client.post("/retrain", json={"model": "baseline"})
    assert r.status_code == 200
    body = r.json()
    assert body["retrained"] is True
    assert body["version"].startswith("v")
    assert body["version"] in body["versions"]


def test_prediction_stubs_not_implemented():
    # /overtraining-risk (Bloco 2) e /anomalies (Bloco 3) implementados; resta o stub 501.
    with TestClient(app) as client:
        assert client.post("/race-prediction").status_code == 501


def test_token_guard_blocks_when_configured(monkeypatch):
    # Com token configurado, endpoints protegidos exigem o header correto.
    # settings é frozen: troca-se a referência do módulo por um namespace.
    from types import SimpleNamespace
    from app import security
    monkeypatch.setattr(security, "settings", SimpleNamespace(ml_service_token="secret-token-123"))
    with TestClient(app) as client:
        assert client.post("/retrain").status_code == 403
        assert client.post("/retrain", headers={"X-ML-Token": "secret-token-123"}).status_code == 200
