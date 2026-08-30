"""Detecção de anomalias em sessões — Isolation Forest por tipo de atividade.

Constrói um perfil estatístico do atleta (distribuição de pace, FC, TSS,
duração por modalidade) e identifica sessões fora do padrão. Cada anomalia
é classificada como positiva (PR / breakout), negativa (possível fadiga,
doença, overreaching) ou neutra, e acompanhada das métricas que desviaram
e da magnitude do desvio.

Guardrails: sinaliza desvio para atenção do atleta; nunca diagnostica
doença ou lesão.
"""

from __future__ import annotations

from statistics import mean, stdev
from typing import Any

import numpy as np
from sklearn.ensemble import IsolationForest

ANOMALY_MODEL_VERSION = "1.0.0"
MIN_SESSIONS_PER_TYPE = 5

FEATURE_COLS = [
    "average_speed",
    "average_heartrate",
    "icu_training_load",
    "moving_time",
    "distance",
]

FEATURE_LABELS = {
    "average_speed": "velocidade média",
    "average_heartrate": "FC média",
    "icu_training_load": "carga (TSS)",
    "moving_time": "duração",
    "distance": "distância",
}

FEATURE_UNITS = {
    "average_speed": "m/s",
    "average_heartrate": "bpm",
    "icu_training_load": "TSS",
    "moving_time": "s",
    "distance": "m",
}


def _extract_row(act: dict) -> list[float] | None:
    row = []
    for col in FEATURE_COLS:
        v = act.get(col)
        if v is None:
            return None
        try:
            row.append(float(v))
        except (TypeError, ValueError):
            return None
    return row


