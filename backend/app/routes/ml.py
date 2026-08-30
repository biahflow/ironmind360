"""Rotas proxy para o serviço de ML preditivo (Fase 5).

Expostas em ``/api/v1/ml/*``. Autenticação/RBAC/rate-limit do backend; o
adaptador cuida da chamada interna autenticada por token ao serviço ml.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

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


class RacePredictionIn(BaseModel):
    race_type: Optional[str] = Field(default=None, description="sprint/olympic/half_ironman/ironman")
    discipline: Optional[str] = Field(default=None, description="Run/Ride/Swim")
    distance_m: Optional[float] = Field(default=None, description="Distância em metros")
    elevation_m: Optional[float] = Field(default=None, description="Desnível em metros")
    temperature_c: Optional[float] = Field(default=None, description="Temperatura em °C")


@router.post(
    "/race-prediction",
    dependencies=[Depends(rate_limit("ml_prediction", 20, 60))],
)
async def ml_race_prediction(
    body: RacePredictionIn,
    user: dict = Depends(current_user),
) -> dict:
    """Previsão de performance em prova (intervalo de confiança)."""
    return await ml.race_prediction(
        user_id=str(user["_id"]),
        race_type=body.race_type,
        discipline=body.discipline,
        distance_m=body.distance_m,
        elevation_m=body.elevation_m,
        temperature_c=body.temperature_c,
    )
