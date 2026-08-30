"""Versionamento de modelos em diretório.

Layout: ``<MODEL_DIR>/<modelo>/<versao>/`` contendo ``model.pkl`` (opcional) e
``metadata.json``. Versões são ``vN`` incrementais; ``latest`` aponta para a
maior. Simples de propósito — MLflow foi descartado para o Bloco 1.
"""

from __future__ import annotations

import json
import pickle
import re
from pathlib import Path
from typing import Any

from app.config import settings

_VERSION_RE = re.compile(r"^v(\d+)$")


def _model_root(name: str) -> Path:
    safe = re.sub(r"[^a-zA-Z0-9_-]", "_", name)
    return Path(settings.model_dir) / safe


def list_versions(name: str) -> list[str]:
    root = _model_root(name)
    if not root.is_dir():
        return []
    versions = [p.name for p in root.iterdir() if p.is_dir() and _VERSION_RE.match(p.name)]
    return sorted(versions, key=lambda v: int(_VERSION_RE.match(v).group(1)))


def _next_version(name: str) -> str:
    existing = list_versions(name)
    if not existing:
        return "v1"
    last = int(_VERSION_RE.match(existing[-1]).group(1))
    return f"v{last + 1}"


def resolve_version(name: str, version: str = "latest") -> str | None:
    versions = list_versions(name)
    if not versions:
        return None
    if version == "latest":
        return versions[-1]
    return version if version in versions else None


def save_model(
    name: str,
    *,
    model: Any | None = None,
    metadata: dict[str, Any] | None = None,
    created_at: str,
) -> dict[str, Any]:
    """Grava uma nova versão do modelo. ``created_at`` deve ser fornecido pelo
    chamador (ISO string) para manter a função determinística/testável."""
    version = _next_version(name)
    target = _model_root(name) / version
    target.mkdir(parents=True, exist_ok=True)

    if model is not None:
        with (target / "model.pkl").open("wb") as fh:
            pickle.dump(model, fh)

    meta = {
        "model": name,
        "version": version,
        "created_at": created_at,
        "has_artifact": model is not None,
        **(metadata or {}),
    }
    with (target / "metadata.json").open("w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=2, default=str)
    return meta


def load_metadata(name: str, version: str = "latest") -> dict[str, Any] | None:
    resolved = resolve_version(name, version)
    if resolved is None:
        return None
    meta_path = _model_root(name) / resolved / "metadata.json"
    if not meta_path.exists():
        return None
    with meta_path.open(encoding="utf-8") as fh:
        return json.load(fh)


def load_model(name: str, version: str = "latest") -> Any | None:
    resolved = resolve_version(name, version)
    if resolved is None:
        return None
    artifact = _model_root(name) / resolved / "model.pkl"
    if not artifact.exists():
        return None
    with artifact.open("rb") as fh:
        return pickle.load(fh)
