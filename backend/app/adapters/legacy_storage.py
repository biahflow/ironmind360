import asyncio

import requests

from app.config import settings


class LegacyStorageProvider:
    def __init__(self) -> None:
        base = settings.integration_proxy_url.rstrip("/")
        self.url = f"{base}/objstore/api/v1/storage"
        self.storage_key: str | None = None

    def _initialize(self) -> str:
        if self.storage_key:
            return self.storage_key
        if not settings.emergent_llm_key:
            raise RuntimeError("Legacy storage nao configurado")
        response = requests.post(
            f"{self.url}/init",
            json={"emergent_key": settings.emergent_llm_key},
            timeout=30,
        )
        response.raise_for_status()
        self.storage_key = response.json()["storage_key"]
        return self.storage_key

    def _get(self, key: str) -> tuple[bytes, str]:
        response = requests.get(
            f"{self.url}/objects/{key}",
            headers={"X-Storage-Key": self._initialize()},
            timeout=60,
        )
        response.raise_for_status()
        return response.content, response.headers.get(
            "Content-Type", "application/octet-stream"
        )

    async def get(self, key: str) -> tuple[bytes, str]:
        return await asyncio.to_thread(self._get, key)

    def _delete(self, key: str) -> None:
        response = requests.delete(
            f"{self.url}/objects/{key}",
            headers={"X-Storage-Key": self._initialize()},
            timeout=60,
        )
        if response.status_code not in {200, 204, 404}:
            response.raise_for_status()

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self._delete, key)


legacy_storage = LegacyStorageProvider()
