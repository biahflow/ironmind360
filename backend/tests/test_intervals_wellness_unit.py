"""Testes unitarios da transformacao de wellness do intervals.icu."""

import pytest

from app.routes.intervals_sync import _transform_wellness_day, _extract_habits_fields


class TestTransformWellnessDay:
    def test_full_day(self):
        day = {
            "id": "2026-08-28",
            "restingHR": 52,
            "hrv": 48.5,
            "weight": 72.3,
            "sleepSecs": 27000,
            "sleepQuality": 4,
        }
        entries = _transform_wellness_day(day)
        assert len(entries) == 4
        types = {e["data_type"] for e in entries}
        assert types == {"resting_hr", "hrv", "weight", "sleep"}

    def test_resting_hr_value(self):
        day = {"id": "2026-08-28", "restingHR": 55}
        entries = _transform_wellness_day(day)
        assert len(entries) == 1
        assert entries[0]["data_type"] == "resting_hr"
        assert entries[0]["value"] == {"bpm": 55}
        assert entries[0]["source_id"] == "2026-08-28_resting_hr"
        assert entries[0]["date"] == "2026-08-28"

    def test_hrv_value(self):
        day = {"id": "2026-08-28", "hrv": 62.7}
        entries = _transform_wellness_day(day)
        assert len(entries) == 1
        assert entries[0]["value"] == {"ms": 62.7}

    def test_weight_value(self):
        day = {"id": "2026-08-28", "weight": 73.456}
        entries = _transform_wellness_day(day)
        assert len(entries) == 1
        assert entries[0]["value"] == {"kg": 73.5}

    def test_sleep_conversion(self):
        day = {"id": "2026-08-28", "sleepSecs": 28800, "sleepQuality": 3}
        entries = _transform_wellness_day(day)
        assert len(entries) == 1
        assert entries[0]["data_type"] == "sleep"
        assert entries[0]["value"]["hours"] == 8.0
        assert entries[0]["value"]["quality"] == 3

    def test_sleep_without_quality(self):
        day = {"id": "2026-08-28", "sleepSecs": 25200}
        entries = _transform_wellness_day(day)
        assert len(entries) == 1
        assert entries[0]["value"] == {"hours": 7.0}
        assert "quality" not in entries[0]["value"]

    def test_missing_all_fields(self):
        day = {"id": "2026-08-28"}
        entries = _transform_wellness_day(day)
        assert entries == []

    def test_missing_id(self):
        day = {"restingHR": 55, "hrv": 40}
        entries = _transform_wellness_day(day)
        assert entries == []

    def test_null_fields_skipped(self):
        day = {"id": "2026-08-28", "restingHR": None, "hrv": None, "weight": 70.0}
        entries = _transform_wellness_day(day)
        assert len(entries) == 1
        assert entries[0]["data_type"] == "weight"

    def test_source_id_format(self):
        day = {"id": "2026-08-28", "restingHR": 50, "hrv": 45}
        entries = _transform_wellness_day(day)
        ids = {e["source_id"] for e in entries}
        assert ids == {"2026-08-28_resting_hr", "2026-08-28_hrv"}


class TestExtractHabitsFields:
    def test_full_fields(self):
        day = {
            "id": "2026-08-28",
            "fatigue": 3,
            "mood": 4,
            "stress": 2,
            "sleepSecs": 27000,
            "sleepQuality": 4,
        }
        fields = _extract_habits_fields(day)
        assert fields["fatigue"] == 3
        assert fields["mood"] == 4
        assert fields["stress"] == 2
        assert fields["sleep_hours"] == 7.5
        assert fields["sleep_quality"] == 4

    def test_partial_fields(self):
        day = {"id": "2026-08-28", "mood": 5}
        fields = _extract_habits_fields(day)
        assert fields == {"mood": 5}

    def test_no_habits_fields(self):
        day = {"id": "2026-08-28", "restingHR": 52, "weight": 70}
        fields = _extract_habits_fields(day)
        assert fields == {}

    def test_missing_id(self):
        day = {"fatigue": 3, "mood": 4}
        fields = _extract_habits_fields(day)
        assert fields == {}

    def test_sleep_hours_conversion(self):
        day = {"id": "2026-08-28", "sleepSecs": 0}
        fields = _extract_habits_fields(day)
        assert fields["sleep_hours"] == 0.0

    def test_null_fields_skipped(self):
        day = {"id": "2026-08-28", "fatigue": None, "mood": 3, "stress": None}
        fields = _extract_habits_fields(day)
        assert fields == {"mood": 3}
