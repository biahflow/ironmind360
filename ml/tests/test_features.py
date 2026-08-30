from datetime import date, timedelta

from app import features


def _act(day: date, load: float) -> dict:
    return {"start_date_local": f"{day.isoformat()}T06:00:00", "icu_training_load": load}


def test_acwr_balanced_load_is_one():
    as_of = date(2026, 8, 29)
    # Carga constante de 50/dia nos últimos 28 dias → aguda == crônica → ACWR 1.0
    acts = [_act(as_of - timedelta(days=i), 50) for i in range(28)]
    res = features.compute_acwr(acts, as_of)
    assert res["acwr"] == 1.0
    assert res["acwr_zone"] == "otima"
    assert res["active_days_28d"] == 28
    assert res["acute_load_7d"] == 350.0


def test_acwr_spike_is_high_risk():
    as_of = date(2026, 8, 29)
    # Crônica baixa (10/dia) e pico recente (100/dia na última semana) → ACWR alto
    acts = []
    for i in range(28):
        day = as_of - timedelta(days=i)
        acts.append(_act(day, 100 if i < 7 else 10))
    res = features.compute_acwr(acts, as_of)
    assert res["acwr"] is not None and res["acwr"] > 1.5
    assert res["acwr_zone"] == "alta"


def test_acwr_none_without_chronic_load():
    as_of = date(2026, 8, 29)
    assert features.compute_acwr([], as_of)["acwr"] is None


def test_daily_series_fills_zeros_for_missing_days():
    as_of = date(2026, 8, 29)
    acts = [_act(as_of, 40), _act(as_of - timedelta(days=2), 60)]
    series = features.daily_load_series(acts, as_of, 3)
    assert series == [60.0, 0.0, 40.0]


def test_recovery_and_rpe_windows():
    as_of = date(2026, 8, 29)
    habits = [
        {"date": as_of.isoformat(), "sleep_hours": 8, "fatigue": 2, "energy": 4},
        {"date": (as_of - timedelta(days=1)).isoformat(), "sleep_hours": 6, "fatigue": 4, "energy": 2},
        {"date": (as_of - timedelta(days=30)).isoformat(), "sleep_hours": 5, "fatigue": 5, "energy": 1},
    ]
    rec = features.recovery_features(habits, as_of)
    assert rec["sleep_hours_avg"] == 7.0  # média só dos 2 dentro da janela de 7d
    assert rec["checkins_7d"] == 2

    sessions = [
        {
            "status": "completed",
            "completed_at": f"{as_of.isoformat()}T10:00:00",
            "exercises": [{"sets": [{"rpe": 8}, {"rpe": 6}]}],
        },
        {"status": "in_progress", "completed_at": as_of.isoformat(), "exercises": []},
    ]
    rpe = features.session_rpe_features(sessions, as_of)
    assert rpe["strength_sessions_7d"] == 1  # só a concluída
    assert rpe["set_rpe_avg_7d"] == 7.0
    assert rpe["set_count_7d"] == 2


def test_extract_features_shape():
    as_of = date(2026, 8, 29)
    out = features.extract_features(activities=[], habits=[], sessions=[], as_of=as_of)
    assert out["feature_schema_version"] == features.FEATURE_SCHEMA_VERSION
    assert out["as_of"] == "2026-08-29"
    assert set(out) >= {"load", "recovery", "strength", "hrv_avg_7d", "resting_hr_avg_7d"}
    assert out["hrv_avg_7d"] is None
