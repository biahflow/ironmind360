"""E2E tests for notifications API."""

import os

import pytest
import requests

API = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8000") + "/api/v1"


def _register_user(suffix=""):
    email = f"notif_test{suffix}_{os.getpid()}@test.com"
    r = requests.post(
        f"{API}/auth/register",
        json={"email": email, "password": "Test1234!", "name": "NotifTest"},
    )
    if r.status_code == 409:
        r = requests.post(
            f"{API}/auth/login",
            json={"email": email, "password": "Test1234!", "device_name": "test"},
        )
    return r.json()


class TestNotifications:
    @pytest.fixture(autouse=True, scope="class")
    def setup(self, request):
        tokens = _register_user("_notif")
        request.cls.headers = {
            "Authorization": f"Bearer {tokens['access_token']}"
        }

    def test_register_push_token(self):
        r = requests.post(
            f"{API}/push-token",
            json={"token": "ExponentPushToken[test123456789]", "platform": "ios"},
            headers=self.headers,
        )
        assert r.status_code == 201
        assert r.json()["ok"] is True

    def test_register_push_token_android(self):
        r = requests.post(
            f"{API}/push-token",
            json={"token": "ExponentPushToken[android_test_token]", "platform": "android"},
            headers=self.headers,
        )
        assert r.status_code == 201

    def test_register_push_token_requires_auth(self):
        r = requests.post(
            f"{API}/push-token",
            json={"token": "ExponentPushToken[noauth12345]", "platform": "ios"},
        )
        assert r.status_code == 401

    def test_get_default_prefs(self):
        r = requests.get(f"{API}/notification-preferences", headers=self.headers)
        assert r.status_code == 200
        data = r.json()
        assert data["checkin_reminder"] is True
        assert data["quiet_start"] == "22:00"
        assert data["quiet_end"] == "07:00"

    def test_update_prefs(self):
        r = requests.put(
            f"{API}/notification-preferences",
            json={
                "checkin_reminder": False,
                "checkin_time": "08:00",
                "workout_reminder": True,
                "hydration_reminder": False,
                "equipment_alerts": True,
                "readiness_alerts": True,
                "meal_reminders": False,
                "race_countdown": True,
                "weekly_summary": True,
                "quiet_start": "23:00",
                "quiet_end": "06:00",
            },
            headers=self.headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["checkin_reminder"] is False
        assert data["checkin_time"] == "08:00"
        assert data["quiet_start"] == "23:00"

    def test_get_updated_prefs(self):
        r = requests.get(f"{API}/notification-preferences", headers=self.headers)
        assert r.status_code == 200
        data = r.json()
        assert data["checkin_reminder"] is False
        assert data["checkin_time"] == "08:00"

    def test_list_notifications_empty(self):
        r = requests.get(f"{API}/notifications", headers=self.headers)
        assert r.status_code == 200
        assert r.json()["notifications"] == []
        assert r.json()["count"] == 0

    def test_unread_count_zero(self):
        r = requests.get(f"{API}/notifications/unread-count", headers=self.headers)
        assert r.status_code == 200
        assert r.json()["unread"] == 0

    def test_mark_read_not_found(self):
        r = requests.post(
            f"{API}/notifications/aaaaaaaaaaaaaaaaaaaaaaaa/read",
            headers=self.headers,
        )
        assert r.status_code == 404

    def test_mark_all_read(self):
        r = requests.post(f"{API}/notifications/read-all", headers=self.headers)
        assert r.status_code == 200
        assert r.json()["ok"] is True
        assert r.json()["updated"] == 0

    def test_delete_push_token(self):
        r = requests.delete(
            f"{API}/push-token",
            json={"token": "ExponentPushToken[test123456789]"},
            headers=self.headers,
        )
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_delete_push_token_not_found(self):
        r = requests.delete(
            f"{API}/push-token",
            json={"token": "ExponentPushToken[nonexistent12345]"},
            headers=self.headers,
        )
        assert r.status_code == 404


class TestNotificationsIDOR:
    @pytest.fixture(autouse=True, scope="class")
    def setup(self, request):
        tokens_a = _register_user("_notif_a")
        tokens_b = _register_user("_notif_b")
        request.cls.headers_a = {
            "Authorization": f"Bearer {tokens_a['access_token']}"
        }
        request.cls.headers_b = {
            "Authorization": f"Bearer {tokens_b['access_token']}"
        }

    def test_user_a_sets_prefs(self):
        r = requests.put(
            f"{API}/notification-preferences",
            json={
                "checkin_reminder": True,
                "checkin_time": "06:30",
                "workout_reminder": True,
                "hydration_reminder": True,
                "equipment_alerts": True,
                "readiness_alerts": True,
                "meal_reminders": True,
                "race_countdown": True,
                "weekly_summary": True,
                "quiet_start": "22:00",
                "quiet_end": "07:00",
            },
            headers=self.headers_a,
        )
        assert r.status_code == 200

    def test_user_b_gets_own_prefs(self):
        r = requests.get(f"{API}/notification-preferences", headers=self.headers_b)
        assert r.status_code == 200
        data = r.json()
        assert data["checkin_time"] == "07:00"

    def test_user_b_cannot_see_user_a_notifications(self):
        r = requests.get(f"{API}/notifications", headers=self.headers_b)
        assert r.status_code == 200
        assert r.json()["notifications"] == []
