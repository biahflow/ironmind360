import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends

from app.adapters.ai import complete_text
from app.config import settings
from app.database import db
from app.dependencies import current_user
from app.models import ChatIn
from app.rate_limit import rate_limit
from app.utils.time import now_utc


router = APIRouter(prefix="/coach", tags=["coach"])


def system_prompt(user_name: str) -> str:
    return (
        f"Voce e o Comandante, coach esportivo original de {user_name}. "
        "Fale em portugues do Brasil com firmeza, respeito e clareza. "
        "Seja direto, mas nunca humilhe, diagnostique, prescreva medicamento ou se apresente como terapeuta. "
        "Use os dados fornecidos sem inventar informacoes e termine com uma acao segura e concreta."
    )


async def gather_context(user: dict) -> str:
    user_id = str(user["_id"])
    week_ago = (now_utc() - timedelta(days=7)).strftime("%Y-%m-%d")
    activities = await db.activities.find(
        {"user_id": user_id, "start_date_local": {"$gte": week_ago}}
    ).to_list(50)
    meals = await db.meals.find(
        {"user_id": user_id, "date": {"$gte": week_ago}, "deleted_at": None}
    ).to_list(100)
    habits = await db.habits.find(
        {"user_id": user_id, "date": {"$gte": week_ago}}
    ).to_list(10)
    average_mood = (
        round(sum(item.get("mood") or 0 for item in habits) / len(habits), 1)
        if habits
        else "sem registro"
    )
    average_sleep = (
        round(sum(item.get("sleep_hours") or 0 for item in habits) / len(habits), 1)
        if habits
        else "sem registro"
    )
    return (
        f"Ultimos 7 dias: {len(activities)} treinos; "
        f"{round(sum((item.get('distance') or 0) for item in activities) / 1000, 1)} km; "
        f"{len(meals)} refeicoes registradas; {len(habits)}/7 check-ins; "
        f"humor medio {average_mood}; sono medio {average_sleep} h."
    )


@router.get("/history")
async def history(user: dict = Depends(current_user)):
    messages = (
        await db.chat_messages.find({"user_id": str(user["_id"])})
        .sort("created_at", 1)
        .to_list(200)
    )
    for message in messages:
        message["id"] = str(message.pop("_id"))
    return {"messages": messages}


@router.post("/chat", dependencies=[Depends(rate_limit("coach", 20, 60))])
async def chat(data: ChatIn, user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    recent = (
        await db.chat_messages.find({"user_id": user_id})
        .sort("created_at", -1)
        .to_list(6)
    )
    recent.reverse()
    history_text = "\n".join(
        f"{message['role']}: {message['content']}" for message in recent
    )
    prompt = f"{await gather_context(user)}\nHistorico:\n{history_text}\nAtleta: {data.message}"
    reply = await complete_text(
        session_id=f"coach-{user_id}",
        system=system_prompt(user.get("name", "atleta")),
        prompt=prompt,
        provider=settings.coach_provider,
        model=settings.coach_model,
    )
    await db.chat_messages.insert_one(
        {"user_id": user_id, "role": "user", "content": data.message, "created_at": now_utc()}
    )
    await db.chat_messages.insert_one(
        {"user_id": user_id, "role": "assistant", "content": reply, "created_at": now_utc()}
    )
    return {"reply": reply}


@router.post(
    "/weekly-report", dependencies=[Depends(rate_limit("ai_job", 5, 300))]
)
async def weekly_report(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    context = await gather_context(user)
    prompt = (
        f"{context}\nCrie um relatorio semanal curto com: veredito, leitura dos numeros e tres acoes seguras."
    )
    report = await complete_text(
        session_id=f"report-{user_id}-{uuid.uuid4()}",
        system=system_prompt(user.get("name", "atleta")),
        prompt=prompt,
        provider=settings.coach_provider,
        model=settings.coach_model,
    )
    await db.weekly_reports.insert_one(
        {"user_id": user_id, "content": report, "context": context, "created_at": now_utc()}
    )
    return {"report": report, "context": context}
