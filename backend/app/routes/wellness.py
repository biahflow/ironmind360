from datetime import timedelta

from fastapi import APIRouter, Depends, Query

from app.database import db
from app.dependencies import current_user
from app.models import Goals, HabitIn
from app.services.discipline import compute_discipline
from app.utils.time import now_utc, today_str


router = APIRouter(tags=["wellness"])

DAILY_CHALLENGES = [
    "Faça 30 minutos de cardio leve e registre como se sentiu.",
    "Beba sua meta de agua hoje e acompanhe ao longo do dia.",
    "Interrompa periodos longos sentado com pausas curtas de movimento.",
    "Priorize alimentos minimamente processados nas refeicoes de hoje.",
    "Caminhe ou corra com intensidade compativel com sua recuperacao.",
    "Medite por 10 minutos e registre seus principais fatores de estresse.",
    "Comece o dia com uma tarefa importante que voce vem adiando.",
    "Planeje suas refeicoes antes que a fome decida por voce.",
    "Proteja sua janela de sono; recuperacao tambem e disciplina.",
    "Execute o treino planejado respeitando dor, fadiga e tecnica.",
]


@router.get("/habits")
async def get_habits(date: str | None = Query(None), user: dict = Depends(current_user)):
    target_date = date or today_str()
    document = await db.habits.find_one(
        {"user_id": str(user["_id"]), "date": target_date}
    )
    if not document:
        return {
            "date": target_date,
            "water_ml": 0,
            "sleep_hours": None,
            "meditate": False,
            "read": False,
            "cold_shower": False,
            "mood": None,
            "anxiety": None,
            "notes": "",
        }
    document["id"] = str(document.pop("_id"))
    return document


@router.put("/habits")
async def put_habits(data: HabitIn, user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    update = {
        key: value
        for key, value in data.model_dump().items()
        if value is not None and key != "date"
    }
    update.update(
        {"user_id": user_id, "date": data.date, "updated_at": now_utc()}
    )
    await db.habits.update_one(
        {"user_id": user_id, "date": data.date}, {"$set": update}, upsert=True
    )
    document = await db.habits.find_one({"user_id": user_id, "date": data.date})
    if document is None:
        raise RuntimeError("Falha ao persistir check-in")
    document["id"] = str(document.pop("_id"))
    return document


@router.get("/dashboard")
async def dashboard(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    current_date = today_str()
    goals = user.get("goals", Goals().model_dump())
    habits = await db.habits.find_one({"user_id": user_id, "date": current_date})
    meals = await db.meals.find(
        {"user_id": user_id, "date": current_date, "deleted_at": None}
    ).to_list(100)
    activities_today = await db.activities.find(
        {"user_id": user_id, "start_date_local": {"$regex": f"^{current_date}"}}
    ).to_list(20)
    week_ago = (now_utc() - timedelta(days=7)).strftime("%Y-%m-%d")
    activities_week = await db.activities.find(
        {"user_id": user_id, "start_date_local": {"$gte": week_ago}}
    ).to_list(100)
    workout_today = bool(activities_today)
    streak = 0
    for offset in range(60):
        day = (now_utc() - timedelta(days=offset)).strftime("%Y-%m-%d")
        active = bool(
            await db.habits.find_one({"user_id": user_id, "date": day})
            or await db.meals.find_one(
                {"user_id": user_id, "date": day, "deleted_at": None}
            )
            or await db.activities.find_one(
                {"user_id": user_id, "start_date_local": {"$regex": f"^{day}"}}
            )
        )
        if active:
            streak += 1
        elif offset:
            break
    return {
        "date": current_date,
        "name": user.get("name"),
        "discipline_score": compute_discipline(
            habits, len(meals), workout_today, goals
        ),
        "streak": streak,
        "daily_challenge": DAILY_CHALLENGES[
            now_utc().timetuple().tm_yday % len(DAILY_CHALLENGES)
        ],
        "workout_today": workout_today,
        "weekly_load": round(
            sum(activity.get("icu_training_load") or 0 for activity in activities_week)
        ),
        "weekly_km": round(
            sum((activity.get("distance") or 0) for activity in activities_week) / 1000,
            1,
        ),
        "weekly_workouts": len(activities_week),
        "calories": sum(meal.get("calories", 0) or 0 for meal in meals),
        "protein": sum(meal.get("protein_g", 0) or 0 for meal in meals),
        "water_ml": (habits or {}).get("water_ml", 0),
        "sleep_hours": (habits or {}).get("sleep_hours"),
        "mood": (habits or {}).get("mood"),
        "anxiety": (habits or {}).get("anxiety"),
        "meditate": bool((habits or {}).get("meditate")),
        "read": bool((habits or {}).get("read")),
        "cold_shower": bool((habits or {}).get("cold_shower")),
        "meals_count": len(meals),
        "goals": goals,
        "intervals_connected": bool(user.get("intervals_api_key")),
    }
