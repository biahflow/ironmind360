"""Testes E2E de integracao com wearables (HealthKit / Health Connect)."""

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
    email = f"wearable_test{suffix}_{os.getpid()}@test.com"
    r = requests.post(
        f"{API}/auth/register",
        json={"email": email, "password": "Test1234!", "name": "Test Wearable"},
    )
    if r.status_code == 409:
        r = requests.post(
            f"{API}/auth/login",
            json={"email": email, "password": "Test1234!", "device_name": "test"},
        )
    data = r.json()
    token = data.get("token") or data.get("access_token")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


class TestWearables:
    @pytest.fixture(autouse=True, scope="class")
    def setup(self):
        headers = _register_user("_main")
        self.__class__._headers = headers

    def _h(self):
        return self.__class__._headers

    def test_set_permissions_apple_health(self):
        r = requests.put(
            f"{API}/wearable-permissions",
            json={"source": "apple_health", "data_types": ["sleep", "resting_hr", "hrv", "weight"]},
            headers=self._h(),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["source"] == "apple_health"
        assert set(data["data_types"]) == {"sleep", "resting_hr", "hrv", "weight"}

    def test_set_permissions_health_connect(self):
        r = requests.put(
            f"{API}/wearable-permissions",
            json={"source": "health_connect", "data_types": ["sleep", "weight", "activity"]},
            headers=self._h(),
        )
        assert r.status_code == 200
        assert r.json()["source"] == "health_connect"

    def test_get_permissions(self):
        r = requests.get(f"{API}/wearable-permissions", headers=self._h())
        assert r.status_code == 200
        sources = {p["source"] for p in r.json()["permissions"]}
        assert "apple_health" in sources

    def test_import_batch(self):
        r = requests.post(
            f"{API}/wearable-data",
            json={
                "source": "apple_health",
                "items": [
                    {
                        "source": "apple_health",
                        "data_type": "resting_hr",
                        "source_id": "hr_001",
                        "timestamp": "2026-08-29T07:00:00",
                        "date": "2026-08-29",
                        "value": {"bpm": 52},
                    },
                    {
                        "source": "apple_health",
                        "data_type": "hrv",
                        "source_id": "hrv_001",
                        "timestamp": "2026-08-29T07:00:00",
                        "date": "2026-08-29",
                        "value": {"ms": 68},
                    },
                    {
                        "source": "apple_health",
                        "data_type": "weight",
                        "source_id": "wt_001",
                        "timestamp": "2026-08-29T08:00:00",
                        "date": "2026-08-29",
                        "value": {"kg": 75.2},
                    },
                    {
                        "source": "apple_health",
                        "data_type": "sleep",
                        "source_id": "sleep_001",
                        "timestamp": "2026-08-29T06:30:00",
                        "date": "2026-08-29",
                        "value": {"hours": 7.5, "quality": "good"},
                    },
                ],
            },
            headers=self._h(),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["inserted"] == 4
        assert data["skipped"] == 0

    def test_deduplication(self):
        r = requests.post(
            f"{API}/wearable-data",
            json={
                "source": "apple_health",
                "items": [
                    {
                        "source": "apple_health",
                        "data_type": "resting_hr",
                        "source_id": "hr_001",
                        "timestamp": "2026-08-29T07:00:00",
                        "date": "2026-08-29",
                        "value": {"bpm": 52},
                    },
                ],
            },
            headers=self._h(),
        )
        assert r.status_code == 200
        assert r.json()["inserted"] == 0

    def test_import_without_permission(self):
        r = requests.post(
            f"{API}/wearable-data",
            json={
                "source": "apple_health",
                "items": [
                    {
                        "source": "apple_health",
                        "data_type": "activity",
                        "source_id": "act_001",
                        "timestamp": "2026-08-29T10:00:00",
                        "date": "2026-08-29",
                        "value": {"type": "Run", "distance_m": 5000},
                    },
                ],
            },
            headers=self._h(),
        )
        assert r.status_code == 200
        assert r.json()["skipped"] == 1

    def test_query_by_type(self):
        r = requests.get(
            f"{API}/wearable-data?data_type=resting_hr",
            headers=self._h(),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["count"] >= 1
        assert all(d["data_type"] == "resting_hr" for d in data["data"])

    def test_query_by_date_range(self):
        r = requests.get(
            f"{API}/wearable-data?date_from=2026-08-29&date_to=2026-08-29",
            headers=self._h(),
        )
        assert r.status_code == 200
        assert r.json()["count"] >= 1

    def test_query_by_source(self):
        r = requests.get(
            f"{API}/wearable-data?source=apple_health",
            headers=self._h(),
        )
        assert r.status_code == 200
        assert all(d["source"] == "apple_health" for d in r.json()["data"])

    def test_summary(self):
        r = requests.get(f"{API}/wearable-summary", headers=self._h())
        assert r.status_code == 200
        data = r.json()
        assert "resting_hr" in data
        assert "hrv" in data
        assert "weight" in data
        assert "sources_connected" in data
        assert "apple_health" in data["sources_connected"]
        if data["resting_hr"]:
            assert data["resting_hr"]["source"] == "apple_health"
            assert data["resting_hr"]["value"]["bpm"] == 52

    def test_delete_source_data(self):
        r = requests.delete(
            f"{API}/wearable-data/apple_health",
            headers=self._h(),
        )
        assert r.status_code == 200
        assert r.json()["deleted"] >= 1

        r2 = requests.get(
            f"{API}/wearable-data?source=apple_health",
            headers=self._h(),
        )
        assert r2.status_code == 200
        assert r2.json()["count"] == 0

    def test_revoke_permissions_deletes_data(self):
        requests.post(
            f"{API}/wearable-data",
            json={
                "source": "health_connect",
                "items": [
                    {
                        "source": "health_connect",
                        "data_type": "weight",
                        "source_id": "hc_wt_001",
                        "timestamp": "2026-08-29T09:00:00",
                        "date": "2026-08-29",
                        "value": {"kg": 75.0},
                    },
                ],
            },
            headers=self._h(),
        )

        r = requests.delete(
            f"{API}/wearable-permissions/health_connect",
            headers=self._h(),
        )
        assert r.status_code == 200

        r2 = requests.get(
            f"{API}/wearable-data?source=health_connect",
            headers=self._h(),
        )
        assert r2.status_code == 200
        assert r2.json()["count"] == 0


class TestWearablesIDOR:
    @pytest.fixture(autouse=True, scope="class")
    def setup(self):
        self.__class__._headers_a = _register_user("_idor_a")
        self.__class__._headers_b = _register_user("_idor_b")

    def test_user_a_creates_data(self):
        requests.put(
            f"{API}/wearable-permissions",
            json={"source": "apple_health", "data_types": ["resting_hr"]},
            headers=self.__class__._headers_a,
        )
        r = requests.post(
            f"{API}/wearable-data",
            json={
                "source": "apple_health",
                "items": [
                    {
                        "source": "apple_health",
                        "data_type": "resting_hr",
                        "source_id": "idor_hr_001",
                        "timestamp": "2026-08-29T07:00:00",
                        "date": "2026-08-29",
                        "value": {"bpm": 55},
                    },
                ],
            },
            headers=self.__class__._headers_a,
        )
        assert r.status_code == 200
        assert r.json()["inserted"] == 1

    def test_user_b_cannot_see_user_a_data(self):
        r = requests.get(
            f"{API}/wearable-data?source=apple_health",
            headers=self.__class__._headers_b,
        )
        assert r.status_code == 200
        assert r.json()["count"] == 0

    def test_user_b_cannot_see_user_a_summary(self):
        r = requests.get(f"{API}/wearable-summary", headers=self.__class__._headers_b)
        assert r.status_code == 200
        assert r.json()["resting_hr"] is None

    def test_user_b_cannot_see_user_a_permissions(self):
        r = requests.get(f"{API}/wearable-permissions", headers=self.__class__._headers_b)
        assert r.status_code == 200
        assert len(r.json()["permissions"]) == 0
