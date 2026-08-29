import os
import uuid
import logging
import base64
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Annotated, Any

import jwt
import bcrypt
import requests
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.responses import Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, BeforeValidator, ConfigDict
from bson import ObjectId

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ------------------------------------------------------------------ config
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"
TOKEN_DAYS = 30
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
COACH_PROVIDER = os.environ.get('COACH_MODEL_PROVIDER', 'anthropic')
COACH_MODEL = os.environ.get('COACH_MODEL_NAME', 'claude-sonnet-5')
VISION_PROVIDER = os.environ.get('VISION_MODEL_PROVIDER', 'openai')
VISION_MODEL = os.environ.get('VISION_MODEL_NAME', 'gpt-5.4')
APP_STORAGE_NAME = os.environ.get('APP_STORAGE_NAME', 'ironmind360')

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("ironmind")

app = FastAPI(title="IronMind 360 API")
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

# ------------------------------------------------------------------ mongo helpers
PyObjectId = Annotated[str, BeforeValidator(str)]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def today_str() -> str:
    return now_utc().strftime("%Y-%m-%d")


# ------------------------------------------------------------------ models
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=60)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class Goals(BaseModel):
    calories: int = 2200
    protein: int = 150
    water_ml: int = 3000
    sleep_hours: float = 7.5


class SettingsIn(BaseModel):
    name: Optional[str] = None
    intervals_api_key: Optional[str] = None
    intervals_athlete_id: Optional[str] = None
    goals: Optional[Goals] = None


class HabitIn(BaseModel):
    date: str
    water_ml: Optional[int] = None
    sleep_hours: Optional[float] = None
    meditate: Optional[bool] = None
    read: Optional[bool] = None
    cold_shower: Optional[bool] = None
    mood: Optional[int] = None       # 1..5
    anxiety: Optional[int] = None    # 1..5
    notes: Optional[str] = None


class ChatIn(BaseModel):
    message: str


# ------------------------------------------------------------------ auth utils
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def make_token(user_id: str) -> str:
    payload = {"sub": user_id, "iat": now_utc(), "exp": now_utc() + timedelta(days=TOKEN_DAYS)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def public_user(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "email": doc["email"],
        "name": doc.get("name", ""),
        "goals": doc.get("goals", Goals().model_dump()),
        "intervals_connected": bool(doc.get("intervals_api_key")),
        "intervals_athlete_id": doc.get("intervals_athlete_id", "0"),
    }


async def current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    err = HTTPException(status_code=401, detail="Invalid or expired token")
    if not creds or creds.scheme.lower() != "bearer":
        raise err
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
        uid = payload["sub"]
        if not ObjectId.is_valid(uid):
            raise err
    except Exception:
        raise err
    user = await db.users.find_one({"_id": ObjectId(uid)})
    if not user:
        raise err
    return user


# ------------------------------------------------------------------ object storage
_storage_key = None


def init_storage():
    global _storage_key
    if _storage_key:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    global _storage_key
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    if resp.status_code == 503:
        _storage_key = None
        key = init_storage()
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ------------------------------------------------------------------ intervals.icu
def intervals_get(api_key: str, athlete_id: str, path: str, params: dict = None):
    url = f"https://intervals.icu/api/v1/athlete/{athlete_id}{path}"
    resp = requests.get(url, params=params or {}, auth=("API_KEY", api_key),
                        headers={"User-Agent": "ironmind360/1.0"}, timeout=25)
    if resp.status_code == 401:
        raise HTTPException(400, "Chave da intervals.icu inválida")
    if resp.status_code == 429:
        raise HTTPException(429, "Limite de requisições da intervals.icu atingido")
    if resp.is_error:
        raise HTTPException(502, "Falha ao consultar a intervals.icu")
    return resp.json()


# ------------------------------------------------------------------ Goggins coach
DAILY_CHALLENGES = [
    "Acorde 1h mais cedo e faça 30 min de cardio antes do trabalho. Sem desculpas.",
    "Beba 3L de água hoje. Seu corpo não é uma sugestão, é uma máquina que você negligenciou.",
    "20 flexões a cada hora que ficar sentado no trabalho. Quebre o padrão sedentário.",
    "Zero açúcar processado hoje. Encare o desconforto de frente.",
    "Caminhe ou corra 5km. Não importa a velocidade, importa que você foi.",
    "Medite 10 min e escreva 3 coisas que te deixam ansioso. Encare seus demônios.",
    "Banho gelado de 2 minutos. Faça a coisa difícil primeiro.",
    "Prepare todas as suas refeições hoje. Controle o que entra na sua máquina.",
    "Durma 7h30. Recuperação também é disciplina, não fraqueza.",
    "Faça o treino que você está evitando. Você sabe qual é.",
]


def coach_system_prompt(user_name: str) -> str:
    return (
        f"Você é 'O Comandante', um coach mental no estilo David Goggins para {user_name}, um profissional de TI "
        "de 43 anos, sedentário, ansioso, com compulsão alimentar, que decidiu voltar ao triatlo e transformar a vida "
        "em 360 graus (treino, alimentação, sono, mente).\n\n"
        "SEU ESTILO:\n"
        "- Tough love brutal, direto, sem enrolação. Fale em português do Brasil.\n"
        "- Não passe a mão na cabeça. Cobre responsabilidade (accountability mindset).\n"
        "- Use a mentalidade Goggins: 'Callus your mind', 'Taking souls', 'The 40% rule', 'Stay hard'.\n"
        "- Seja duro MAS construtivo: sempre termine com uma ordem clara e acionável.\n"
        "- Reconheça vitórias reais com respeito curto, depois exija mais.\n"
        "- Ataque desculpas, procrastinação e vitimização imediatamente.\n"
        "- Respostas relativamente curtas e impactantes (2 a 5 parágrafos). Sem emojis excessivos.\n"
        "- Quando tiver dados do usuário (treinos, calorias, sono, humor), use-os para cobrar ou elogiar de forma específica.\n"
    )


def build_llm(session_id: str, system: str, provider: str, model: str) -> LlmChat:
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=system)
    chat.with_model(provider, model)
    return chat


