"""Previsão de performance em prova — modelo empírico (Fase 5, Bloco 4).

Estima o tempo de prova por distância usando o perfil de treino recente do
atleta (pace/velocidade por tipo de atividade) e a **fórmula de Riegel**
para escalar distâncias. Apresenta como intervalo de confiança
(otimista/realista/conservador), nunca como valor absoluto.

Fatores opcionais: elevação e temperatura ajustam o tempo estimado.

Quando houver resultados reais de prova (retroalimentação), o modelo pode
evoluir para Gradient Boosting supervisionado. Por ora, empírico e
transparente — com versão e features documentadas.
"""

from __future__ import annotations

from statistics import mean, stdev, quantiles
from typing import Any

PREDICTION_MODEL_VERSION = "1.0.0"

RIEGEL_EXPONENT = 1.06

TRIATHLON_DISTANCES: dict[str, dict[str, float]] = {
    "sprint": {"Swim": 750, "Ride": 20_000, "Run": 5_000},
    "olympic": {"Swim": 1_500, "Ride": 40_000, "Run": 10_000},
    "half_ironman": {"Swim": 1_900, "Ride": 90_000, "Run": 21_100},
    "ironman": {"Swim": 3_800, "Ride": 180_000, "Run": 42_200},
}

ELEVATION_COST_PER_100M = 0.02
HEAT_THRESHOLD_C = 25
HEAT_COST_PER_DEGREE = 0.005


def _pace_seconds_per_m(activities: list[dict]) -> list[float]:
    """Calcula pace (s/m) de cada atividade com distância e tempo válidos."""
    paces = []
    for act in activities:
        dist = act.get("distance")
        time = act.get("moving_time")
        if dist and time and float(dist) > 0 and float(time) > 0:
            paces.append(float(time) / float(dist))
    return paces


def _riegel(known_time: float, known_dist: float, target_dist: float) -> float:
    """Fórmula de Riegel: T2 = T1 × (D2/D1)^expoente."""
    if known_dist <= 0:
        return 0.0
    return known_time * (target_dist / known_dist) ** RIEGEL_EXPONENT


def build_performance_profile(
    activities: list[dict],
) -> dict[str, dict[str, Any]]:
    """Perfil de desempenho por tipo de atividade (últimas N sessões)."""
    by_type: dict[str, list[dict]] = {}
    for act in activities:
        t = act.get("type")
        if t:
            by_type.setdefault(t, []).append(act)

    profile: dict[str, dict[str, Any]] = {}
    for act_type, acts in by_type.items():
        paces = _pace_seconds_per_m(acts)
        speeds = [1.0 / p for p in paces if p > 0]
        distances = [float(a["distance"]) for a in acts if a.get("distance")]
        durations = [float(a["moving_time"]) for a in acts if a.get("moving_time")]
        hrs = [float(a["average_heartrate"]) for a in acts if a.get("average_heartrate")]

        stats: dict[str, Any] = {
            "sessions": len(acts),
            "avg_pace_s_per_m": round(mean(paces), 4) if paces else None,
            "avg_speed_m_s": round(mean(speeds), 2) if speeds else None,
        }
        if len(paces) >= 2:
            stats["pace_stdev"] = round(stdev(paces), 4)
            q = quantiles(paces, n=10)
            stats["pace_p10"] = round(q[0], 4)
            stats["pace_p50"] = round(q[4], 4)
            stats["pace_p90"] = round(q[8], 4)
        if distances:
            stats["avg_distance_m"] = round(mean(distances), 0)
            stats["max_distance_m"] = round(max(distances), 0)
        if durations:
            stats["avg_duration_s"] = round(mean(durations), 0)
        if hrs:
            stats["avg_hr"] = round(mean(hrs), 1)

        profile[act_type] = stats
    return profile


