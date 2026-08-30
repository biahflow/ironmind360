"""Testes da detecção de anomalias em sessões (Bloco 3)."""

from app.anomaly import (
    build_athlete_profile,
    detect_anomalies,
    _classify_deviation,
    _z_score,
    MIN_SESSIONS_PER_TYPE,
)


def _make_activity(act_type="Run", speed=3.1, hr=152, tss=60, time=3600, dist=11000, day=1, icu_id=None):
    return {
        "type": act_type,
        "name": f"{act_type} day-{day}",
        "start_date_local": f"2026-08-{day:02d}T06:30:00",
        "icu_id": icu_id or f"test-{day}",
        "average_speed": speed,
        "average_heartrate": hr,
        "icu_training_load": tss,
        "moving_time": time,
        "distance": dist,
    }


def _baseline_runs(n=10, **overrides):
    return [_make_activity(day=i + 1, **overrides) for i in range(n)]


class TestZScore:
    def test_zero_stdev(self):
        assert _z_score(5.0, [5.0, 5.0, 5.0]) == 0.0

    def test_positive(self):
        z = _z_score(10.0, [5.0, 6.0, 4.0, 5.5])
        assert z > 0

    def test_negative(self):
        z = _z_score(0.0, [5.0, 6.0, 4.0, 5.5])
        assert z < 0


class TestClassifyDeviation:
    def test_positive_faster_lower_hr(self):
        z = {"average_speed": 2.5, "average_heartrate": -2.0, "icu_training_load": 0}
        assert _classify_deviation(z) == "positiva"

    def test_negative_slower_higher_hr(self):
        z = {"average_speed": -2.0, "average_heartrate": 2.0, "icu_training_load": -2.0}
        assert _classify_deviation(z) == "negativa"

    def test_neutral_mixed(self):
        z = {"average_speed": 2.0, "average_heartrate": 2.0, "icu_training_load": 0}
        assert _classify_deviation(z) == "neutra"


class TestBuildProfile:
    def test_groups_by_type(self):
        acts = _baseline_runs(5) + [_make_activity("Ride", day=i + 10) for i in range(5)]
        profile = build_athlete_profile(acts)
        assert "Run" in profile
        assert "Ride" in profile
        assert profile["Run"]["count"] == 5

    def test_stats_have_mean_stdev(self):
        acts = _baseline_runs(5)
        profile = build_athlete_profile(acts)
        assert "average_speed" in profile["Run"]
        assert "mean" in profile["Run"]["average_speed"]
        assert "stdev" in profile["Run"]["average_speed"]


class TestDetectAnomalies:
    def test_no_anomalies_uniform_data(self):
        acts = _baseline_runs(10)
        result = detect_anomalies(acts)
        assert result["anomaly_count"] == 0
        assert "Run" in result["types_analyzed"]

    def test_spike_detected(self):
        acts = _baseline_runs(15)
        # Inserir uma sessão claramente anômala (muito mais rápida e com FC baixa)
        spike = _make_activity(speed=8.0, hr=110, tss=200, time=1200, dist=25000, day=20)
        acts.append(spike)
        result = detect_anomalies(acts, contamination=0.15)
        anomalies = result["anomalies"]
        assert len(anomalies) >= 1
        found = [a for a in anomalies if a["icu_id"] == "test-20"]
        assert len(found) == 1
        anom = found[0]
        assert anom["classification"] in ("positiva", "negativa", "neutra")
        assert len(anom["factors"]) > 0
        assert "summary" in anom

    def test_insufficient_data_skipped(self):
        acts = _baseline_runs(3)
        result = detect_anomalies(acts)
        assert result["anomaly_count"] == 0
        assert "Run" in result["skipped_types"]

    def test_filter_by_type(self):
        acts = _baseline_runs(10) + [_make_activity("Ride", day=i + 20) for i in range(10)]
        result = detect_anomalies(acts, activity_type="Run")
        assert result["types_analyzed"] == ["Run"]

    def test_anomaly_has_required_fields(self):
        acts = _baseline_runs(15)
        acts.append(_make_activity(speed=9.0, hr=100, tss=250, time=900, dist=30000, day=20))
        result = detect_anomalies(acts, contamination=0.15)
        if result["anomaly_count"] > 0:
            a = result["anomalies"][0]
            assert "activity_type" in a
            assert "classification" in a
            assert "isolation_score" in a
            assert "factors" in a
            assert "summary" in a

    def test_empty_activities(self):
        result = detect_anomalies([])
        assert result["anomaly_count"] == 0
        assert result["types_analyzed"] == []
