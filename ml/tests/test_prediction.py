"""Testes da previsão de performance em prova (Bloco 4)."""

from app.prediction import (
    build_performance_profile,
    predict_race_time,
    predict_triathlon,
    _riegel,
    _format_time,
    TRIATHLON_DISTANCES,
)


def _make_act(act_type="Run", dist=10000, time=3000, speed=3.3, hr=152, day=1):
    return {
        "type": act_type,
        "name": f"{act_type} day-{day}",
        "start_date_local": f"2026-08-{day:02d}T06:30:00",
        "distance": dist,
        "moving_time": time,
        "average_speed": speed,
        "average_heartrate": hr,
        "icu_training_load": 60,
    }


def _baseline(act_type="Run", n=10, dist=10000, time=3000, **kw):
    return [_make_act(act_type, dist=dist, time=time, day=i + 1, **kw) for i in range(n)]


class TestRiegel:
    def test_same_distance(self):
        assert round(_riegel(3000, 10000, 10000)) == 3000

    def test_double_distance_slower(self):
        t = _riegel(3000, 10000, 20000)
        assert t > 6000

    def test_half_distance_faster(self):
        t = _riegel(3000, 10000, 5000)
        assert t < 1500


class TestFormatTime:
    def test_under_hour(self):
        assert _format_time(1830) == "30:30"

    def test_over_hour(self):
        assert _format_time(3661) == "1:01:01"


class TestBuildProfile:
    def test_profile_has_pace(self):
        acts = _baseline(n=5)
        profile = build_performance_profile(acts)
        assert "Run" in profile
        assert profile["Run"]["avg_pace_s_per_m"] is not None
        assert profile["Run"]["sessions"] == 5

    def test_multiple_types(self):
        acts = _baseline("Run", 5) + _baseline("Ride", 5, dist=30000, time=4000)
        profile = build_performance_profile(acts)
        assert "Run" in profile
        assert "Ride" in profile


class TestPredictRaceTime:
    def test_insufficient_data(self):
        acts = _baseline(n=2)
        result = predict_race_time(acts, "Run", 21100)
        assert result["status"] == "insufficient_data"
        assert result["optimistic_seconds"] is None

    def test_ok_with_enough_data(self):
        acts = _baseline(n=10, dist=10000, time=3000)
        result = predict_race_time(acts, "Run", 10000)
        assert result["status"] == "ok"
        assert result["optimistic_seconds"] is not None
        assert result["realistic_seconds"] is not None
        assert result["conservative_seconds"] is not None
        assert result["optimistic_seconds"] <= result["realistic_seconds"]
        assert result["realistic_seconds"] <= result["conservative_seconds"]

    def test_longer_distance_takes_more_time(self):
        acts = _baseline(n=10, dist=10000, time=3000)
        r10 = predict_race_time(acts, "Run", 10000)
        r21 = predict_race_time(acts, "Run", 21100)
        assert r21["realistic_seconds"] > r10["realistic_seconds"]

    def test_elevation_increases_time(self):
        acts = _baseline(n=10)
        flat = predict_race_time(acts, "Run", 10000)
        hilly = predict_race_time(acts, "Run", 10000, elevation_m=500)
        assert hilly["realistic_seconds"] > flat["realistic_seconds"]

    def test_heat_increases_time(self):
        acts = _baseline(n=10)
        cool = predict_race_time(acts, "Run", 10000, temperature_c=20)
        hot = predict_race_time(acts, "Run", 10000, temperature_c=35)
        assert hot["realistic_seconds"] > cool["realistic_seconds"]

    def test_has_formatted_times(self):
        acts = _baseline(n=10)
        result = predict_race_time(acts, "Run", 10000)
        assert ":" in result["realistic_formatted"]

    def test_extrapolation_lowers_confidence(self):
        acts = _baseline(n=10, dist=5000, time=1500)
        result = predict_race_time(acts, "Run", 42200)
        assert result["confidence"] == "baixa"
        assert any("extrapolação" in f["area"] for f in result["factors"])


class TestPredictTriathlon:
    def test_unknown_type(self):
        result = predict_triathlon([], "ultra_custom")
        assert result["status"] == "unknown_race_type"

    def test_partial_when_missing_discipline(self):
        acts = _baseline("Run", 10) + _baseline("Ride", 10, dist=30000, time=4000)
        result = predict_triathlon(acts, "olympic")
        assert result["status"] == "partial"
        assert result["legs"]["Swim"]["status"] == "insufficient_data"
        assert result["legs"]["Run"]["status"] == "ok"

    def test_full_prediction(self):
        acts = (
            _baseline("Run", 10, dist=10000, time=3000)
            + _baseline("Ride", 10, dist=30000, time=4000, speed=7.5, hr=140)
            + _baseline("Swim", 10, dist=1500, time=1800, speed=0.83, hr=135)
        )
        result = predict_triathlon(acts, "olympic")
        assert result["status"] == "ok"
        assert result["total_realistic_seconds"] is not None
        assert result["total_realistic_seconds"] > 0
        assert result["transition_seconds"] == 120

    def test_ironman_has_longer_transition(self):
        acts = (
            _baseline("Run", 10, dist=10000, time=3000)
            + _baseline("Ride", 10, dist=30000, time=4000, speed=7.5, hr=140)
            + _baseline("Swim", 10, dist=1500, time=1800, speed=0.83, hr=135)
        )
        result = predict_triathlon(acts, "ironman")
        assert result["transition_seconds"] == 300
