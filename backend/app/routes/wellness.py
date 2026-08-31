from datetime import timedelta

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from app.adapters.ml import MLClient
from app.database import db
from app.dependencies import current_user
from app.models import Goals, HabitIn
from app.models.wellness import CustomHabitIn, CustomHabitLogIn, PainCheckIn
from app.services.discipline import compute_discipline
from app.services.files import create_file
from app.services.readiness import compute_readiness
from app.utils.time import now_utc, today_str


router = APIRouter(tags=["wellness"])

_ml = MLClient()


async def _safe_ml_risk(user_id: str) -> dict | None:
    """Risco de overtraining do serviço ml, fail-open (None se indisponível)."""
    try:
        return await _ml.overtraining_risk(user_id=user_id)
    except Exception:
        return None


async def _safe_ml_anomalies(user_id: str) -> dict | None:
    """Anomalias do serviço ml, fail-open (None se indisponível)."""
    try:
        return await _ml.anomalies(user_id=user_id)
    except Exception:
        return None

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


# --------------- Check-in diário ---------------

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
            "sleep_quality": None,
            "meditate": False,
            "read": False,
            "cold_shower": False,
            "mood": None,
            "anxiety": None,
            "fatigue": None,
            "stress": None,
            "energy": None,
            "motivation": None,
            "symptoms": "",
            "notes": "",
            "weight_kg": None,
            "waist_cm": None,
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


# --------------- Consistência semanal dos hábitos ---------------

# Hábitos "fixos" que vivem no próprio documento de check-in (habits).
BUILTIN_HABITS = [
    {"key": "meditate", "name": "Meditar", "icon": "leaf-outline"},
    {"key": "read", "name": "Ler", "icon": "book-outline"},
    {"key": "cold_shower", "name": "Banho gelado", "icon": "snow-outline"},
]


async def _extras_progress(
    user_id: str, date: str, habits: dict | None
) -> tuple[int, int]:
    """Concluídos/total de hábitos de estilo de vida no dia: 3 fixos + custom booleanos."""
    done = sum(
        bool((habits or {}).get(n)) for n in ("meditate", "read", "cold_shower")
    )
    total = 3
    customs = await db.custom_habits.find(
        {"user_id": user_id, "deleted_at": None, "kind": "boolean"}
    ).to_list(50)
    for c in customs:
        total += 1
        log = await db.custom_habit_logs.find_one(
            {"habit_id": str(c["_id"]), "user_id": user_id, "date": date}
        )
        if log and log.get("value"):
            done += 1
    return done, total


def _streak_from(done_by_date: dict, dates_desc: list[str]) -> int:
    """Conta dias consecutivos concluídos a partir de hoje (dates_desc[0])."""
    streak = 0
    for d in dates_desc:
        if done_by_date.get(d):
            streak += 1
        else:
            break
    return streak


@router.get("/habits/week")
async def habits_week(
    days: int = Query(default=7, ge=1, le=30), user: dict = Depends(current_user)
):
    user_id = str(user["_id"])
    now = now_utc()
    dates_desc = [(now - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days)]
    dates_asc = list(reversed(dates_desc))
    today = dates_desc[0]

    habit_docs = await db.habits.find(
        {"user_id": user_id, "date": {"$in": dates_desc}}
    ).to_list(days)
    by_date = {d["date"]: d for d in habit_docs}

    result: list[dict] = []

    for h in BUILTIN_HABITS:
        done_map = {d: bool((by_date.get(d) or {}).get(h["key"])) for d in dates_desc}
        result.append({
            "key": h["key"],
            "name": h["name"],
            "icon": h["icon"],
            "kind": "boolean",
            "builtin": True,
            "done_today": done_map[today],
            "streak": _streak_from(done_map, dates_desc),
            "week": [done_map[d] for d in dates_asc],
        })

    customs = await db.custom_habits.find(
        {"user_id": user_id, "deleted_at": None}
    ).sort("created_at", 1).to_list(50)

    for c in customs:
        cid = str(c["_id"])
        target = c.get("target")
        kind = c.get("kind", "boolean")
        logs = await db.custom_habit_logs.find(
            {"habit_id": cid, "user_id": user_id, "date": {"$in": dates_desc}}
        ).to_list(days)
        value_map = {log["date"]: (log.get("value") or 0) for log in logs}

        def _done(value: float) -> bool:
            if kind == "boolean":
                return bool(value)
            if target:
                return value >= target
            return value > 0

        done_map = {d: _done(value_map.get(d, 0)) for d in dates_desc}
        result.append({
            "id": cid,
            "key": f"custom:{cid}",
            "name": c.get("name"),
            "icon": c.get("icon", "ellipse-outline"),
            "kind": kind,
            "unit": c.get("unit", ""),
            "target": target,
            "builtin": False,
            "value_today": value_map.get(today, 0),
            "done_today": done_map[today],
            "streak": _streak_from(done_map, dates_desc),
            "week": [done_map[d] for d in dates_asc],
        })

    return {"days": dates_asc, "habits": result}


