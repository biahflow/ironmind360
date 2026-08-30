"""Testes E2E da sincronizacao de wellness do intervals.icu."""

import os

import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or ""
).rstrip("/")
API = f"{BASE_URL}/api/v1"


def _register_user(suffix=""):
    email = f"intervals_well{suffix}_{os.getpid()}@test.com"
    r = requests.post(
        f"{API}/auth/register",
        json={"email": email, "password": "Test1234!", "name": "Test Intervals"},
    )
    if r.status_code == 409:
        r = requests.post(
            f"{API}/auth/login",
            json={"email": email, "password": "Test1234!", "device_name": "test"},
        )
    data = r.json()
    token = data.get("token") or data.get("access_token")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


class TestIntervalsWellnessSync:
    @pytest.fixture(autouse=True, scope="class")
    def setup(self):
        headers = _register_user("_main")
        self.__class__._headers = headers

    def _h(self):
        return self.__class__._headers

    def test_sync_without_connection(self):
        r = requests.post(f"{API}/intervals/sync-wellness", headers=self._h())
        assert r.status_code == 403
        assert "nao conectado" in r.json()["error"]["message"].lower()

    def test_wellness_status_new_user(self):
        r = requests.get(f"{API}/intervals/wellness-status", headers=self._h())
        assert r.status_code == 200
        data = r.json()
        assert data["synced"] is False
        assert data["records"] == 0
        assert data["last_sync_at"] is None

    def test_sync_requires_auth(self):
        r = requests.post(f"{API}/intervals/sync-wellness")
        assert r.status_code in (401, 403)

    def test_status_requires_auth(self):
        r = requests.get(f"{API}/intervals/wellness-status")
        assert r.status_code in (401, 403)


class TestIntervalsWellnessIDOR:
    @pytest.fixture(autouse=True, scope="class")
    def setup(self):
        self.__class__._headers_a = _register_user("_idor_a")
        self.__class__._headers_b = _register_user("_idor_b")

    def test_user_b_cannot_see_user_a_wellness_status(self):
        r_a = requests.get(
            f"{API}/intervals/wellness-status",
            headers=self.__class__._headers_a,
        )
        r_b = requests.get(
            f"{API}/intervals/wellness-status",
            headers=self.__class__._headers_b,
        )
        assert r_a.status_code == 200
        assert r_b.status_code == 200
        assert r_a.json()["records"] == r_b.json()["records"] == 0
