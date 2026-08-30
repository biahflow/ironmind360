"""Periodização inteligente de treino auxiliar.

Função pura — recebe dados já carregados, sem acesso a banco.
Ajusta volume e intensidade da sessão de força com base em:
  - Proximidade de provas (A/B/C)
  - Prontidão do atleta (readiness)
  - Carga acumulada nos últimos 7 dias (TSS)
"""

from __future__ import annotations

from datetime import date


def compute_periodization(
    plan: dict | None,
    readiness: dict | None,
    races: list[dict],
    training_load_7d: float,
) -> dict:
    phase = "base"
    days_to_a_race: int | None = None
    next_race: dict | None = None
    volume_multiplier = 1.0
    intensity_adjustment = 0
    force_deload = False
    skip_recommendation = False
    reasoning: list[str] = []

    if not plan:
        return {
            "phase": phase,
            "days_to_a_race": None,
            "next_race": None,
            "volume_multiplier": volume_multiplier,
            "intensity_adjustment": intensity_adjustment,
            "force_deload": False,
            "skip_recommendation": False,
            "reasoning": ["Nenhum programa ativo — periodização não aplicável."],
        }

    today = date.today()

    future_races = []
    for r in races:
        try:
            race_date = date.fromisoformat(r["date"])
        except (ValueError, KeyError):
            continue
        if race_date >= today:
            future_races.append({**r, "_date": race_date, "_days": (race_date - today).days})

    future_races.sort(key=lambda r: r["_days"])

    for r in future_races:
        pri = r.get("priority", "C")
        days = r["_days"]

        if pri == "A":
            if days_to_a_race is None:
                days_to_a_race = days
                next_race = {"name": r.get("name", ""), "date": r["date"], "priority": "A"}

            if days <= 3:
                phase = "race_week"
                volume_multiplier = 0.0
                intensity_adjustment = -2
                skip_recommendation = True
                reasoning.append(
                    f"Prova A \"{r.get('name', '')}\" em {days} dia(s) — "
                    f"semana de prova, sessão de força não recomendada."
                )
                break
            elif days <= 14:
                phase = "taper"
                volume_multiplier = min(volume_multiplier, 0.5)
                intensity_adjustment = min(intensity_adjustment, -1)
                reasoning.append(
                    f"Prova A \"{r.get('name', '')}\" em {days} dia(s) — "
                    f"fase de taper, volume reduzido a 50%."
                )
                break
            elif days <= 42:
                phase = "build"
                reasoning.append(
                    f"Prova A \"{r.get('name', '')}\" em {days} dia(s) — "
                    f"fase de construção, volume normal."
                )
                break

        elif pri == "B":
            if days <= 2:
                if phase == "base":
                    phase = "race_week"
                volume_multiplier = min(volume_multiplier, 0.3)
                intensity_adjustment = min(intensity_adjustment, -2)
                skip_recommendation = True
                reasoning.append(
                    f"Prova B \"{r.get('name', '')}\" em {days} dia(s) — "
                    f"sessão de força não recomendada."
                )
                if next_race is None:
                    next_race = {"name": r.get("name", ""), "date": r["date"], "priority": "B"}
                break
            elif days <= 7:
                volume_multiplier = min(volume_multiplier, 0.7)
                intensity_adjustment = min(intensity_adjustment, -1)
                reasoning.append(
                    f"Prova B \"{r.get('name', '')}\" em {days} dia(s) — "
                    f"volume reduzido a 70%."
                )
                if next_race is None:
                    next_race = {"name": r.get("name", ""), "date": r["date"], "priority": "B"}

    if readiness:
        level = readiness.get("level", "green")
        score = readiness.get("score", 100)

        if level == "red" or score < 40:
            force_deload = True
            volume_multiplier = min(volume_multiplier, 0.5)
            intensity_adjustment = min(intensity_adjustment, -2)
            reasoning.append(
                f"Prontidão vermelha (score {score}) — "
                f"deload forçado, priorize recuperação."
            )
        elif level == "yellow" or score < 70:
            volume_multiplier = min(volume_multiplier, 0.75)
            intensity_adjustment = min(intensity_adjustment, -1)
            reasoning.append(
                f"Prontidão amarela (score {score}) — "
                f"volume reduzido a {int(volume_multiplier * 100)}%."
            )

    if training_load_7d > 700:
        volume_multiplier = min(volume_multiplier, 0.6)
        reasoning.append(
            f"Carga acumulada alta ({training_load_7d:.0f} TSS em 7 dias) — "
            f"volume limitado a {int(volume_multiplier * 100)}% para evitar sobrecarga."
        )
    elif training_load_7d > 500:
        volume_multiplier = min(volume_multiplier, 0.8)
        reasoning.append(
            f"Carga acumulada moderada ({training_load_7d:.0f} TSS em 7 dias) — "
            f"volume limitado a {int(volume_multiplier * 100)}%."
        )

    if not reasoning:
        reasoning.append("Sem ajustes — treino normal conforme o programa.")

    return {
        "phase": phase,
        "days_to_a_race": days_to_a_race,
        "next_race": next_race,
        "volume_multiplier": round(volume_multiplier, 2),
        "intensity_adjustment": intensity_adjustment,
        "force_deload": force_deload,
        "skip_recommendation": skip_recommendation,
        "reasoning": reasoning,
    }
