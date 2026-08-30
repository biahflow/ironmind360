"""Rotas proxy para o serviço de ML preditivo (Fase 5).

Expostas em ``/api/v1/ml/*``. Autenticação/RBAC/rate-limit do backend; o
adaptador cuida da chamada interna autenticada por token ao serviço ml.
As rotas de predição (overtraining, anomalias, prova) entram nos blocos 2–4.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.adapters.ml import MLClient
from app.dependencies import current_user, require_roles
from app.rate_limit import rate_limit

router = APIRouter(prefix="/ml", tags=["ml"])
ml = MLClient()


@router.get("/status")
async def ml_status(user: dict = Depends(current_user)) -> dict:
    """Status do serviço de ML (proxy do /health)."""
    return await ml.status()


class RetrainIn(BaseModel):
    model: str = "baseline"


@router.post(
    "/retrain",
    dependencies=[
        Depends(require_roles("administrator")),
        Depends(rate_limit("ml_retrain", 2, 3600)),
    ],
)
async def ml_retrain(body: RetrainIn | None = None) -> dict:
    """Dispara retreino sob demanda (somente administrador)."""
    return await ml.retrain(model=body.model if body else "baseline")
