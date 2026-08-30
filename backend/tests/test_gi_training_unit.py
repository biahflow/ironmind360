import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.routes.fueling import generate_gi_schedule


class TestGenerateGISchedule:
    def test_default_params(self):
        schedule = generate_gi_schedule(30, 90, 8, 2)
        assert len(schedule) == 8
        assert schedule[0]["week"] == 1
        assert schedule[0]["target_carb_g_per_hour"] == 30
        assert schedule[-1]["week"] == 8
        assert schedule[-1]["target_carb_g_per_hour"] == 90

    def test_short_plan(self):
        schedule = generate_gi_schedule(30, 60, 4, 2)
        assert len(schedule) == 4
        assert schedule[0]["target_carb_g_per_hour"] == 30
        assert schedule[-1]["target_carb_g_per_hour"] == 60

    def test_high_start(self):
        schedule = generate_gi_schedule(60, 90, 6, 2)
        assert len(schedule) == 6
        assert schedule[0]["target_carb_g_per_hour"] == 60
        assert schedule[-1]["target_carb_g_per_hour"] == 90
        for entry in schedule[1:-1]:
            assert 60 <= entry["target_carb_g_per_hour"] <= 90

    def test_week1_always_start(self):
        for start, target in [(30, 90), (40, 80), (15, 120)]:
            schedule = generate_gi_schedule(start, target, 8, 2)
            assert schedule[0]["target_carb_g_per_hour"] == start

    def test_last_week_always_target(self):
        for start, target in [(30, 90), (40, 80), (15, 120)]:
            schedule = generate_gi_schedule(start, target, 8, 2)
            assert schedule[-1]["target_carb_g_per_hour"] == target

    def test_rounding_to_5g(self):
        schedule = generate_gi_schedule(30, 90, 8, 2)
        for entry in schedule:
            assert entry["target_carb_g_per_hour"] % 5 == 0

    def test_glucose_fructose_recommendation_above_60(self):
        schedule = generate_gi_schedule(30, 90, 8, 2)
        for entry in schedule:
            rate = entry["target_carb_g_per_hour"]
            has_mix_rec = any(
                "glicose:frutose" in r.lower() for r in entry["recommendations"]
            )
            if rate > 60:
                assert has_mix_rec, f"Week {entry['week']} at {rate}g/h should recommend glucose:fructose mix"

    def test_monotonic_increase(self):
        schedule = generate_gi_schedule(30, 90, 8, 2)
        rates = [e["target_carb_g_per_hour"] for e in schedule]
        for i in range(1, len(rates)):
            assert rates[i] >= rates[i - 1], f"Rate should not decrease: week {i} {rates[i-1]} -> week {i+1} {rates[i]}"

    def test_sessions_per_week_in_schedule(self):
        schedule = generate_gi_schedule(30, 90, 8, 3)
        for entry in schedule:
            assert entry["sessions"] == 3

    def test_baseline_recommendation_week1(self):
        schedule = generate_gi_schedule(30, 90, 8, 2)
        recs = schedule[0]["recommendations"]
        assert any("baseline" in r.lower() for r in recs)

    def test_validation_recommendation_last_week(self):
        schedule = generate_gi_schedule(30, 90, 8, 2)
        recs = schedule[-1]["recommendations"]
        assert any("validação" in r.lower() or "validacao" in r.lower() for r in recs)

    def test_concentration_suggestion_above_60(self):
        schedule = generate_gi_schedule(30, 90, 8, 2)
        for entry in schedule:
            if entry["target_carb_g_per_hour"] >= 60:
                has_conc = any("concentracao" in r.lower() for r in entry["recommendations"])
                assert has_conc, f"Week {entry['week']} should have concentration suggestion"
