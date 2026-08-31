"""Cliente ExerciseDB — consumido APENAS pelo script offline de enriquecimento
de mídia (scripts/enrich_exercise_media.py). Não é usado em runtime pela API.

Os GIFs são baixados uma vez daqui e reservidos pelo nosso próprio S3/MinIO,
então o app nunca depende da RapidAPI nem expõe a key ao cliente.
"""

from __future__ import annotations

import time
from typing import Any, Optional
from urllib.parse import quote

import requests

from app.config import settings


class ExerciseDBError(RuntimeError):
    pass


class ExerciseDBClient:
    """Wrapper fino sobre a ExerciseDB (RapidAPI ou self-host/exercisedb.io)."""

    def __init__(self, timeout: int = 30) -> None:
        if not settings.exercisedb_api_key:
            raise ExerciseDBError(
                "EXERCISEDB_API_KEY não configurada — defina no .env antes de rodar o enriquecimento."
            )
        self.base_url = settings.exercisedb_base_url.rstrip("/")
        self.timeout = timeout
        self._headers = {
            "x-rapidapi-host": settings.exercisedb_api_host,
            "x-rapidapi-key": settings.exercisedb_api_key,
        }

    def _get(self, path: str, params: Optional[dict] = None) -> requests.Response:
        # Retry com backoff no 429 (rate limit do plano gratuito) e 5xx.
        delay = 2.0
        last = ""
        for attempt in range(5):
            resp = requests.get(
                f"{self.base_url}{path}",
                headers=self._headers,
                params=params,
                timeout=self.timeout,
            )
            if resp.status_code == 200:
                return resp
            last = f"{resp.status_code}: {resp.text[:120]}"
            if resp.status_code in (429, 500, 502, 503, 504) and attempt < 4:
                retry_after = resp.headers.get("Retry-After")
                time.sleep(float(retry_after) if retry_after and retry_after.isdigit() else delay)
                delay *= 2
                continue
            break
        raise ExerciseDBError(f"GET {path} -> {last}")

    def get_by_id(self, edb_id: str) -> dict[str, Any]:
        return self._get(f"/exercises/exercise/{edb_id}").json()

    def search_by_name(self, name: str, limit: int = 25) -> list[dict[str, Any]]:
        term = quote(name.strip().lower())
        return self._get(
            f"/exercises/name/{term}", params={"limit": limit, "offset": 0}
        ).json()

    def get_gif(self, edb_id: str, resolution: int = 360) -> bytes:
        """Baixa o GIF animado. Cai para 180 se a resolução pedida falhar."""
        for res in (resolution, 180):
            try:
                resp = self._get("/image", params={"resolution": res, "exerciseId": edb_id})
            except ExerciseDBError:
                continue
            if resp.headers.get("content-type", "").startswith("image/") and resp.content:
                return resp.content
        raise ExerciseDBError(f"Sem GIF para exerciseId={edb_id}")