async def gather_context(user: dict) -> str:
    uid = str(user["_id"])
    week_ago = (now_utc() - timedelta(days=7)).strftime("%Y-%m-%d")
    acts = await db.activities.find({"user_id": uid, "start_date_local": {"$gte": week_ago}}).to_list(50)
    meals = await db.meals.find({"user_id": uid, "date": {"$gte": week_ago}, "deleted_at": None}).to_list(100)
    habits = await db.habits.find({"user_id": uid, "date": {"$gte": week_ago}}).to_list(10)
    total_load = sum(a.get("icu_training_load") or 0 for a in acts)
    total_km = round(sum((a.get("distance") or 0) for a in acts) / 1000, 1)
    avg_mood = round(sum(h.get("mood") or 0 for h in habits) / len(habits), 1) if habits else "sem registro"
    avg_sleep = round(sum(h.get("sleep_hours") or 0 for h in habits) / len(habits), 1) if habits else "sem registro"
    days_logged = len(habits)
    return (
        f"DADOS DOS ÚLTIMOS 7 DIAS de {user.get('name')}:\n"
        f"- Treinos registrados: {len(acts)} | Distância total: {total_km} km | Carga de treino: {round(total_load)}\n"
        f"- Refeições registradas: {len(meals)}\n"
        f"- Dias com check-in de hábitos: {days_logged}/7\n"
        f"- Humor médio (1-5): {avg_mood} | Sono médio: {avg_sleep}h\n"
    )


# ------------------------------------------------------------------ ROUTES: auth
@api.get("/")
async def root():
    return {"message": "IronMind 360 API", "status": "operational"}


