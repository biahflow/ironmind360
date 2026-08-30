"""Modelo de risco de overtraining — composto, transparente e baseado em
ciência do esporte (Fase 5, Bloco 2).

Não é supervisionado: não há outcomes rotulados (lesão/overtraining) no
histórico. Combina sinais consolidados na literatura em um score interpretável:

  - ACWR (Acute:Chronic Workload Ratio, Gabbett): faixa de segurança ~0.8–1.3.
  - Monotonia e strain de treino (Foster): baixa variação diária eleva risco.
  - Carga subjetiva: fadiga, sono, estresse e energia (médias de 7 dias).

Guardrails: retorna classificação de risco (nunca certeza), com fatores
explícitos e a versão do modelo. Sinaliza para atenção; não diagnostica nem
altera o plano — apenas sugere.
"""

from __future__ import annotations

from typing import Any

RISK_MODEL_VERSION = "1.0.0"

# Pesos/limiares do modelo. Versionável via registry (metadata["config"]).
DEFAULT_CONFIG: dict[str, Any] = {
    "model_version": RISK_MODEL_VERSION,
    "acwr": {"high": 1.5, "elevated": 1.3, "low": 0.8},
    "monotony": {"high": 2.0, "elevated": 1.5},
    "weights": {
        "acwr_high": 35,
        "acwr_elevated": 18,
        "acwr_low": 8,
        "monotony_high": 20,
        "monotony_elevated": 10,
        "fatigue_high": 20,
        "fatigue_elevated": 10,
        "sleep_low": 12,
        "stress_high": 8,
        "energy_low": 8,
    },
    # Cortes de classificação do score (0–100, maior = pior).
    "levels": {"moderado": 20, "alto": 45, "critico": 70},
    "min_active_days": 4,
}

RECOMMENDATIONS = {
    "baixo": "Carga sob controle. Mantenha a progressão e a recuperação.",
    "moderado": "Atenção à recuperação; evite aumentar o volume nesta semana.",
    "alto": "Considere reduzir o volume ou incluir um dia de descanso.",
    "critico": "Priorize a recuperação; avalie uma semana de descarga.",
    "indeterminado": "Dados insuficientes para estimar o risco de carga.",
}


def _classify(score: float, levels: dict[str, float]) -> str:
    if score >= levels["critico"]:
        return "critico"
    if score >= levels["alto"]:
        return "alto"
    if score >= levels["moderado"]:
        return "moderado"
    return "baixo"


def _confidence(active_days: int, checkins: int) -> str:
    if active_days >= 14 and checkins >= 3:
        return "alta"
    if active_days >= 7 or checkins >= 1:
        return "media"
    return "baixa"


def _trajectory(acute_daily: float, chronic_daily: float) -> str:
    if chronic_daily <= 0:
        return "indeterminada"
    ratio = acute_daily / chronic_daily
    if ratio >= 1.15:
        return "subindo"
    if ratio <= 0.85:
        return "descendo"
    return "estavel"


def compute_overtraining_risk(features: dict, config: dict | None = None) -> dict[str, Any]:
    cfg = config or DEFAULT_CONFIG
    load = features.get("load", {}) or {}
    recovery = features.get("recovery", {}) or {}

    acwr = load.get("acwr")
    active_days = int(load.get("active_days_28d") or 0)
    checkins = int(recovery.get("checkins_7d") or 0)

    base = {
        "model_version": cfg.get("model_version", RISK_MODEL_VERSION),
        "feature_schema_version": features.get("feature_schema_version"),
        "as_of": features.get("as_of"),
        "acwr": acwr,
        "monotony": load.get("monotony"),
        "strain": load.get("strain"),
    }

    # Dados insuficientes → não arriscar uma classificação.
    if acwr is None or active_days < cfg.get("min_active_days", 4):
        return {
            **base,
            "risk_level": "indeterminado",
            "risk_score": None,
            "confidence": "baixa",
            "factors": [],
            "projected_fatigue": {
                "horizon_days": 7,
                "trajectory": "indeterminada",
                "note": "Registre mais treinos e check-ins para estimar a carga.",
            },
            "recommendation": RECOMMENDATIONS["indeterminado"],
        }

    w = cfg["weights"]
    a = cfg["acwr"]
    m = cfg["monotony"]
    score = 0.0
    factors: list[dict] = []

    def add(points: float, area: str, impact: str, detail: str) -> None:
        nonlocal score
        score += points
        factors.append({"area": area, "impact": impact, "detail": detail})

    # ── ACWR ──
    if acwr > a["high"]:
        add(w["acwr_high"], "acwr", "red", f"ACWR {acwr} acima de {a['high']} (pico de carga).")
    elif acwr >= a["elevated"]:
        add(w["acwr_elevated"], "acwr", "yellow", f"ACWR {acwr} elevado (>{a['elevated']}).")
    elif acwr < a["low"]:
        add(w["acwr_low"], "acwr", "yellow", f"ACWR {acwr} baixo (<{a['low']}) — possível descondicionamento.")

    # ── Monotonia ──
    monotony = load.get("monotony")
    if monotony is not None:
        if monotony > m["high"]:
            add(w["monotony_high"], "monotonia", "red", f"Monotonia {monotony} alta (>{m['high']}).")
        elif monotony >= m["elevated"]:
            add(w["monotony_elevated"], "monotonia", "yellow", f"Monotonia {monotony} elevada.")

    # ── Recuperação subjetiva (médias 7d) ──
    fatigue = recovery.get("fatigue_avg")
    if fatigue is not None:
        if fatigue >= 4:
            add(w["fatigue_high"], "fadiga", "red", f"Fadiga média alta ({fatigue}/5).")
        elif fatigue >= 3.5:
            add(w["fatigue_elevated"], "fadiga", "yellow", f"Fadiga média elevada ({fatigue}/5).")

    sleep = recovery.get("sleep_hours_avg")
    if sleep is not None and sleep < 6:
        add(w["sleep_low"], "sono", "yellow", f"Sono médio baixo ({sleep}h).")

    stress = recovery.get("stress_avg")
    if stress is not None and stress >= 4:
        add(w["stress_high"], "estresse", "yellow", f"Estresse médio elevado ({stress}/5).")

    energy = recovery.get("energy_avg")
    if energy is not None and energy <= 2:
        add(w["energy_low"], "energia", "yellow", f"Energia média baixa ({energy}/5).")

    final = int(max(0, min(100, round(score))))
    level = _classify(final, cfg["levels"])

    return {
        **base,
        "risk_level": level,
        "risk_score": final,
        "confidence": _confidence(active_days, checkins),
        "factors": factors,
        "projected_fatigue": {
            "horizon_days": 7,
            "trajectory": _trajectory(
                float(load.get("acute_daily") or 0), float(load.get("chronic_daily") or 0)
            ),
            "note": "Projeção qualitativa pela tendência recente de carga; não é um valor absoluto.",
        },
        "recommendation": RECOMMENDATIONS[level],
    }
