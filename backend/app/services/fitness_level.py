"""Recomendação transparente do nível de preparação física complementar.

Função pura, sem dependências externas, para permitir teste unitário isolado.
Regra do produto: retorno após sedentarismo (ou dor/lesão ativa) recomenda
`beginner` por segurança, sempre permitindo ajuste manual informado depois.
"""

from app.models.profile import ComplementaryLevel


def recommend_complementary_level(assessment: dict) -> dict:
    """Retorna nível recomendado e os fatores explícitos que o justificam."""

    months = int(assessment.get("strength_training_months") or 0)
    active_days = int(assessment.get("weekly_active_days") or 0)
    returning = bool(assessment.get("returning_from_sedentary"))
    can_squat = bool(assessment.get("can_squat_bodyweight"))
    can_hinge = bool(assessment.get("can_hinge_pattern"))
    has_pain = bool(assessment.get("has_pain_or_injury"))

    reasons: list[str] = []
    level: ComplementaryLevel

    if returning or has_pain:
        level = "beginner"
        if returning:
            reasons.append("Retorno após período sedentário: começar no básico reduz risco.")
        if has_pain:
            reasons.append("Dor ou lesão ativa relatada: priorizar técnica e amplitude segura.")
    elif months >= 24 and active_days >= 4 and can_squat and can_hinge:
        level = "advanced"
        reasons.append(f"{months} meses de treino de força com padrões de movimento consolidados.")
        reasons.append(f"{active_days} dias ativos por semana sustentam maior estímulo.")
    elif months >= 6 and can_squat:
        level = "intermediate"
        reasons.append(f"{months} meses de treino de força e agachamento com o próprio peso dominado.")
    else:
        level = "beginner"
        reasons.append("Base de força ainda em construção: iniciar pelo nível básico.")

    return {"level": level, "reasons": reasons}