@api.post("/auth/register")
async def register(data: RegisterIn):
    email = data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(409, "Email já cadastrado")
    doc = {
        "email": email,
        "name": data.name,
        "password_hash": hash_pw(data.password),
        "goals": Goals().model_dump(),
        "intervals_api_key": None,
        "intervals_athlete_id": "0",
        "created_at": now_utc(),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    return {"token": make_token(str(res.inserted_id)), "user": public_user(doc)}


@api.post("/auth/login")
async def login(data: LoginIn):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not verify_pw(data.password, user["password_hash"]):
        raise HTTPException(401, "Email ou senha inválidos")
    return {"token": make_token(str(user["_id"])), "user": public_user(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return public_user(user)


# ------------------------------------------------------------------ ROUTES: settings
@api.get("/settings")
async def get_settings(user: dict = Depends(current_user)):
    return public_user(user)


@api.put("/settings")
async def update_settings(data: SettingsIn, user: dict = Depends(current_user)):
    update = {}
    if data.name is not None:
        update["name"] = data.name
    if data.intervals_api_key is not None:
        update["intervals_api_key"] = data.intervals_api_key.strip() or None
    if data.intervals_athlete_id is not None:
        update["intervals_athlete_id"] = data.intervals_athlete_id.strip() or "0"
    if data.goals is not None:
        update["goals"] = data.goals.model_dump()
    if update:
        await db.users.update_one({"_id": user["_id"]}, {"$set": update})
    fresh = await db.users.find_one({"_id": user["_id"]})
    return public_user(fresh)


# ------------------------------------------------------------------ ROUTES: intervals
@api.post("/intervals/sync")
async def intervals_sync(user: dict = Depends(current_user)):
    api_key = user.get("intervals_api_key")
    if not api_key:
        raise HTTPException(400, "Conecte sua chave da intervals.icu nas configurações primeiro")
    athlete_id = user.get("intervals_athlete_id", "0")
    uid = str(user["_id"])
    newest = today_str()
    oldest = (now_utc() - timedelta(days=60)).strftime("%Y-%m-%d")
    acts = await run_in_threadpool(intervals_get, api_key, athlete_id, "/activities",
                                   {"oldest": oldest, "newest": newest})
    count = 0
    for a in acts or []:
        aid = str(a.get("id"))
        doc = {
            "user_id": uid,
            "icu_id": aid,
            "name": a.get("name"),
            "type": a.get("type"),
            "start_date_local": a.get("start_date_local"),
            "distance": a.get("distance"),
            "moving_time": a.get("moving_time"),
            "elapsed_time": a.get("elapsed_time"),
            "icu_training_load": a.get("icu_training_load"),
            "average_heartrate": a.get("average_heartrate"),
            "max_heartrate": a.get("max_heartrate"),
            "calories": a.get("calories"),
            "total_elevation_gain": a.get("total_elevation_gain"),
            "average_speed": a.get("average_speed"),
            "updated_at": now_utc(),
        }
        await db.activities.update_one({"user_id": uid, "icu_id": aid}, {"$set": doc}, upsert=True)
        count += 1
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"intervals_last_sync": now_utc()}})
    return {"synced": count}


@api.get("/workouts")
async def workouts(user: dict = Depends(current_user)):
    uid = str(user["_id"])
    acts = await db.activities.find({"user_id": uid}).sort("start_date_local", -1).to_list(200)
    for a in acts:
        a["id"] = str(a.pop("_id"))
    return {"workouts": acts, "connected": bool(user.get("intervals_api_key"))}


# ------------------------------------------------------------------ ROUTES: nutrition
async def analyze_food_image(image_bytes: bytes, mime: str) -> dict:
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    system = (
        "Você é um nutricionista especialista em análise de imagens de refeições. "
        "Analise a foto do prato e estime os valores nutricionais. "
        "Responda APENAS com um objeto JSON válido, sem texto extra, no formato: "
        '{"title": "nome curto da refeição em português", "items": ["item1","item2"], '
        '"calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, '
        '"health_score": number (0-10), "coach_note": "uma frase curta estilo Goggins sobre essa refeição"}'
    )
    chat = build_llm(f"food-{uuid.uuid4()}", system, VISION_PROVIDER, VISION_MODEL)
    msg = UserMessage(
        text="Analise esta refeição e retorne o JSON nutricional estimado.",
        file_contents=[ImageContent(image_base64=b64)],
    )
    raw = await chat.send_message(msg)
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1] if "```" in text else text
        text = text.replace("json", "", 1).strip()
    import json as _json
    try:
        data = _json.loads(text)
    except Exception:
        start, end = text.find("{"), text.rfind("}")
        data = _json.loads(text[start:end + 1]) if start >= 0 and end > start else {}
    return data


@api.post("/nutrition/analyze")
async def nutrition_analyze(
    file: UploadFile = File(...),
    meal_type: str = Form("meal"),
    user: dict = Depends(current_user),
):
    uid = str(user["_id"])
    raw = await file.read()
    mime = file.content_type or "image/jpeg"
    ext = "jpg" if "jpeg" in mime or "jpg" in mime else ("png" if "png" in mime else "webp")
    path = f"{APP_STORAGE_NAME}/uploads/{uid}/{uuid.uuid4()}.{ext}"
    await run_in_threadpool(put_object, path, raw, mime)
    analysis = await analyze_food_image(raw, mime)
    meal = {
        "user_id": uid,
        "date": today_str(),
        "meal_type": meal_type,
        "storage_path": path,
        "title": analysis.get("title", "Refeição"),
        "items": analysis.get("items", []),
        "calories": analysis.get("calories", 0),
        "protein_g": analysis.get("protein_g", 0),
        "carbs_g": analysis.get("carbs_g", 0),
        "fat_g": analysis.get("fat_g", 0),
        "health_score": analysis.get("health_score", 0),
        "coach_note": analysis.get("coach_note", ""),
        "created_at": now_utc(),
        "deleted_at": None,
    }
    res = await db.meals.insert_one(meal)
    meal["id"] = str(res.inserted_id)
    meal.pop("_id", None)
    meal["photo_url"] = f"/api/files/{path}"
    return meal


