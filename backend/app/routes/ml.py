"""Rotas proxy para o serviço de ML preditivo (Fase 5).

Expostas em ``/api/v1/ml/*``. Autenticação/RBAC/rate-limit do backend; o
adaptador cuida da chamada interna autenticada por token ao serviço ml.
As rotas de predição (overtraining, anomalias, prova) entram nos blocos 2–4.
"""

from fastapi import APIRouter, Depends, Query
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


@router.post(
    "/overtraining-risk",
    dependencies=[Depends(rate_limit("ml_overtraining", 30, 60))],
)
async def ml_overtraining_risk(
    as_of: str | None = Query(default=None, description="YYYY-MM-DD; padrão hoje"),
    user: dict = Depends(current_user),
) -> dict:
    """Risco de overtraining do próprio usuário (carga + recuperação subjetiva)."""
    return await ml.overtraining_risk(user_id=str(user["_id"]), as_of=as_of)


@router.post(
    "/anomalies",
    dependencies=[Depends(rate_limit("ml_anomalies", 20, 60))],
)
async def ml_anomalies(
    activity_type: str | None = Query(default=None, description="Filtrar por tipo"),
    user: dict = Depends(current_user),
) -> dict:
    """Detecção de anomalias nas sessões do próprio usuário."""
    return await ml.anomalies(
        user_id=str(user["_id"]),
        activity_type=activity_type,
    )
