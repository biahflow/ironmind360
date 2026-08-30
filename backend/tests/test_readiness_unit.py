from app.services.readiness import compute_readiness


def test_empty_checkin_is_green():
    result = compute_readiness({})
    assert result["level"] == "green"
    assert result["score"] == 100
    assert result["factors"] == []


def test_low_sleep_and_high_fatigue_drops_readiness():
    result = compute_readiness({"sleep_hours": 4, "fatigue": 5})
    assert result["level"] in ("yellow", "red")
    assert result["score"] <= 50
    assert any(f["area"] == "sono" for f in result["factors"])
    assert any(f["area"] == "fadiga" for f in result["factors"])


def test_moderate_stress_is_yellow():
    result = compute_readiness({"stress": 4, "sleep_hours": 7})
    assert result["level"] in ("green", "yellow")
    assert any(f["area"] == "estresse" for f in result["factors"])


def test_severe_pain_drops_readiness():
    result = compute_readiness({}, [{"location": "joelho", "intensity": 8}])
    assert result["score"] < 80
    assert any(f["area"] == "dor" and f["impact"] == "red" for f in result["factors"])


def test_factors_explain_each_impact():
    result = compute_readiness({
        "sleep_hours": 4.5,
        "fatigue": 5,
        "energy": 1,
        "mood": 1,
        "anxiety": 5,
        "stress": 5,
        "motivation": 1,
        "sleep_quality": 1,
    })
    assert result["level"] == "red"
    areas = {f["area"] for f in result["factors"]}
    assert areas >= {"sono", "fadiga", "energia", "humor", "ansiedade", "estresse", "motivação", "qualidade_sono"}


def test_high_load_risk_adds_factor_and_penalizes():
    base = compute_readiness({})["score"]
    result = compute_readiness({}, None, {"risk_level": "alto"})
    assert result["score"] == base - 12
    assert any(f["area"] == "carga" for f in result["factors"])


def test_critical_load_risk_penalizes_more():
    result = compute_readiness({}, None, {"risk_level": "critico"})
    assert result["score"] == 75
    assert any(f["area"] == "carga" and f["impact"] == "red" for f in result["factors"])


def test_low_load_risk_does_not_change_readiness():
    assert compute_readiness({}, None, {"risk_level": "baixo"})["score"] == 100
    assert compute_readiness({}, None, {"risk_level": "indeterminado"})["score"] == 100
