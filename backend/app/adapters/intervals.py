import requests


class IntervalsClient:
    base_url = "https://intervals.icu/api/v1"

    def _get(self, *, api_key: str, path: str, params: dict | None = None) -> list[dict]:
        response = requests.get(
            f"{self.base_url}{path}",
            params=params,
            auth=("API_KEY", api_key),
            headers={"User-Agent": "ironmind360/1.0"},
            timeout=25,
        )
        if response.status_code == 401:
            raise ValueError("invalid_credentials")
        if response.status_code == 429:
            raise RuntimeError("rate_limited")
        response.raise_for_status()
        return response.json() or []

    def activities(
        self, *, api_key: str, athlete_id: str, oldest: str, newest: str
    ) -> list[dict]:
        return self._get(
            api_key=api_key,
            path=f"/athlete/{athlete_id}/activities",
            params={"oldest": oldest, "newest": newest},
        )

    def events(
        self, *, api_key: str, athlete_id: str, oldest: str, newest: str
    ) -> list[dict]:
        return self._get(
            api_key=api_key,
            path=f"/athlete/{athlete_id}/events",
            params={"oldest": oldest, "newest": newest},
        )

    def wellness(
        self, *, api_key: str, athlete_id: str, oldest: str, newest: str
    ) -> list[dict]:
        return self._get(
            api_key=api_key,
            path=f"/athlete/{athlete_id}/wellness",
            params={"oldest": oldest, "newest": newest},
        )