def _apply_adjustments(
    time_s: float,
    elevation_m: float | None,
    distance_m: float,
    temperature_c: float | None,
) -> tuple[float, list[dict]]:
    """Aplica ajustes de elevação e temperatura, retornando fatores."""
    factors: list[dict] = []
    adjusted = time_s

    if elevation_m and elevation_m > 0 and distance_m > 0:
        pct = (elevation_m / 100.0) * ELEVATION_COST_PER_100M
        delta = time_s * pct
        adjusted += delta
        factors.append({
            "area": "elevação",
            "impact": "yellow" if pct > 0.05 else "green",
            "detail": f"+{pct * 100:.1f}% pelo desnível de {elevation_m:.0f}m.",
        })

    if temperature_c is not None and temperature_c > HEAT_THRESHOLD_C:
        excess = temperature_c - HEAT_THRESHOLD_C
        pct = excess * HEAT_COST_PER_DEGREE
        delta = time_s * pct
        adjusted += delta
        factors.append({
            "area": "calor",
            "impact": "yellow" if excess <= 5 else "red",
            "detail": f"+{pct * 100:.1f}% pela temperatura de {temperature_c:.0f}°C.",
        })

    return adjusted, factors


def predict_race_time(
    activities: list[dict],
    discipline: str,
    distance_m: float,
    elevation_m: float | None = None,
    temperature_c: float | None = None,
) -> dict[str, Any]:
    """Estima tempo de prova para uma disciplina e distância.

    Retorna intervalo otimista/realista/conservador em segundos, com
    fatores explicativos. Nunca apresenta como certeza.
    """
    filtered = [a for a in activities if a.get("type") == discipline]
    paces = _pace_seconds_per_m(filtered)

    if len(paces) < 3:
        return {
            "model_version": PREDICTION_MODEL_VERSION,
            "discipline": discipline,
            "distance_m": distance_m,
            "status": "insufficient_data",
            "message": (
                f"Dados insuficientes para {discipline} "
                f"({len(paces)} sessões com pace válido; mínimo 3)."
            ),
            "optimistic_seconds": None,
            "realistic_seconds": None,
            "conservative_seconds": None,
            "confidence": "baixa",
            "factors": [],
        }

    avg_dist = mean(
        [float(a["distance"]) for a in filtered if a.get("distance") and float(a["distance"]) > 0]
    )
    avg_time = mean(
        [float(a["moving_time"]) for a in filtered if a.get("moving_time") and float(a["moving_time"]) > 0]
    )

    realistic_raw = _riegel(avg_time, avg_dist, distance_m)

    if len(paces) >= 5:
        q = quantiles(paces, n=10)
        optimistic_pace = q[0]
        conservative_pace = q[8]
    else:
        pace_std = stdev(paces) if len(paces) >= 2 else 0
        avg_pace = mean(paces)
        optimistic_pace = avg_pace - pace_std
        conservative_pace = avg_pace + pace_std

    best_time = mean(
        sorted([float(a["moving_time"]) for a in filtered
                if a.get("moving_time") and float(a["moving_time"]) > 0])[:3]
    )
    best_dist = mean(
        sorted([float(a["distance"]) for a in filtered
                if a.get("distance") and float(a["distance"]) > 0],
               reverse=True)[:3]
    )
    optimistic_raw = _riegel(best_time, best_dist, distance_m)
    optimistic_raw = min(optimistic_raw, distance_m * optimistic_pace)

    conservative_raw = distance_m * conservative_pace

    optimistic_adj, opt_factors = _apply_adjustments(
        optimistic_raw, elevation_m, distance_m, temperature_c
    )
    realistic_adj, real_factors = _apply_adjustments(
        realistic_raw, elevation_m, distance_m, temperature_c
    )
    conservative_adj, _ = _apply_adjustments(
        conservative_raw, elevation_m, distance_m, temperature_c
    )

    confidence = "alta" if len(paces) >= 10 else "media" if len(paces) >= 5 else "baixa"

    scaling_ratio = distance_m / avg_dist if avg_dist > 0 else 1
    scale_factors: list[dict] = []
    if scaling_ratio > 3:
        confidence = "baixa"
        scale_factors.append({
            "area": "extrapolação",
            "impact": "red",
            "detail": (
                f"Distância-alvo ({distance_m / 1000:.1f}km) é {scaling_ratio:.1f}× "
                f"maior que a média de treino ({avg_dist / 1000:.1f}km). "
                "Estimativa menos confiável."
            ),
        })
    elif scaling_ratio > 2:
        scale_factors.append({
            "area": "extrapolação",
            "impact": "yellow",
            "detail": (
                f"Distância-alvo {scaling_ratio:.1f}× maior que a média de treino."
            ),
        })

    all_factors = scale_factors + real_factors

    return {
        "model_version": PREDICTION_MODEL_VERSION,
        "discipline": discipline,
        "distance_m": distance_m,
        "status": "ok",
        "optimistic_seconds": round(optimistic_adj),
        "realistic_seconds": round(realistic_adj),
        "conservative_seconds": round(conservative_adj),
        "optimistic_formatted": _format_time(optimistic_adj),
        "realistic_formatted": _format_time(realistic_adj),
        "conservative_formatted": _format_time(conservative_adj),
        "confidence": confidence,
        "factors": all_factors,
        "training_sessions_used": len(paces),
        "avg_training_distance_m": round(avg_dist),
        "riegel_exponent": RIEGEL_EXPONENT,
    }


