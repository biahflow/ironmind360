"""Meta nutricional do dia — fonte única (usada pela rota /nutrition/today-target
e pelo contexto do coach). Interliga nutrição com carga de treino, prova e
sinais de recuperação (sono/fadiga), sem depender do serviço de ML."""

from app.database import db
from app.models import Goals
from app.utils.time import today_str


async def compute_today_target(user: dict) -> dict:
    user_id = str(user["_id"])
    today = today_str()

    plan_doc = await db.nutrition_plans.find_one({"user_id": user_id})
    plan = plan_doc.get("plan") if plan_doc else None
    if plan:
        base = {
            "calories": plan.get("daily_calories") or 0,
            "protein_g": plan.get("protein_g") or 0,
            "carbs_g": plan.get("carbs_g") or 0,
            "fat_g": plan.get("fat_g") or 0,
        }
        source = "plano"
    else:
        goals = user.get("goals") or Goals().model_dump()
        base = {
            "calories": goals.get("calories") or 0,
            "protein_g": goals.get("protein") or 0,
            "carbs_g": 0,
            "fat_g": 0,
        }
        source = "metas"

    today_tss = 0
    async for a in db.activities.find(
        {"user_id": user_id, "start_date_local": {"$regex": f"^{today}"}},
        {"icu_training_load": 1},
    ):
        today_tss += a.get("icu_training_load") or 0
    today_tss = round(today_tss)

    is_training_day = today_tss >= 30
    extra_kcal = min(round(today_tss * 6), 700) if is_training_day else 0

    # Interconexão: prova de hoje e sinais de recuperação (sono/fadiga do
    # check-in) ajustam o contexto — combustível para o trabalho exigido.
    race_today = await db.races.find_one(
        {"user_id": user_id, "deleted_at": None, "date": today}, {"name": 1},
    )
    checkin = await db.habits.find_one(
        {"user_id": user_id, "date": today}, {"fatigue": 1, "sleep_hours": 1},
    ) or {}
    fatigue = checkin.get("fatigue")
    sleep_h = checkin.get("sleep_hours")
    needs_recovery = (fatigue is not None and fatigue >= 4) or (sleep_h is not None and sleep_h < 6)

    adjusted = dict(base)
    adjusted["calories"] = base["calories"] + extra_kcal
    if extra_kcal:
        adjusted["carbs_g"] = (base["carbs_g"] or 0) + round(extra_kcal / 4)

    if race_today:
        context = "race"
        message = ("Dia de prova: priorize carboidrato de fácil digestão e "
                   "hidratação. Não experimente nada novo hoje.")
        ref_kcal = adjusted["calories"] or base["calories"] or 2000
        adjusted["carbs_g"] = max(adjusted["carbs_g"], round(ref_kcal * 0.6 / 4))
    elif is_training_day:
        context = "training"
        message = (f"Combustível para o treino de hoje: +{extra_kcal} kcal, "
                   "com foco em carboidrato ao redor da sessão.")
    elif needs_recovery:
        context = "recovery"
        message = ("Dia de recuperação: mantenha a proteína e a hidratação; "
                   "segure o excesso de carboidrato.")
    else:
        context = "rest"
        message = "Dia leve: coma conforme a fome, mantendo proteína e vegetais."

    return {
        **adjusted,
        "source": source,
        "is_training_day": is_training_day,
        "today_tss": today_tss,
        "extra_kcal": extra_kcal,
        "is_race_day": bool(race_today),
        "context": context,
        "message": message,
    }
