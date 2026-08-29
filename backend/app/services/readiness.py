"""Prontidão verde/amarela/vermelha com fatores explícitos.

Função pura sem dependências externas para facilitar teste unitário.
Escalas de 1 a 5: 1 = pior, 5 = melhor (exceto ansiedade/estresse/fadiga onde 1=baixo, 5=alto).
"""

from typing import Literal

ReadinessLevel = Literal["green", "yellow", "red"]


def compute_readiness(checkin: dict, pain_entries: list[dict] | None = None) -> dict:
    """Retorna nível, score numérico (0-100) e fatores explícitos."""

    factors: list[dict] = []
    score = 100.0

    sleep = checkin.get("sleep_hours")
    if sleep is not None:
        if sleep < 5:
            score -= 30
            factors.append({"area": "sono", "impact": "red", "detail": f"Apenas {sleep}h de sono."})
        elif sleep < 6.5:
            score -= 15
            factors.append({"area": "sono", "impact": "yellow", "detail": f"{sleep}h de sono — abaixo do ideal."})

    sleep_quality = checkin.get("sleep_quality")
    if sleep_quality is not None and sleep_quality <= 2:
        score -= 15
        factors.append({"area": "qualidade_sono", "impact": "yellow", "detail": "Qualidade do sono baixa."})

    fatigue = checkin.get("fatigue")
    if fatigue is not None:
        if fatigue >= 5:
            score -= 25
            factors.append({"area": "fadiga", "impact": "red", "detail": "Fadiga muito alta."})
        elif fatigue >= 4:
            score -= 12
            factors.append({"area": "fadiga", "impact": "yellow", "detail": "Fadiga elevada."})

    stress = checkin.get("stress")
    if stress is not None and stress >= 4:
        score -= 10
        factors.append({"area": "estresse", "impact": "yellow", "detail": "Nível de estresse elevado."})

    anxiety = checkin.get("anxiety")
    if anxiety is not None and anxiety >= 4:
        score -= 10
        factors.append({"area": "ansiedade", "impact": "yellow", "detail": "Ansiedade elevada."})

    energy = checkin.get("energy")
    if energy is not None and energy <= 2:
        score -= 15
        factors.append({"area": "energia", "impact": "yellow", "detail": "Energia baixa."})

    mood = checkin.get("mood")
    if mood is not None and mood <= 2:
        score -= 10
        factors.append({"area": "humor", "impact": "yellow", "detail": "Humor baixo."})

    motivation = checkin.get("motivation")
    if motivation is not None and motivation <= 2:
        score -= 8
        factors.append({"area": "motivação", "impact": "yellow", "detail": "Motivação baixa."})

    if pain_entries:
        max_pain = max(e.get("intensity", 0) for e in pain_entries)
        if max_pain >= 7:
            score -= 25
            factors.append({"area": "dor", "impact": "red", "detail": f"Dor intensa ({max_pain}/10)."})
        elif max_pain >= 4:
            score -= 12
            factors.append({"area": "dor", "impact": "yellow", "detail": f"Dor moderada ({max_pain}/10)."})

    final_score = max(0, min(100, int(score)))

    level: ReadinessLevel
    if final_score >= 70:
        level = "green"
    elif final_score >= 40:
        level = "yellow"
    else:
        level = "red"

    return {"level": level, "score": final_score, "factors": factors}
