"""Autenticação por token compartilhado para as chamadas internas backend→ml.

O backend envia ``X-ML-Token``; validamos contra ``ML_SERVICE_TOKEN``. Se o
token não estiver configurado (desenvolvimento), a verificação é no-op.
"""

from __future__ import annotations

from fastapi import Header, HTTPException

from app.config import settings


async def require_ml_token(x_ml_token: str | None = Header(default=None)) -> None:
    expected = settings.ml_service_token
    if not expected:
        # Dev sem token configurado: libera.
        return
    if x_ml_token != expected:
        raise HTTPException(status_code=403, detail="Token de servico invalido")
