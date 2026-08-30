"""Unit tests for smart reminder generation logic."""

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from bson import ObjectId


FAKE_UID = str(ObjectId())
FAKE_UID2 = str(ObjectId())


def _now():
    return datetime.now(timezone.utc)


def _today():
    return _now().strftime("%Y-%m-%d")


class TestSmartReminders:
    def _run(self, coro):
        return asyncio.get_event_loop().run_until_complete(coro)

    @patch("app.services.smart_reminders.db")
    @patch("app.services.smart_reminders.now_utc")
    @patch("app.services.smart_reminders.today_str")
    def test_no_checkin_generates_reminder(self, mock_today, mock_now, mock_db):
        from app.services.smart_reminders import generate_reminders

        mock_today.return_value = _today()
        mock_now.return_value = _now()

        user_doc = {"_id": FAKE_UID, "goals": {"water_ml": 3000}}

        mock_db.users.find_one = AsyncMock(return_value=user_doc)
        mock_db.notification_preferences.find_one = AsyncMock(return_value=None)
        mock_db.habits.find_one = AsyncMock(return_value=None)
        mock_db.planned_sessions.find = lambda *a, **kw: _MockCursor([])
        mock_db.equipment.find = lambda *a, **kw: _MockCursor([])
        mock_db.pain_logs.find_one = AsyncMock(return_value=None)
        mock_db.races.find = lambda *a, **kw: _MockCursor([])
        mock_db.meals.count_documents = AsyncMock(return_value=0)

        reminders = self._run(generate_reminders(FAKE_UID))
        types = [r["type"] for r in reminders]
        assert "checkin_reminder" in types

    @patch("app.services.smart_reminders.db")
    @patch("app.services.smart_reminders.now_utc")
    @patch("app.services.smart_reminders.today_str")
    def test_equipment_over_mileage_generates_alert(self, mock_today, mock_now, mock_db):
        from app.services.smart_reminders import generate_reminders

        mock_today.return_value = _today()
        mock_now.return_value = _now()

        user_doc = {"_id": FAKE_UID, "goals": {"water_ml": 3000}}
        equipment = [{
            "_id": "eq1",
            "name": "Tênis Corrida",
            "max_distance_km": 800,
            "total_distance_km": 750,
            "max_hours": None,
            "total_hours": 0,
            "retired": False,
        }]

        mock_db.users.find_one = AsyncMock(return_value=user_doc)
        mock_db.notification_preferences.find_one = AsyncMock(return_value=None)
        mock_db.habits.find_one = AsyncMock(return_value={"water_ml": 3000})
        mock_db.planned_sessions.find = lambda *a, **kw: _MockCursor([])
        mock_db.equipment.find = lambda *a, **kw: _MockCursor(equipment)
        mock_db.pain_logs.find_one = AsyncMock(return_value=None)
        mock_db.races.find = lambda *a, **kw: _MockCursor([])
        mock_db.meals.count_documents = AsyncMock(return_value=3)

        reminders = self._run(generate_reminders(FAKE_UID))
        types = [r["type"] for r in reminders]
        assert "equipment_alert" in types
        eq_reminder = next(r for r in reminders if r["type"] == "equipment_alert")
        assert "Tênis Corrida" in eq_reminder["title"]

    @patch("app.services.smart_reminders.db")
    @patch("app.services.smart_reminders.now_utc")
    @patch("app.services.smart_reminders.today_str")
    def test_red_readiness_generates_alert(self, mock_today, mock_now, mock_db):
        from app.services.smart_reminders import generate_reminders

        mock_today.return_value = _today()
        mock_now.return_value = _now()

        user_doc = {"_id": FAKE_UID, "goals": {"water_ml": 3000}}
        checkin = {
            "water_ml": 3000,
            "sleep_hours": 3,
            "fatigue": 5,
            "stress": 5,
        }

        mock_db.users.find_one = AsyncMock(return_value=user_doc)
        mock_db.notification_preferences.find_one = AsyncMock(return_value=None)
        mock_db.habits.find_one = AsyncMock(return_value=checkin)
        mock_db.planned_sessions.find = lambda *a, **kw: _MockCursor([])
        mock_db.equipment.find = lambda *a, **kw: _MockCursor([])
        mock_db.pain_logs.find_one = AsyncMock(return_value=None)
        mock_db.races.find = lambda *a, **kw: _MockCursor([])
        mock_db.meals.count_documents = AsyncMock(return_value=3)

        reminders = self._run(generate_reminders(FAKE_UID))
        types = [r["type"] for r in reminders]
        assert "readiness_alert" in types
        ra = next(r for r in reminders if r["type"] == "readiness_alert")
        assert ra["priority"] == "high"

    @patch("app.services.smart_reminders.db")
    @patch("app.services.smart_reminders.now_utc")
    @patch("app.services.smart_reminders.today_str")
    def test_race_countdown_generates_reminder(self, mock_today, mock_now, mock_db):
        from app.services.smart_reminders import generate_reminders

        today = _today()
        now = _now()
        mock_today.return_value = today
        mock_now.return_value = now

        race_date = (now + timedelta(days=3)).strftime("%Y-%m-%d")
        user_doc = {"_id": FAKE_UID, "goals": {"water_ml": 3000}}
        races = [{"_id": "race1", "name": "Ironman 70.3", "date": race_date}]

        mock_db.users.find_one = AsyncMock(return_value=user_doc)
        mock_db.notification_preferences.find_one = AsyncMock(return_value=None)
        mock_db.habits.find_one = AsyncMock(return_value={"water_ml": 3000})
        mock_db.planned_sessions.find = lambda *a, **kw: _MockCursor([])
        mock_db.equipment.find = lambda *a, **kw: _MockCursor([])
        mock_db.pain_logs.find_one = AsyncMock(return_value=None)
        mock_db.races.find = lambda *a, **kw: _MockCursor(races)
        mock_db.meals.count_documents = AsyncMock(return_value=3)

        reminders = self._run(generate_reminders(FAKE_UID))
        types = [r["type"] for r in reminders]
        assert "race_countdown" in types
        rc = next(r for r in reminders if r["type"] == "race_countdown")
        assert rc["data"]["days_left"] == 3
        assert "3 dias" in rc["body"]

    @patch("app.services.smart_reminders.db")
    @patch("app.services.smart_reminders.now_utc")
    @patch("app.services.smart_reminders.today_str")
    def test_disabled_prefs_skip_reminder(self, mock_today, mock_now, mock_db):
        from app.services.smart_reminders import generate_reminders

        mock_today.return_value = _today()
        mock_now.return_value = _now()

        user_doc = {"_id": FAKE_UID, "goals": {"water_ml": 3000}}
        prefs = {
            "checkin_reminder": False,
            "workout_reminder": False,
            "hydration_reminder": False,
            "equipment_alerts": False,
            "readiness_alerts": False,
            "meal_reminders": False,
            "race_countdown": False,
            "weekly_summary": False,
        }

        mock_db.users.find_one = AsyncMock(return_value=user_doc)
        mock_db.notification_preferences.find_one = AsyncMock(return_value=prefs)

        reminders = self._run(generate_reminders(FAKE_UID))
        assert reminders == []

    @patch("app.services.smart_reminders.db")
    @patch("app.services.smart_reminders.now_utc")
    @patch("app.services.smart_reminders.today_str")
    def test_hydration_low_generates_reminder(self, mock_today, mock_now, mock_db):
        from app.services.smart_reminders import generate_reminders

        now = _now().replace(hour=15)
        mock_today.return_value = _today()
        mock_now.return_value = now

        user_doc = {"_id": FAKE_UID, "goals": {"water_ml": 3000}}
        checkin = {"water_ml": 500}

        mock_db.users.find_one = AsyncMock(return_value=user_doc)
        mock_db.notification_preferences.find_one = AsyncMock(return_value=None)
        mock_db.habits.find_one = AsyncMock(return_value=checkin)
        mock_db.planned_sessions.find = lambda *a, **kw: _MockCursor([])
        mock_db.equipment.find = lambda *a, **kw: _MockCursor([])
        mock_db.pain_logs.find_one = AsyncMock(return_value=None)
        mock_db.races.find = lambda *a, **kw: _MockCursor([])
        mock_db.meals.count_documents = AsyncMock(return_value=3)

        reminders = self._run(generate_reminders(FAKE_UID))
        types = [r["type"] for r in reminders]
        assert "hydration_reminder" in types

    @patch("app.services.smart_reminders.db")
    @patch("app.services.smart_reminders.now_utc")
    @patch("app.services.smart_reminders.today_str")
    def test_no_user_returns_empty(self, mock_today, mock_now, mock_db):
        from app.services.smart_reminders import generate_reminders

        mock_today.return_value = _today()
        mock_now.return_value = _now()
        mock_db.users.find_one = AsyncMock(return_value=None)

        reminders = self._run(generate_reminders(FAKE_UID2))
        assert reminders == []


class _MockCursor:
    """Minimal mock for pymongo async cursor with to_list and sort."""

    def __init__(self, data):
        self._data = data

    def sort(self, *args, **kwargs):
        return self

    async def to_list(self, length=None):
        return self._data