def predict_triathlon(
    activities: list[dict],
    race_type: str,
    elevation_m: float | None = None,
    temperature_c: float | None = None,
) -> dict[str, Any]:
    """Previsão para prova de triathlon completa (swim + bike + run)."""
    distances = TRIATHLON_DISTANCES.get(race_type)
    if not distances:
        return {
            "model_version": PREDICTION_MODEL_VERSION,
            "race_type": race_type,
            "status": "unknown_race_type",
            "message": f"Tipo de prova desconhecido: {race_type}",
        }

    legs: dict[str, dict] = {}
    total_opt = 0.0
    total_real = 0.0
    total_cons = 0.0
    all_ok = True

    for discipline, dist in distances.items():
        leg = predict_race_time(
            activities, discipline, dist,
            elevation_m=elevation_m if discipline == "Ride" else None,
            temperature_c=temperature_c,
        )
        legs[discipline] = leg
        if leg["status"] != "ok":
            all_ok = False
        else:
            total_opt += leg["optimistic_seconds"]
            total_real += leg["realistic_seconds"]
            total_cons += leg["conservative_seconds"]

    transition_s = 120 if race_type in ("sprint", "olympic") else 300
    if all_ok:
        total_opt += transition_s
        total_real += transition_s
        total_cons += transition_s

    return {
        "model_version": PREDICTION_MODEL_VERSION,
        "race_type": race_type,
        "distances": distances,
        "status": "ok" if all_ok else "partial",
        "legs": legs,
        "transition_seconds": transition_s,
        "total_optimistic_seconds": round(total_opt) if all_ok else None,
        "total_realistic_seconds": round(total_real) if all_ok else None,
        "total_conservative_seconds": round(total_cons) if all_ok else None,
        "total_optimistic_formatted": _format_time(total_opt) if all_ok else None,
        "total_realistic_formatted": _format_time(total_real) if all_ok else None,
        "total_conservative_formatted": _format_time(total_cons) if all_ok else None,
        "confidence": "baixa" if not all_ok else min(
            (l.get("confidence", "baixa") for l in legs.values()),
            key=lambda c: {"alta": 2, "media": 1, "baixa": 0}.get(c, 0),
        ),
        "note": (
            "Estimativa baseada no perfil de treino recente (Riegel). "
            "Inclui transições estimadas. "
            "Não é certeza — use como referência de planejamento."
        ),
    }


def _format_time(seconds: float) -> str:
    s = int(round(seconds))
    if s >= 3600:
        h = s // 3600
        m = (s % 3600) // 60
        sec = s % 60
        return f"{h}:{m:02d}:{sec:02d}"
    m = s // 60
    sec = s % 60
    return f"{m}:{sec:02d}"
