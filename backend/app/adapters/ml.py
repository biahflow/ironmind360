"""Cliente HTTP para o serviço de ML preditivo (Fase 5).

Segue a convenção do repositório para chamadas externas: ``requests`` síncrono
executado fora do event loop via ``asyncio.to_thread``. Autentica por token
compartilhado (``X-ML-Token``). Falha de conexão vira 503; upstream 5xx vira 502.
"""

from __future__ import annotations

import asyncio

import requests
from fastapi import HTTPException

from app.config import settings


class MLClient:
    def __init__(self) -> None:
        self.base_url = settings.ml_service_url.rstrip("/")
        self.token = settings.ml_service_token

    def _headers(self) -> dict[str, str]:
        headers = {"User-Agent": "ironmind360-api/1.0"}
        if self.token:
            headers["X-ML-Token"] = self.token
        return headers

    def _request(self, method: str, path: str, json: dict | None = None) -> dict:
        try:
            resp = requests.request(
                method,
                f"{self.base_url}{path}",
                json=json,
                headers=self._headers(),
                timeout=30,
            )
        except requests.RequestException as exc:
            raise HTTPException(503, "Servico de ML indisponivel") from exc
        if resp.status_code >= 500:
            raise HTTPException(502, "Falha no servico de ML")
        if resp.status_code >= 400:
            raise HTTPException(resp.status_code, "Requisicao ao servico de ML rejeitada")
        return resp.json() if resp.content else {}

    async def status(self) -> dict:
        return await asyncio.to_thread(self._request, "GET", "/health")

    async def retrain(self, *, model: str = "baseline") -> dict:
        return await asyncio.to_thread(self._request, "POST", "/retrain", {"model": model})

    async def overtraining_risk(self, *, user_id: str, as_of: str | None = None) -> dict:
        payload: dict = {"user_id": user_id}
        if as_of:
            payload["as_of"] = as_of
        return await asyncio.to_thread(self._request, "POST", "/overtraining-risk", payload)

    async def anomalies(self, *, user_id: str, activity_type: str | None = None) -> dict:
        payload: dict = {"user_id": user_id}
        if activity_type:
            payload["activity_type"] = activity_type
        return await asyncio.to_thread(self._request, "POST", "/anomalies", payload)

    async def race_prediction(
        self, *, user_id: str,
        race_type: str | None = None,
        discipline: str | None = None,
        distance_m: float | None = None,
        elevation_m: float | None = None,
        temperature_c: float | None = None,
    ) -> dict:
        payload: dict = {"user_id": user_id}
        if race_type:
            payload["race_type"] = race_type
        if discipline:
            payload["discipline"] = discipline
        if distance_m is not None:
            payload["distance_m"] = distance_m
        if elevation_m is not None:
            payload["elevation_m"] = elevation_m
        if temperature_c is not None:
            payload["temperature_c"] = temperature_c
        return await asyncio.to_thread(self._request, "POST", "/race-prediction", payload)