# --------------- Prontidão ---------------

@router.get("/readiness")
async def get_readiness(date: str | None = Query(None), user: dict = Depends(current_user)):
    target_date = date or today_str()
    user_id = str(user["_id"])
    checkin = await db.habits.find_one({"user_id": user_id, "date": target_date})
    pain_doc = await db.pain_logs.find_one({"user_id": user_id, "date": target_date})
    pain_entries = (pain_doc or {}).get("entries", [])
    load_risk = await _safe_ml_risk(user_id)
    result = compute_readiness(checkin or {}, pain_entries, load_risk)
    result["date"] = target_date
    if load_risk:
        result["overtraining"] = load_risk
    return result


# --------------- Mapa de dor ---------------

@router.put("/pain")
async def put_pain(data: PainCheckIn, user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    now = now_utc()
    await db.pain_logs.update_one(
        {"user_id": user_id, "date": data.date},
        {"$set": {"entries": [e.model_dump() for e in data.entries], "updated_at": now}},
        upsert=True,
    )
    return {"ok": True, "date": data.date, "count": len(data.entries)}


@router.get("/pain")
async def get_pain(
    date: str | None = Query(None),
    days: int = Query(default=30, ge=1, le=365),
    user: dict = Depends(current_user),
):
    user_id = str(user["_id"])
    if date:
        doc = await db.pain_logs.find_one({"user_id": user_id, "date": date})
        return {"date": date, "entries": (doc or {}).get("entries", [])}
    oldest = (now_utc() - timedelta(days=days)).strftime("%Y-%m-%d")
    docs = (
        await db.pain_logs.find({"user_id": user_id, "date": {"$gte": oldest}})
        .sort("date", -1)
        .to_list(days)
    )
    return {"history": [{"date": d["date"], "entries": d.get("entries", [])} for d in docs]}


# --------------- Hábitos customizáveis ---------------

@router.post("/custom-habits", status_code=201)
async def create_custom_habit(data: CustomHabitIn, user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    count = await db.custom_habits.count_documents({"user_id": user_id, "deleted_at": None})
    if count >= 50:
        raise HTTPException(400, "Limite de 50 hábitos customizáveis atingido")
    now = now_utc()
    document = {
        "user_id": user_id,
        **data.model_dump(),
        "created_at": now,
        "deleted_at": None,
    }
    result = await db.custom_habits.insert_one(document)
    return {"id": str(result.inserted_id), **data.model_dump()}


@router.get("/custom-habits")
async def list_custom_habits(user: dict = Depends(current_user)):
    docs = (
        await db.custom_habits.find({"user_id": str(user["_id"]), "deleted_at": None})
        .sort("created_at", 1)
        .to_list(50)
    )
    for d in docs:
        d["id"] = str(d.pop("_id"))
        d.pop("user_id", None)
        d.pop("deleted_at", None)
    return {"habits": docs}


@router.delete("/custom-habits/{habit_id}")
async def delete_custom_habit(habit_id: str, user: dict = Depends(current_user)):
    if not ObjectId.is_valid(habit_id):
        raise HTTPException(404, "Hábito nao encontrado")
    result = await db.custom_habits.update_one(
        {"_id": ObjectId(habit_id), "user_id": str(user["_id"]), "deleted_at": None},
        {"$set": {"deleted_at": now_utc()}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Hábito nao encontrado")
    return {"ok": True}


@router.put("/custom-habits/{habit_id}/log")
async def log_custom_habit(
    habit_id: str, data: CustomHabitLogIn, user: dict = Depends(current_user)
):
    user_id = str(user["_id"])
    if not ObjectId.is_valid(habit_id):
        raise HTTPException(404, "Hábito nao encontrado")
    habit = await db.custom_habits.find_one(
        {"_id": ObjectId(habit_id), "user_id": user_id, "deleted_at": None}
    )
    if not habit:
        raise HTTPException(404, "Hábito nao encontrado")
    await db.custom_habit_logs.update_one(
        {"habit_id": habit_id, "user_id": user_id, "date": data.date},
        {"$set": {"value": data.value, "updated_at": now_utc()}},
        upsert=True,
    )
    return {"ok": True, "habit_id": habit_id, "date": data.date, "value": data.value}


@router.get("/custom-habits/{habit_id}/log")
async def get_custom_habit_logs(
    habit_id: str,
    days: int = Query(default=30, ge=1, le=365),
    user: dict = Depends(current_user),
):
    user_id = str(user["_id"])
    oldest = (now_utc() - timedelta(days=days)).strftime("%Y-%m-%d")
    docs = (
        await db.custom_habit_logs.find(
            {"habit_id": habit_id, "user_id": user_id, "date": {"$gte": oldest}}
        )
        .sort("date", -1)
        .to_list(days)
    )
    return {"logs": [{"date": d["date"], "value": d["value"]} for d in docs]}


# --------------- Fotos corporais ---------------

@router.post("/body-photos", status_code=201)
async def upload_body_photo(
    date: str = Query(pattern=r"^\d{4}-\d{2}-\d{2}$"),
    file: UploadFile = File(...),
    user: dict = Depends(current_user),
):
    user_id = str(user["_id"])
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "Apenas JPEG, PNG ou WebP")
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(400, "Arquivo maior que 10 MB")
    file_doc = await create_file(
        owner_user_id=user_id,
        data=data,
        content_type=file.content_type or "image/jpeg",
        original_name=file.filename,
    )
    await db.body_photos.insert_one({
        "user_id": user_id,
        "file_id": file_doc["_id"],
        "date": date,
        "created_at": now_utc(),
    })
    return {"ok": True, "file_id": file_doc["_id"], "date": date}


@router.get("/body-photos")
async def list_body_photos(
    days: int = Query(default=90, ge=1, le=730),
    user: dict = Depends(current_user),
):
    user_id = str(user["_id"])
    oldest = (now_utc() - timedelta(days=days)).strftime("%Y-%m-%d")
    docs = (
        await db.body_photos.find({"user_id": user_id, "date": {"$gte": oldest}})
        .sort("date", -1)
        .to_list(200)
    )
    return {"photos": [{"file_id": d["file_id"], "date": d["date"]} for d in docs]}


# --------------- Disciplina (configurável) ---------------

@router.get("/discipline")
async def get_discipline(date: str | None = Query(None), user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    target_date = date or today_str()
    goals = user.get("goals", Goals().model_dump())
    config = user.get("discipline_config") or {}
    habits = await db.habits.find_one({"user_id": user_id, "date": target_date})
    meals = await db.meals.find(
        {"user_id": user_id, "date": target_date, "deleted_at": None}
    ).to_list(100)
    activities_today = await db.activities.find(
        {"user_id": user_id, "start_date_local": {"$regex": f"^{target_date}"}}
    ).to_list(20)
    workout_today = bool(activities_today)
    extra_done, extra_total = await _extras_progress(user_id, target_date, habits)
    score = compute_discipline(
        habits, len(meals), workout_today, goals, extra_done, extra_total
    )

    weights = {
        "workout": config.get("weight_workout", 30),
        "water": config.get("weight_water", 20),
        "sleep": config.get("weight_sleep", 15),
        "meals": config.get("weight_meals", 15),
        "extras": config.get("weight_extras", 20),
    }
    return {
        "date": target_date,
        "score": score,
        "weights": weights,
        "factors": {
            "workout_today": workout_today,
            "water_ml": (habits or {}).get("water_ml", 0),
            "sleep_hours": (habits or {}).get("sleep_hours"),
            "meals_count": len(meals),
            "extras": extra_done,
            "extras_total": extra_total,
        },
    }


# --------------- Dashboard ---------------

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

    pain_doc = await db.pain_logs.find_one({"user_id": user_id, "date": current_date})
    load_risk, anomalies_data = await _safe_ml_risk(user_id), await _safe_ml_anomalies(user_id)
    readiness = compute_readiness(habits or {}, (pain_doc or {}).get("entries", []), load_risk)
    extra_done, extra_total = await _extras_progress(user_id, current_date, habits)

    return {
        "date": current_date,
        "name": user.get("name"),
        "avatar_url": user.get("avatar_url"),
        "discipline_score": compute_discipline(
            habits, len(meals), workout_today, goals, extra_done, extra_total
        ),
        "readiness": readiness,
        "overtraining": load_risk,
        "anomalies": anomalies_data,
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
