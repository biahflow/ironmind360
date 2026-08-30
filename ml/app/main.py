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

from app import cache, db, features, registry, risk
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


# ── Predições (implementadas nos próximos blocos) ───────────────
_NOT_IMPL = "Endpoint previsto para um bloco futuro da Fase 5"


@app.post("/anomalies", dependencies=[Depends(require_ml_token)])
async def anomalies() -> dict[str, Any]:
    raise HTTPException(501, _NOT_IMPL)


@app.post("/race-prediction", dependencies=[Depends(require_ml_token)])
async def race_prediction() -> dict[str, Any]:
    raise HTTPException(501, _NOT_IMPL)
