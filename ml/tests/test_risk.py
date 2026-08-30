from datetime import date, timedelta

from fastapi.testclient import TestClient

from app import features, risk
from app.main import app


def _feats(load: dict, recovery: dict | None = None) -> dict:
    return {
        "feature_schema_version": "1.0.0",
        "as_of": "2026-08-29",
        "load": load,
        "recovery": recovery or {},
        "strength": {},
    }


def test_balanced_load_is_low_risk():
    feats = _feats(
        {"acwr": 1.0, "monotony": 1.2, "strain": 400, "acute_daily": 55,
         "chronic_daily": 55, "active_days_28d": 24}
    )
    out = risk.compute_overtraining_risk(feats)
    assert out["risk_level"] == "baixo"
    assert out["risk_score"] == 0
    assert out["projected_fatigue"]["trajectory"] == "estavel"


def test_acwr_spike_and_monotony_is_high_or_critical():
    feats = _feats(
        {"acwr": 1.7, "monotony": 2.4, "strain": 900, "acute_daily": 90,
         "chronic_daily": 55, "active_days_28d": 24},
        {"fatigue_avg": 4.2, "sleep_hours_avg": 5.5, "checkins_7d": 5},
    )
    out = risk.compute_overtraining_risk(feats)
    assert out["risk_level"] in {"alto", "critico"}
    assert out["risk_score"] >= 45
    areas = {f["area"] for f in out["factors"]}
    assert {"acwr", "monotonia", "fadiga", "sono"} <= areas
    assert out["projected_fatigue"]["trajectory"] == "subindo"
    assert out["confidence"] == "alta"


def test_insufficient_data_is_indeterminate():
    out = risk.compute_overtraining_risk(_feats({"acwr": None, "active_days_28d": 0}))
    assert out["risk_level"] == "indeterminado"
    assert out["risk_score"] is None
    assert out["confidence"] == "baixa"


def test_low_acwr_flags_detraining():
    feats = _feats(
        {"acwr": 0.6, "monotony": 1.0, "acute_daily": 30, "chronic_daily": 55,
         "active_days_28d": 20}
    )
    out = risk.compute_overtraining_risk(feats)
    assert any(f["area"] == "acwr" for f in out["factors"])
    assert out["projected_fatigue"]["trajectory"] == "descendo"


def test_monotony_and_strain_from_activities():
    as_of = date(2026, 8, 29)
    # Carga idêntica todos os dias → desvio 0 → monotonia None (indefinida).
    acts = [{"start_date_local": f"{(as_of - timedelta(days=i)).isoformat()}T06:00:00",
             "icu_training_load": 50} for i in range(7)]
    res = features.compute_acwr(acts, as_of)
    assert res["monotony"] is None
    # Carga variada → monotonia definida e strain calculado.
    acts2 = [{"start_date_local": f"{(as_of - timedelta(days=i)).isoformat()}T06:00:00",
              "icu_training_load": load}
             for i, load in enumerate([100, 20, 80, 0, 60, 40, 90])]
    res2 = features.compute_acwr(acts2, as_of)
    assert res2["monotony"] is not None and res2["monotony"] > 0
    assert res2["strain"] is not None


def test_endpoint_overtraining_risk(monkeypatch):
    monkeypatch.setattr(
        features, "load_features",
        lambda db, user_id, as_of=None: _feats(
            {"acwr": 1.4, "monotony": 1.6, "strain": 600, "acute_daily": 70,
             "chronic_daily": 55, "active_days_28d": 22},
            {"fatigue_avg": 3.6, "checkins_7d": 4},
        ) | {"source_counts": {"activities": 20, "habits": 4, "sessions": 3}},
    )
    with TestClient(app) as client:
        r = client.post("/overtraining-risk", json={"user_id": "u1"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["risk_level"] in {"moderado", "alto"}
    assert body["acwr"] == 1.4
    assert "recommendation" in body and body["model_version"] == risk.RISK_MODEL_VERSION
