"""Geração de lembretes inteligentes baseados no contexto do atleta.

Funções assíncronas que consultam o estado atual e retornam lembretes
prontos para envio via push notification.
"""

from datetime import timedelta

from app.database import db
from app.models import Goals
from app.services.readiness import compute_readiness
from app.utils.time import now_utc, today_str


async def generate_reminders(user_id: str) -> list[dict]:
    reminders: list[dict] = []
    today = today_str()
    now = now_utc()

    user = await db.users.find_one({"_id": __import__("bson").ObjectId(user_id)})
    if not user:
        return reminders

    prefs = await db.notification_preferences.find_one({"user_id": user_id})
    if not prefs:
        prefs = {}

    if prefs.get("checkin_reminder", True):
        checkin = await db.habits.find_one({"user_id": user_id, "date": today})
        if not checkin:
            reminders.append({
                "type": "checkin_reminder",
                "title": "Check-in diário",
                "body": "Registre como você está hoje — sono, humor, energia e fadiga.",
                "data": {},
                "priority": "normal",
            })

    if prefs.get("hydration_reminder", True):
        checkin = await db.habits.find_one({"user_id": user_id, "date": today})
        goals = user.get("goals", Goals().model_dump())
        water_goal = goals.get("water_ml", 3000)
        current_water = (checkin or {}).get("water_ml", 0)
        if current_water < water_goal * 0.5 and now.hour >= 14:
            reminders.append({
                "type": "hydration_reminder",
                "title": "Hidratação",
                "body": (
                    f"Você registrou {current_water} ml de {water_goal} ml hoje. "
                    "Beba água ao longo do dia."
                ),
                "data": {"current_ml": current_water, "goal_ml": water_goal},
                "priority": "normal",
            })

    if prefs.get("workout_reminder", True):
        planned = await db.planned_sessions.find(
            {"user_id": user_id, "start_date_local": {"$regex": f"^{today}"}}
        ).to_list(5)
        if planned:
            names = [p.get("name", "Treino") for p in planned[:3]]
            reminders.append({
                "type": "workout_reminder",
                "title": "Treino de hoje",
                "body": f"Sessões planejadas: {', '.join(names)}.",
                "data": {"count": len(planned)},
                "priority": "normal",
            })

    if prefs.get("equipment_alerts", True):
        equipment_list = await db.equipment.find(
            {"user_id": user_id, "deleted_at": None, "retired": False}
        ).to_list(100)
        for eq in equipment_list:
            max_km = eq.get("max_distance_km")
            total_km = eq.get("total_distance_km", 0)
            max_h = eq.get("max_hours")
            total_h = eq.get("total_hours", 0)
            name = eq.get("name", "Equipamento")

            if max_km and total_km >= max_km * 0.9:
                reminders.append({
                    "type": "equipment_alert",
                    "title": f"Atenção: {name}",
                    "body": (
                        f"{name} atingiu {total_km:.0f} de {max_km:.0f} km. "
                        "Considere substituir."
                    ),
                    "data": {"equipment_id": str(eq["_id"])},
                    "priority": "high",
                })
            elif max_h and total_h >= max_h * 0.9:
                reminders.append({
                    "type": "equipment_alert",
                    "title": f"Atenção: {name}",
                    "body": (
                        f"{name} atingiu {total_h:.0f} de {max_h:.0f} horas. "
                        "Considere substituir."
                    ),
                    "data": {"equipment_id": str(eq["_id"])},
                    "priority": "high",
                })

    if prefs.get("readiness_alerts", True):
        checkin = await db.habits.find_one({"user_id": user_id, "date": today})
        if checkin:
            pain_doc = await db.pain_logs.find_one(
                {"user_id": user_id, "date": today}
            )
            readiness = compute_readiness(
                checkin, (pain_doc or {}).get("entries", [])
            )
            if readiness["level"] in ("red", "yellow"):
                factor_texts = [
                    f.get("detail", "") for f in readiness.get("factors", [])[:3]
                ]
                reminders.append({
                    "type": "readiness_alert",
                    "title": "Prontidão reduzida",
                    "body": (
                        f"Sua prontidão está {readiness['level']}. "
                        + " ".join(factor_texts)
                    ),
                    "data": {"level": readiness["level"], "score": readiness["score"]},
                    "priority": "high" if readiness["level"] == "red" else "normal",
                })

    if prefs.get("race_countdown", True):
        week_ahead = (now + timedelta(days=7)).strftime("%Y-%m-%d")
        upcoming_races = await db.races.find({
            "user_id": user_id,
            "deleted_at": None,
            "date": {"$gte": today, "$lte": week_ahead},
        }).to_list(5)
        for race in upcoming_races:
            race_date = race.get("date", "")
            race_name = race.get("name", "Prova")
            if race_date >= today:
                from datetime import datetime
                try:
                    rd = datetime.strptime(race_date, "%Y-%m-%d")
                    td = datetime.strptime(today, "%Y-%m-%d")
                    days_left = (rd - td).days
                except ValueError:
                    days_left = 0
                if days_left == 0:
                    body = f"Hoje é o dia da {race_name}! Boa prova!"
                elif days_left == 1:
                    body = f"Amanhã é a {race_name}! Confira seu checklist."
                else:
                    body = f"Faltam {days_left} dias para a {race_name}."
                reminders.append({
                    "type": "race_countdown",
                    "title": f"Prova: {race_name}",
                    "body": body,
                    "data": {"race_id": str(race["_id"]), "days_left": days_left},
                    "priority": "high" if days_left <= 1 else "normal",
                })

    if prefs.get("weekly_summary", True) and now.weekday() == 6:
        reminders.append({
            "type": "weekly_summary",
            "title": "Resumo semanal",
            "body": "Confira seu relatório da semana no Coach.",
            "data": {},
            "priority": "normal",
        })

    if prefs.get("meal_reminders", True):
        meal_count = await db.meals.count_documents(
            {"user_id": user_id, "date": today, "deleted_at": None}
        )
        if meal_count == 0 and now.hour >= 12:
            reminders.append({
                "type": "meal_reminder",
                "title": "Registro alimentar",
                "body": "Nenhuma refeição registrada hoje. Registre para acompanhar sua nutrição.",
                "data": {},
                "priority": "normal",
            })

    return reminders