@api.get("/nutrition")
async def nutrition_list(date: str = Query(None), user: dict = Depends(current_user)):
    uid = str(user["_id"])
    d = date or today_str()
    meals = await db.meals.find({"user_id": uid, "date": d, "deleted_at": None}).sort("created_at", 1).to_list(100)
    out = []
    totals = {"calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0}
    for m in meals:
        m["id"] = str(m.pop("_id"))
        m["photo_url"] = f"/api/files/{m['storage_path']}"
        for k in totals:
            totals[k] += m.get(k, 0) or 0
    out = meals
    return {"meals": out, "totals": totals, "date": d, "goals": user.get("goals", Goals().model_dump())}


@api.delete("/nutrition/{meal_id}")
async def nutrition_delete(meal_id: str, user: dict = Depends(current_user)):
    if not ObjectId.is_valid(meal_id):
        raise HTTPException(404, "Not found")
    await db.meals.update_one(
        {"_id": ObjectId(meal_id), "user_id": str(user["_id"])},
        {"$set": {"deleted_at": now_utc()}},
    )
    return {"ok": True}


@api.get("/files/{path:path}")
async def serve_file(path: str, token: str = Query(None)):
    # public-ish read; ownership is enforced by unguessable UUID paths
    try:
        content, ctype = await run_in_threadpool(get_object, path)
    except Exception:
        raise HTTPException(404, "Arquivo não encontrado")
    return Response(content=content, media_type=ctype, headers={"Cache-Control": "public, max-age=86400"})


# ------------------------------------------------------------------ ROUTES: habits
@api.get("/habits")
async def get_habits(date: str = Query(None), user: dict = Depends(current_user)):
    uid = str(user["_id"])
    d = date or today_str()
    h = await db.habits.find_one({"user_id": uid, "date": d})
    if not h:
        return {"date": d, "water_ml": 0, "sleep_hours": None, "meditate": False,
                "read": False, "cold_shower": False, "mood": None, "anxiety": None, "notes": ""}
    h["id"] = str(h.pop("_id"))
    return h


@api.put("/habits")
async def put_habits(data: HabitIn, user: dict = Depends(current_user)):
    uid = str(user["_id"])
    update = {k: v for k, v in data.model_dump().items() if v is not None and k != "date"}
    update["user_id"] = uid
    update["date"] = data.date
    update["updated_at"] = now_utc()
    await db.habits.update_one({"user_id": uid, "date": data.date}, {"$set": update}, upsert=True)
    h = await db.habits.find_one({"user_id": uid, "date": data.date})
    h["id"] = str(h.pop("_id"))
    return h


# ------------------------------------------------------------------ ROUTES: dashboard
def compute_discipline(habits: dict, meals_count: int, workout_today: bool, goals: dict) -> int:
    score = 0
    # workout 30
    if workout_today:
        score += 30
    # water 20
    water = (habits or {}).get("water_ml") or 0
    score += min(20, int(20 * water / max(goals.get("water_ml", 3000), 1)))
    # sleep 15
    sleep = (habits or {}).get("sleep_hours") or 0
    score += min(15, int(15 * sleep / max(goals.get("sleep_hours", 7.5), 1)))
    # nutrition logged 15
    if meals_count > 0:
        score += min(15, 5 * meals_count)
    # habits: meditate/read/cold 20 (~6.6 each)
    extra = sum([bool((habits or {}).get("meditate")), bool((habits or {}).get("read")), bool((habits or {}).get("cold_shower"))])
    score += int(20 * extra / 3)
    return min(100, score)


@api.get("/dashboard")
async def dashboard(user: dict = Depends(current_user)):
    uid = str(user["_id"])
    d = today_str()
    goals = user.get("goals", Goals().model_dump())
    habits = await db.habits.find_one({"user_id": uid, "date": d})
    meals = await db.meals.find({"user_id": uid, "date": d, "deleted_at": None}).to_list(100)
    acts_today = await db.activities.find({"user_id": uid, "start_date_local": {"$regex": f"^{d}"}}).to_list(20)
    week_ago = (now_utc() - timedelta(days=7)).strftime("%Y-%m-%d")
    acts_week = await db.activities.find({"user_id": uid, "start_date_local": {"$gte": week_ago}}).to_list(100)

    calories = sum(m.get("calories", 0) or 0 for m in meals)
    protein = sum(m.get("protein_g", 0) or 0 for m in meals)
    workout_today = len(acts_today) > 0
    weekly_load = round(sum(a.get("icu_training_load") or 0 for a in acts_week))
    weekly_km = round(sum((a.get("distance") or 0) for a in acts_week) / 1000, 1)

    score = compute_discipline(habits, len(meals), workout_today, goals)

    # streak: consecutive days (including today if score-ish) with any activity/habit/meal
    streak = 0
    for i in range(0, 60):
        day = (now_utc() - timedelta(days=i)).strftime("%Y-%m-%d")
        has_habit = await db.habits.find_one({"user_id": uid, "date": day})
        has_meal = await db.meals.find_one({"user_id": uid, "date": day, "deleted_at": None})
        has_act = await db.activities.find_one({"user_id": uid, "start_date_local": {"$regex": f"^{day}"}})
        active = bool(has_habit or has_meal or has_act)
        if active:
            streak += 1
        else:
            if i == 0:
                continue  # today not logged yet, don't break streak
            break

    challenge = DAILY_CHALLENGES[now_utc().timetuple().tm_yday % len(DAILY_CHALLENGES)]

    return {
        "date": d,
        "name": user.get("name"),
        "discipline_score": score,
        "streak": streak,
        "daily_challenge": challenge,
        "workout_today": workout_today,
        "weekly_load": weekly_load,
        "weekly_km": weekly_km,
        "weekly_workouts": len(acts_week),
        "calories": calories,
        "protein": protein,
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


# ------------------------------------------------------------------ ROUTES: coach
@api.get("/coach/history")
async def coach_history(user: dict = Depends(current_user)):
    uid = str(user["_id"])
    msgs = await db.chat_messages.find({"user_id": uid}).sort("created_at", 1).to_list(200)
    for m in msgs:
        m["id"] = str(m.pop("_id"))
    return {"messages": msgs}


@api.post("/coach/chat")
async def coach_chat(data: ChatIn, user: dict = Depends(current_user)):
    uid = str(user["_id"])
    context = await gather_context(user)
    system = coach_system_prompt(user.get("name", "atleta")) + "\n\n" + context
    session_id = f"coach-{uid}"
    chat = build_llm(session_id, system, COACH_PROVIDER, COACH_MODEL)

    # feed recent history for continuity
    recent = await db.chat_messages.find({"user_id": uid}).sort("created_at", -1).to_list(10)
    recent = list(reversed(recent))
    history_txt = "\n".join(f"{m['role']}: {m['content']}" for m in recent[-6:])
    prompt = (f"Histórico recente:\n{history_txt}\n\n" if history_txt else "") + f"Mensagem do atleta: {data.message}"

    reply = await chat.send_message(UserMessage(text=prompt))
    reply = (reply or "").strip()

    await db.chat_messages.insert_one({"user_id": uid, "role": "user", "content": data.message, "created_at": now_utc()})
    await db.chat_messages.insert_one({"user_id": uid, "role": "assistant", "content": reply, "created_at": now_utc()})
    return {"reply": reply}


@api.post("/coach/weekly-report")
async def weekly_report(user: dict = Depends(current_user)):
    uid = str(user["_id"])
    context = await gather_context(user)
    system = coach_system_prompt(user.get("name", "atleta"))
    chat = build_llm(f"report-{uid}-{uuid.uuid4()}", system, COACH_PROVIDER, COACH_MODEL)
    prompt = (
        f"{context}\n\nCom base NESSES dados, escreva um 'After Action Report' (relatório da semana) no seu estilo. "
        "Estrutura: 1) O veredito (você foi fraco ou forte esta semana?), 2) O que os números dizem, "
        "3) As ordens para a próxima semana (3 ações concretas). Seja específico usando os números acima."
    )
    report = await chat.send_message(UserMessage(text=prompt))
    report = (report or "").strip()
    doc = {"user_id": uid, "content": report, "context": context, "created_at": now_utc()}
    await db.weekly_reports.insert_one(doc)
    return {"report": report, "context": context}


# ------------------------------------------------------------------ startup / seed
@app.on_event("startup")
async def startup():
    try:
        await db.users.create_index("email", unique=True)
    except Exception as e:
        logger.warning(f"index: {e}")
    try:
        init_storage()
    except Exception as e:
        logger.warning(f"storage init failed (will retry lazily): {e}")
    # seed demo user
    try:
        demo = await db.users.find_one({"email": "demo@ironmind.app"})
        if not demo:
            await db.users.insert_one({
                "email": "demo@ironmind.app",
                "name": "Rafael",
                "password_hash": hash_pw("Goggins@43"),
                "goals": Goals().model_dump(),
                "intervals_api_key": None,
                "intervals_athlete_id": "0",
                "created_at": now_utc(),
            })
            logger.info("seeded demo user")
    except Exception as e:
        logger.warning(f"seed: {e}")


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
