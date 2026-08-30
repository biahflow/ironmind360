"""Serviço de ML preditivo — FastAPI.

Bloco 1 (infraestrutura): saúde, pipeline de features, versionamento e retreino
scaffold. As predições (overtraining, anomalias, prova) chegam nos blocos 2–4.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query
from pydantic import BaseModel

from app import anomaly, cache, db, features, prediction, registry, risk
from app.config import settings
from app.security import require_ml_token


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Toca as conexões no boot; não falha se indisponível (healthcheck cobre isso).
    db.ping()
    cache.ping()
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
)


# ── Saúde ───────────────────────────────────────────────────────
@app.get("/health")
async def health() -> dict[str, Any]:
    mongo_ok = db.ping()
    redis_ok = cache.ping()
    status = "ok" if mongo_ok else "degraded"
    return {
        "status": status,
        "service": settings.app_name,
        "mongo": mongo_ok,
        "redis": redis_ok,
        "feature_schema_version": features.FEATURE_SCHEMA_VERSION,
    }


# ── Features (debug/validação do pipeline) ──────────────────────
@app.get("/features/{user_id}", dependencies=[Depends(require_ml_token)])
async def get_features(
    user_id: str,
    as_of: str | None = Query(default=None, description="YYYY-MM-DD; padrão hoje"),
) -> dict[str, Any]:
    parsed: date | None = None
    if as_of:
        try:
            parsed = date.fromisoformat(as_of)
        except ValueError as exc:
            raise HTTPException(422, "as_of invalido (use YYYY-MM-DD)") from exc

    cache_key = f"ml:features:{user_id}:{as_of or 'today'}"
    cached = cache.get_json(cache_key)
    if cached is not None:
        return {**cached, "cached": True}

    result = features.load_features(db.get_db(), user_id, as_of=parsed)
    cache.set_json(cache_key, result)
    return {**result, "cached": False}


# ── Retreino (scaffold) ─────────────────────────────────────────
class RetrainIn(BaseModel):
    model: str = "baseline"


def _load_risk_config() -> dict:
    """Config do modelo de risco: versão mais recente no registry ou o default."""
    meta = registry.load_metadata("overtraining_risk")
    if meta and isinstance(meta.get("config"), dict):
        return meta["config"]
    return risk.DEFAULT_CONFIG


@app.post("/retrain", dependencies=[Depends(require_ml_token)])
async def retrain(body: RetrainIn | None = None) -> dict[str, Any]:
    name = (body.model if body else "baseline") or "baseline"
    metadata: dict[str, Any] = {"feature_schema_version": features.FEATURE_SCHEMA_VERSION}
    if name == "overtraining_risk":
        # Modelo composto: "treinar" = materializar a config atual como versão.
        metadata["config"] = risk.DEFAULT_CONFIG
        metadata["note"] = "modelo composto de risco de overtraining (ACWR + monotonia + subjetivo)"
    else:
        metadata["note"] = "scaffold — modelos reais chegam nos blocos 2-4 da Fase 5"
    meta = registry.save_model(name, model=None, metadata=metadata, created_at=_now_iso())
    return {"retrained": True, **meta, "versions": registry.list_versions(name)}


@app.get("/models/{name}/versions", dependencies=[Depends(require_ml_token)])
async def model_versions(name: str) -> dict[str, Any]:
    return {"model": name, "versions": registry.list_versions(name)}


# ── Risco de overtraining (Bloco 2) ─────────────────────────────
class OvertrainingIn(BaseModel):
    user_id: str
    as_of: str | None = None


@app.post("/overtraining-risk", dependencies=[Depends(require_ml_token)])
async def overtraining_risk(body: OvertrainingIn) -> dict[str, Any]:
    parsed: date | None = None
    if body.as_of:
        try:
            parsed = date.fromisoformat(body.as_of)
        except ValueError as exc:
            raise HTTPException(422, "as_of invalido (use YYYY-MM-DD)") from exc

    cache_key = f"ml:otr:{body.user_id}:{body.as_of or 'today'}"
    cached = cache.get_json(cache_key)
    if cached is not None:
        return {**cached, "cached": True}

    feats = features.load_features(db.get_db(), body.user_id, as_of=parsed)
    result = risk.compute_overtraining_risk(feats, _load_risk_config())
    result["source_counts"] = feats.get("source_counts")
    cache.set_json(cache_key, result)
    return {**result, "cached": False}


# ── Detecção de anomalias (Bloco 3) ────────────────────────────
class AnomaliesIn(BaseModel):
    user_id: str
    activity_type: str | None = None
    recent_days: int | None = None


@app.post("/anomalies", dependencies=[Depends(require_ml_token)])
async def detect_anomalies_endpoint(body: AnomaliesIn) -> dict[str, Any]:
    cache_key = f"ml:anom:{body.user_id}:{body.activity_type or 'all'}:{body.recent_days or 0}"
    cached = cache.get_json(cache_key)
    if cached is not None:
        return {**cached, "cached": True}

    database = db.get_db()
    query: dict[str, Any] = {"user_id": body.user_id}
    if body.activity_type:
        query["type"] = body.activity_type
    projection = {
        "type": 1, "name": 1, "start_date_local": 1, "icu_id": 1,
        "average_speed": 1, "average_heartrate": 1,
        "icu_training_load": 1, "moving_time": 1, "distance": 1,
        "_id": 0,
    }
    activities = list(database.activities.find(query, projection))
    if not activities:
        return {
            "model_version": anomaly.ANOMALY_MODEL_VERSION,
            "types_analyzed": [],
            "skipped_types": [],
            "total_activities": 0,
            "anomalies": [],
            "anomaly_count": 0,
            "cached": False,
        }

    result = anomaly.detect_anomalies(
        activities,
        activity_type=body.activity_type,
        recent_days=body.recent_days,
    )
    profile = anomaly.build_athlete_profile(activities)
    result["profile"] = profile
    cache.set_json(cache_key, result)
    return {**result, "cached": False}


# ── Previsão de performance (Bloco 4) ──────────────────────────
class RacePredictionIn(BaseModel):
    user_id: str
    race_type: str | None = None
    discipline: str | None = None
    distance_m: float | None = None
    elevation_m: float | None = None
    temperature_c: float | None = None


@app.post("/race-prediction", dependencies=[Depends(require_ml_token)])
async def race_prediction_endpoint(body: RacePredictionIn) -> dict[str, Any]:
    cache_key = (
        f"ml:pred:{body.user_id}:{body.race_type or ''}:"
        f"{body.discipline or ''}:{body.distance_m or 0}"
    )
    cached = cache.get_json(cache_key)
    if cached is not None:
        return {**cached, "cached": True}

    database = db.get_db()
    projection = {
        "type": 1, "distance": 1, "moving_time": 1,
        "average_speed": 1, "average_heartrate": 1,
        "icu_training_load": 1, "start_date_local": 1,
        "_id": 0,
    }
    activities = list(
        database.activities.find({"user_id": body.user_id}, projection)
    )

    if body.race_type and body.race_type in prediction.TRIATHLON_DISTANCES:
        result = prediction.predict_triathlon(
            activities,
            body.race_type,
            elevation_m=body.elevation_m,
            temperature_c=body.temperature_c,
        )
    elif body.discipline and body.distance_m:
        result = prediction.predict_race_time(
            activities,
            body.discipline,
            body.distance_m,
            elevation_m=body.elevation_m,
            temperature_c=body.temperature_c,
        )
    else:
        raise HTTPException(
            422,
            "Informe race_type (sprint/olympic/half_ironman/ironman) "
            "ou discipline + distance_m.",
        )

    profile = prediction.build_performance_profile(activities)
    result["profile"] = profile
    cache.set_json(cache_key, result, ttl=3600)
    return {**result, "cached": False}
