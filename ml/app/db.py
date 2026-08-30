"""Acesso ao MongoDB (somente leitura para o pipeline de features)."""

from __future__ import annotations

from functools import lru_cache

from pymongo import MongoClient
from pymongo.database import Database

from app.config import settings


@lru_cache(maxsize=1)
def get_client() -> MongoClient:
    # Timeouts curtos: o serviço é síncrono e não deve travar em boot/healthcheck.
    return MongoClient(settings.mongo_url, serverSelectionTimeoutMS=3000)


def get_db() -> Database:
    return get_client()[settings.db_name]


def ping() -> bool:
    try:
        get_client().admin.command("ping")
        return True
    except Exception:
        return False
