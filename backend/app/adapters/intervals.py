import requests


class IntervalsClient:
    base_url = "https://intervals.icu/api/v1"

    def activities(
        self, *, api_key: str, athlete_id: str, oldest: str, newest: str
    ) -> list[dict]:
        response = requests.get(
            f"{self.base_url}/athlete/{athlete_id}/activities",
            params={"oldest": oldest, "newest": newest},
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
