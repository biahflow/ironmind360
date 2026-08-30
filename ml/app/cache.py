"""Cache de inferência em Redis, com TTL e comportamento fail-open.

Espelha a filosofia do rate limiter do backend: se o Redis estiver indisponível,
o serviço segue funcionando (sem cache) em vez de falhar.
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from typing import Any

from app.config import settings

logger = logging.getLogger("ironmind.ml.cache")


@lru_cache(maxsize=1)
def _client():
    if not settings.redis_url:
        return None
    try:
        import redis

        return redis.Redis.from_url(
            settings.redis_url, encoding="utf-8", decode_responses=True
        )
    except Exception:
        logger.warning("Redis indisponivel; cache desativado")
        return None


def get_json(key: str) -> Any | None:
    client = _client()
    if client is None:
        return None
    try:
        raw = client.get(key)
        return json.loads(raw) if raw else None
    except Exception:
        logger.warning("Falha ao ler cache", extra={"key": key})
        return None


def set_json(key: str, value: Any, ttl: int | None = None) -> None:
    client = _client()
    if client is None:
        return
    try:
        client.set(key, json.dumps(value, default=str), ex=ttl or settings.inference_cache_ttl)
    except Exception:
        logger.warning("Falha ao gravar cache", extra={"key": key})


def ping() -> bool:
    client = _client()
    if client is None:
        return False
    try:
        return bool(client.ping())
    except Exception:
        return False