def _z_score(value: float, values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    m = mean(values)
    s = stdev(values)
    if s == 0:
        return 0.0
    return (value - m) / s


def _classify_deviation(z_scores: dict[str, float]) -> str:
    """Classifica anomalia pela direção dos desvios.

    Positiva: performance melhorou (mais rápido, menor FC para mesma carga).
    Negativa: performance degradou (mais lento, maior FC, menor distância).
    Neutra: misto ou apenas volume diferente.
    """
    speed_z = z_scores.get("average_speed", 0)
    hr_z = z_scores.get("average_heartrate", 0)
    load_z = z_scores.get("icu_training_load", 0)

    positive_signals = 0
    negative_signals = 0

    if speed_z > 1.5:
        positive_signals += 1
    elif speed_z < -1.5:
        negative_signals += 1

    # FC mais baixa para mesma carga = positivo
    if hr_z < -1.5:
        positive_signals += 1
    elif hr_z > 1.5:
        negative_signals += 1

    if load_z > 1.5:
        positive_signals += 1
    elif load_z < -1.5:
        negative_signals += 1

    if positive_signals > negative_signals:
        return "positiva"
    if negative_signals > positive_signals:
        return "negativa"
    return "neutra"


def _explain_factors(
    act: dict, z_scores: dict[str, float], threshold: float = 1.5,
) -> list[dict[str, Any]]:
    factors = []
    for col in FEATURE_COLS:
        z = z_scores.get(col, 0)
        if abs(z) < threshold:
            continue
        value = act.get(col)
        direction = "acima" if z > 0 else "abaixo"
        factors.append({
            "metric": FEATURE_LABELS.get(col, col),
            "value": round(float(value), 2) if value is not None else None,
            "unit": FEATURE_UNITS.get(col, ""),
            "z_score": round(z, 2),
            "direction": direction,
            "detail": (
                f"{FEATURE_LABELS.get(col, col)} {direction} do usual "
                f"({abs(z):.1f} desvios-padrão)."
            ),
        })
    return factors


def build_athlete_profile(
    activities: list[dict],
) -> dict[str, dict[str, Any]]:
    """Constrói perfil estatístico por tipo de atividade."""
    by_type: dict[str, list[dict]] = {}
    for act in activities:
        t = act.get("type")
        if not t:
            continue
        by_type.setdefault(t, []).append(act)

    profile: dict[str, dict[str, Any]] = {}
    for act_type, acts in by_type.items():
        rows = [(a, _extract_row(a)) for a in acts]
        valid = [(a, r) for a, r in rows if r is not None]
        stats: dict[str, Any] = {"count": len(valid)}
        if len(valid) >= 2:
            for i, col in enumerate(FEATURE_COLS):
                vals = [r[i] for _, r in valid]
                stats[col] = {
                    "mean": round(mean(vals), 2),
                    "stdev": round(stdev(vals), 2) if len(vals) >= 2 else 0,
                    "min": round(min(vals), 2),
                    "max": round(max(vals), 2),
                }
        profile[act_type] = stats
    return profile


def detect_anomalies(
    activities: list[dict],
    *,
    recent_days: int | None = None,
    activity_type: str | None = None,
    contamination: float = 0.1,
) -> dict[str, Any]:
    """Detecta anomalias no histórico de atividades.

    Agrupa por tipo, ajusta Isolation Forest quando há dados suficientes,
    e identifica sessões fora do padrão com z-scores explicativos.
    """
    by_type: dict[str, list[dict]] = {}
    for act in activities:
        t = act.get("type")
        if not t:
            continue
        if activity_type and t != activity_type:
            continue
        by_type.setdefault(t, []).append(act)

    all_anomalies: list[dict[str, Any]] = []
    types_analyzed: list[str] = []
    skipped_types: list[str] = []

    for act_type, acts in sorted(by_type.items()):
        rows_with_act = [(a, _extract_row(a)) for a in acts]
        valid = [(a, r) for a, r in rows_with_act if r is not None]

        if len(valid) < MIN_SESSIONS_PER_TYPE:
            skipped_types.append(act_type)
            continue

        types_analyzed.append(act_type)
        X = np.array([r for _, r in valid])

        # Normalizar para o IsolationForest
        means = X.mean(axis=0)
        stds = X.std(axis=0)
        stds[stds == 0] = 1.0
        X_norm = (X - means) / stds

        model = IsolationForest(
            contamination=contamination,
            random_state=42,
            n_estimators=100,
        )
        model.fit(X_norm)
        scores = model.decision_function(X_norm)
        preds = model.predict(X_norm)

        col_values: dict[str, list[float]] = {
            col: [r[i] for _, r in valid] for i, col in enumerate(FEATURE_COLS)
        }

        for idx, ((act, row), pred, score) in enumerate(
            zip(valid, preds, scores)
        ):
            if pred != -1:
                continue
            z_scores = {
                col: _z_score(row[i], col_values[col])
                for i, col in enumerate(FEATURE_COLS)
            }
            classification = _classify_deviation(z_scores)
            factors = _explain_factors(act, z_scores)

            all_anomalies.append({
                "activity_type": act_type,
                "activity_name": act.get("name", ""),
                "activity_date": act.get("start_date_local", ""),
                "icu_id": act.get("icu_id", ""),
                "classification": classification,
                "isolation_score": round(float(score), 4),
                "factors": factors,
                "summary": _build_summary(classification, factors),
            })

    return {
        "model_version": ANOMALY_MODEL_VERSION,
        "types_analyzed": types_analyzed,
        "skipped_types": skipped_types,
        "total_activities": sum(len(v) for v in by_type.values()),
        "anomalies": all_anomalies,
        "anomaly_count": len(all_anomalies),
    }


def _build_summary(classification: str, factors: list[dict]) -> str:
    if not factors:
        return "Sessão fora do padrão habitual."
    labels = {
        "positiva": "Sessão acima do padrão",
        "negativa": "Sessão abaixo do padrão",
        "neutra": "Sessão fora do padrão",
    }
    prefix = labels.get(classification, labels["neutra"])
    metrics = [f["metric"] for f in factors[:3]]
    return f"{prefix}: desvio em {', '.join(metrics)}."
