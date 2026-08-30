import uuid
from datetime import timedelta
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query

from app.adapters.ai import complete_text
from app.config import settings
from app.database import db
from app.dependencies import current_user
from app.models.coach import (
    BreathingSessionIn,
    ChatIn,
    ConversationCreateIn,
    DiaryEntryIn,
    ReflectionIn,
)
from app.rate_limit import rate_limit
from app.utils.time import now_utc

router = APIRouter(prefix="/coach", tags=["coach"])


# ---------------------------------------------------------------------------
# Tons e prompts de sistema
# ---------------------------------------------------------------------------

SAFETY_POLICY = (
    "REGRAS INVIOLAVEIS: "
    "1) Nunca diagnostique doencas, lesoes ou condicoes clinicas. "
    "2) Nunca prescreva, inicie ou suspenda medicamentos. "
    "3) Nunca altere automaticamente treino, dieta ou suplemento. "
    "4) Nunca se apresente como terapeuta, psicologo ou medico. "
    "5) Nunca use dados que nao foram fornecidos — nao invente informacoes. "
    "6) Se o atleta relatar ideacao suicida, autolesao ou crise emocional grave, "
    "responda com acolhimento imediato, informe o CVV (ligue 188 ou chat cvv.org.br, 24h), "
    "SAMU (192) e incentive buscar ajuda profissional humana. "
    "Nao tente resolver a crise — acolha e direcione. "
    "7) Ao fazer recomendacoes relevantes, cite brevemente quais dados sustentaram a sugestao."
)

TONE_PROMPTS = {
    "direct": (
        "Voce e o Comandante, coach esportivo de {name}. "
        "Tom direto e firme: va ao ponto, cobre resultado, nao aceite desculpa facil. "
        "Mas nunca humilhe, ridicularize ou use linguagem abusiva. "
        "Fale em portugues do Brasil."
    ),
    "balanced": (
        "Voce e o Comandante, coach esportivo de {name}. "
        "Tom equilibrado: combine orientacao tecnica com encorajamento. "
        "Reconheca o esforco antes de cobrar melhoria. "
        "Fale em portugues do Brasil."
    ),
    "supportive": (
        "Voce e o Comandante, coach esportivo de {name}. "
        "Tom acolhedor: priorize empatia, celebre cada conquista. "
        "Ofereça sugestoes gentis sem pressao excessiva. "
        "Fale em portugues do Brasil."
    ),
}


def system_prompt(user_name: str, tone: str = "balanced") -> str:
    base = TONE_PROMPTS.get(tone, TONE_PROMPTS["balanced"])
    return base.format(name=user_name) + " " + SAFETY_POLICY


# ---------------------------------------------------------------------------
# Contexto enriquecido
# ---------------------------------------------------------------------------

async def gather_context(user: dict) -> dict:
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

    def avg(key: str) -> float | None:
        if not habits:
            return None
        return round(sum(h.get(key) or 0 for h in habits) / len(habits), 1)

    profile = await db.profiles.find_one({"user_id": user_id})
    upcoming_race = await db.races.find_one(
        {"user_id": user_id, "deleted_at": None, "date": {"$gte": now_utc().strftime("%Y-%m-%d")}},
        sort=[("date", 1)],
    )

    health_alerts = await db.health_markers.find(
        {"user_id": user_id, "deleted_at": None,
         "flag": {"$in": ["baixo", "alto", "critico_baixo", "critico_alto"]}}
    ).sort("date", -1).to_list(5)

    context_parts = [
        f"Ultimos 7 dias: {len(activities)} treinos",
        f"{round(sum((a.get('distance') or 0) for a in activities) / 1000, 1)} km",
        f"{len(meals)} refeicoes registradas",
        f"{len(habits)}/7 check-ins",
    ]

    mood = avg("mood")
    sleep = avg("sleep_hours")
    fatigue = avg("fatigue")
    energy = avg("energy")
    stress = avg("stress")

    if mood is not None:
        context_parts.append(f"humor medio {mood}/5")
    if sleep is not None:
        context_parts.append(f"sono medio {sleep}h")
    if fatigue is not None:
        context_parts.append(f"fadiga media {fatigue}/5")
    if energy is not None:
        context_parts.append(f"energia media {energy}/5")
    if stress is not None:
        context_parts.append(f"estresse medio {stress}/5")

    weekly_tss = round(sum(a.get("icu_training_load") or 0 for a in activities))
    if weekly_tss:
        context_parts.append(f"carga semanal ~{weekly_tss} TSS")

    weight = None
    async for h in db.habits.find(
        {"user_id": user_id, "weight_kg": {"$ne": None}}, {"weight_kg": 1}
    ).sort("date", -1).limit(1):
        weight = h.get("weight_kg")
    if weight:
        context_parts.append(f"peso atual {weight}kg")

    sport = (profile or {}).get("sport") or {}
    disciplines = sport.get("disciplines") or []
    if disciplines:
        d = set(disciplines)
        modality = (
            "triatlo" if {"swim", "bike", "run"}.issubset(d)
            else "corrida" if disciplines == ["run"]
            else "+".join(sorted(d))
        )
        context_parts.append(f"modalidade {modality}")
    if sport.get("experience"):
        context_parts.append(f"experiencia {sport['experience']}")

    plan_doc = await db.nutrition_plans.find_one({"user_id": user_id})
    if plan_doc and plan_doc.get("plan"):
        context_parts.append(
            f"plano nutricional ~{plan_doc['plan'].get('daily_calories')} kcal/dia"
        )

    if upcoming_race:
        context_parts.append(
            f"proxima prova: {upcoming_race.get('name', upcoming_race.get('race_type'))} "
            f"em {upcoming_race.get('date')}"
        )

    if health_alerts:
        alert_strs = [f"{a.get('name')}: {a.get('value')}{a.get('unit', '')}" for a in health_alerts[:3]]
        context_parts.append(f"alertas de saude: {', '.join(alert_strs)}")

    sources = []
    if activities:
        sources.append("atividades")
    if meals:
        sources.append("refeicoes")
    if habits:
        sources.append("check-ins")
    if profile:
        sources.append("perfil")
    if upcoming_race:
        sources.append("calendario")
    if health_alerts:
        sources.append("exames")
    if weight:
        sources.append("peso")
    if plan_doc and plan_doc.get("plan"):
        sources.append("plano nutricional")

    text = "; ".join(context_parts) + "."
    return {"text": text, "sources": sources}


# ---------------------------------------------------------------------------
# Protocolo de crise
# ---------------------------------------------------------------------------

CRISIS_KEYWORDS = [
    "suicid", "me matar", "quero morrer", "nao aguento mais",
    "acabar com tudo", "autolesao", "me machucar", "nao quero mais viver",
]

CRISIS_RESPONSE = (
    "Eu ouço você e levo isso muito a sério. Você não está sozinho(a). "
    "Por favor, entre em contato agora:\n\n"
    "📞 **CVV – Centro de Valorização da Vida**: ligue 188 (24h) ou acesse chat.cvv.org.br\n"
    "📞 **SAMU**: ligue 192\n"
    "📞 **Bombeiros**: ligue 193\n\n"
    "Essas pessoas estão preparadas para ajudar. "
    "Eu sou um coach esportivo e não tenho preparo para lidar com crises emocionais — "
    "mas me importo com você e quero que busque ajuda humana especializada agora."
)


def detect_crisis(text: str) -> bool:
    lower = text.lower()
    return any(kw in lower for kw in CRISIS_KEYWORDS)


# ---------------------------------------------------------------------------
# Conversas
# ---------------------------------------------------------------------------

@router.post("/conversations")
async def create_conversation(
    data: ConversationCreateIn = ConversationCreateIn(),
    user: dict = Depends(current_user),
):
    now = now_utc()
    doc = {
        "user_id": str(user["_id"]),
        "title": data.title or "Nova conversa",
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
        "message_count": 0,
    }
    result = await db.coach_conversations.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@router.get("/conversations")
async def list_conversations(user: dict = Depends(current_user)):
    docs = await db.coach_conversations.find(
        {"user_id": str(user["_id"]), "deleted_at": None}
    ).sort("updated_at", -1).to_list(50)
    for d in docs:
        d["id"] = str(d.pop("_id"))
    return {"conversations": docs}


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    try:
        oid = ObjectId(conversation_id)
    except Exception:
        raise HTTPException(404, "Conversa nao encontrada")
    result = await db.coach_conversations.update_one(
        {"_id": oid, "user_id": user_id, "deleted_at": None},
        {"$set": {"deleted_at": now_utc()}},
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Conversa nao encontrada")
    await db.chat_messages.update_many(
        {"conversation_id": conversation_id, "user_id": user_id},
        {"$set": {"deleted_at": now_utc()}},
    )
    return {"ok": True}


@router.delete("/conversations")
async def clear_all_conversations(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    now = now_utc()
    await db.coach_conversations.update_many(
        {"user_id": user_id, "deleted_at": None},
        {"$set": {"deleted_at": now}},
    )
    await db.chat_messages.update_many(
        {"user_id": user_id, "deleted_at": None},
        {"$set": {"deleted_at": now}},
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Chat (mensagens dentro de uma conversa)
# ---------------------------------------------------------------------------

@router.get("/history")
async def history(
    conversation_id: Optional[str] = Query(None),
    user: dict = Depends(current_user),
):
    query: dict = {"user_id": str(user["_id"]), "deleted_at": None}
    if conversation_id:
        query["conversation_id"] = conversation_id
    messages = await db.chat_messages.find(query).sort("created_at", 1).to_list(200)
    for m in messages:
        m["id"] = str(m.pop("_id"))
    return {"messages": messages}


@router.post("/chat", dependencies=[Depends(rate_limit("coach", 20, 60))])
async def chat(data: ChatIn, user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    tone = user.get("coach_tone", "balanced")
    now = now_utc()

    conversation_id = data.conversation_id
    if not conversation_id:
        conv = await create_conversation(ConversationCreateIn(), user)
        conversation_id = conv["id"]

    if detect_crisis(data.message):
        user_doc = {
            "user_id": user_id, "conversation_id": conversation_id,
            "role": "user", "content": data.message,
            "created_at": now, "deleted_at": None,
        }
        assistant_doc: dict = {
            "user_id": user_id, "conversation_id": conversation_id,
            "role": "assistant", "content": CRISIS_RESPONSE,
            "created_at": now, "deleted_at": None,
            "sources": [], "crisis": True,
        }
        await db.chat_messages.insert_many([user_doc, assistant_doc])
        await db.coach_conversations.update_one(
            {"_id": ObjectId(conversation_id)},
            {"$set": {"updated_at": now}, "$inc": {"message_count": 2}},
        )
        return {
            "reply": CRISIS_RESPONSE,
            "conversation_id": conversation_id,
            "sources": [],
            "crisis": True,
        }

    recent = await db.chat_messages.find(
        {"user_id": user_id, "conversation_id": conversation_id, "deleted_at": None}
    ).sort("created_at", -1).to_list(10)
    recent.reverse()
    history_text = "\n".join(
        f"{m['role']}: {m['content']}" for m in recent
    )

    ctx = await gather_context(user)
    prompt = f"{ctx['text']}\nHistorico:\n{history_text}\nAtleta: {data.message}"

    reply = await complete_text(
        session_id=f"coach-{user_id}-{conversation_id}",
        system=system_prompt(user.get("name", "atleta"), tone),
        prompt=prompt,
        provider=settings.coach_provider,
        model=settings.coach_model,
    )

    user_doc = {
        "user_id": user_id, "conversation_id": conversation_id,
        "role": "user", "content": data.message,
        "created_at": now, "deleted_at": None,
    }
    assistant_doc = {
        "user_id": user_id, "conversation_id": conversation_id,
        "role": "assistant", "content": reply,
        "created_at": now, "deleted_at": None,
        "sources": ctx["sources"],
    }
    await db.chat_messages.insert_many([user_doc, assistant_doc])
    await db.coach_conversations.update_one(
        {"_id": ObjectId(conversation_id)},
        {"$set": {"updated_at": now, "title_auto": data.message[:80]}, "$inc": {"message_count": 2}},
    )

    return {
        "reply": reply,
        "conversation_id": conversation_id,
        "sources": ctx["sources"],
    }


# ---------------------------------------------------------------------------
# Relatórios semanais
# ---------------------------------------------------------------------------

@router.post("/weekly-report", dependencies=[Depends(rate_limit("ai_job", 5, 300))])
async def weekly_report(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    tone = user.get("coach_tone", "balanced")
    ctx = await gather_context(user)

    prompt = (
        f"{ctx['text']}\n"
        "Crie um relatorio semanal estruturado com:\n"
        "1. Veredito geral (1 frase)\n"
        "2. Leitura dos numeros com dados de origem\n"
        "3. Tres acoes seguras e concretas para a proxima semana\n"
        "Formate as acoes como itens numerados claros."
    )
    report = await complete_text(
        session_id=f"report-{user_id}-{uuid.uuid4()}",
        system=system_prompt(user.get("name", "atleta"), tone),
        prompt=prompt,
        provider=settings.coach_provider,
        model=settings.coach_model,
    )

    actions = _extract_actions(report)

    doc = {
        "user_id": user_id,
        "content": report,
        "context": ctx["text"],
        "sources": ctx["sources"],
        "actions": actions,
        "created_at": now_utc(),
    }
    result = await db.weekly_reports.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


def _extract_actions(report_text: str) -> list[dict]:
    actions = []
    for line in report_text.split("\n"):
        stripped = line.strip()
        if stripped and len(stripped) > 3 and stripped[0].isdigit() and stripped[1] in ".)" :
            actions.append({
                "text": stripped[2:].strip().lstrip(". "),
                "completed": False,
            })
    return actions[:5]


@router.get("/reports")
async def list_reports(
    limit: int = Query(10, ge=1, le=50),
    user: dict = Depends(current_user),
):
    docs = await db.weekly_reports.find(
        {"user_id": str(user["_id"])}
    ).sort("created_at", -1).to_list(limit)
    for d in docs:
        d["id"] = str(d.pop("_id"))
    return {"reports": docs}


@router.put("/reports/{report_id}/actions/{action_index}")
async def toggle_action(
    report_id: str, action_index: int, user: dict = Depends(current_user),
):
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(404, "Relatorio nao encontrado")
    doc = await db.weekly_reports.find_one(
        {"_id": oid, "user_id": str(user["_id"])}
    )
    if not doc:
        raise HTTPException(404, "Relatorio nao encontrado")
    actions = doc.get("actions", [])
    if action_index < 0 or action_index >= len(actions):
        raise HTTPException(400, "Indice de acao invalido")
    actions[action_index]["completed"] = not actions[action_index]["completed"]
    await db.weekly_reports.update_one(
        {"_id": oid}, {"$set": {"actions": actions}}
    )
    return {"actions": actions}


# ---------------------------------------------------------------------------
# Bem-estar: diário
# ---------------------------------------------------------------------------

@router.post("/diary")
async def create_diary_entry(data: DiaryEntryIn, user: dict = Depends(current_user)):
    doc = {
        "user_id": str(user["_id"]),
        "content": data.content,
        "mood": data.mood,
        "tags": data.tags,
        "created_at": now_utc(),
        "deleted_at": None,
    }
    result = await db.diary_entries.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@router.get("/diary")
async def list_diary(
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_user),
):
    docs = await db.diary_entries.find(
        {"user_id": str(user["_id"]), "deleted_at": None}
    ).sort("created_at", -1).to_list(limit)
    for d in docs:
        d["id"] = str(d.pop("_id"))
    return {"entries": docs}


@router.delete("/diary/{entry_id}")
async def delete_diary_entry(entry_id: str, user: dict = Depends(current_user)):
    try:
        oid = ObjectId(entry_id)
    except Exception:
        raise HTTPException(404, "Entrada nao encontrada")
    result = await db.diary_entries.update_one(
        {"_id": oid, "user_id": str(user["_id"]), "deleted_at": None},
        {"$set": {"deleted_at": now_utc()}},
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Entrada nao encontrada")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Bem-estar: respiração guiada
# ---------------------------------------------------------------------------

BREATHING_TECHNIQUES = [
    {
        "key": "box_breathing",
        "name": "Respiração quadrada",
        "description": "Inspire 4s, segure 4s, expire 4s, segure 4s. Repita.",
        "inhale_s": 4, "hold_in_s": 4, "exhale_s": 4, "hold_out_s": 4,
        "recommended_minutes": 5,
    },
    {
        "key": "4_7_8",
        "name": "Técnica 4-7-8",
        "description": "Inspire 4s, segure 7s, expire 8s. Relaxamento profundo.",
        "inhale_s": 4, "hold_in_s": 7, "exhale_s": 8, "hold_out_s": 0,
        "recommended_minutes": 5,
    },
    {
        "key": "physiological_sigh",
        "name": "Suspiro fisiológico",
        "description": "Duas inspirações curtas pelo nariz + uma expiração longa pela boca. Rápido alívio.",
        "inhale_s": 2, "hold_in_s": 0, "exhale_s": 6, "hold_out_s": 0,
        "recommended_minutes": 3,
    },
]


@router.get("/breathing/techniques")
async def list_breathing_techniques():
    return {"techniques": BREATHING_TECHNIQUES}


@router.post("/breathing/log")
async def log_breathing(data: BreathingSessionIn, user: dict = Depends(current_user)):
    doc = {
        "user_id": str(user["_id"]),
        "technique": data.technique,
        "duration_seconds": data.duration_seconds,
        "completed": data.completed,
        "created_at": now_utc(),
    }
    result = await db.breathing_sessions.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@router.get("/breathing/history")
async def breathing_history(
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_user),
):
    docs = await db.breathing_sessions.find(
        {"user_id": str(user["_id"])}
    ).sort("created_at", -1).to_list(limit)
    for d in docs:
        d["id"] = str(d.pop("_id"))
    return {"sessions": docs}


# ---------------------------------------------------------------------------
# Bem-estar: reflexões guiadas
# ---------------------------------------------------------------------------

REFLECTION_PROMPTS = [
    {"key": "gratitude", "text": "Cite três coisas pelas quais você é grato(a) hoje."},
    {"key": "energy", "text": "O que te deu energia esta semana? O que drenou?"},
    {"key": "progress", "text": "Qual foi sua maior conquista recente no esporte?"},
    {"key": "obstacle", "text": "Qual obstáculo você está enfrentando e o que pode tentar diferente?"},
    {"key": "intention", "text": "Qual é sua intenção principal para amanhã?"},
    {"key": "recovery", "text": "Como você cuidou do seu corpo e mente nos últimos dias?"},
]


@router.get("/reflections/prompts")
async def list_reflection_prompts():
    return {"prompts": REFLECTION_PROMPTS}


@router.post("/reflections")
async def create_reflection(data: ReflectionIn, user: dict = Depends(current_user)):
    prompt = next((p for p in REFLECTION_PROMPTS if p["key"] == data.prompt_key), None)
    doc = {
        "user_id": str(user["_id"]),
        "prompt_key": data.prompt_key,
        "prompt_text": prompt["text"] if prompt else data.prompt_key,
        "response": data.response,
        "created_at": now_utc(),
        "deleted_at": None,
    }
    result = await db.reflections.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@router.get("/reflections")
async def list_reflections(
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_user),
):
    docs = await db.reflections.find(
        {"user_id": str(user["_id"]), "deleted_at": None}
    ).sort("created_at", -1).to_list(limit)
    for d in docs:
        d["id"] = str(d.pop("_id"))
    return {"reflections": docs}


@router.delete("/reflections/{reflection_id}")
async def delete_reflection(reflection_id: str, user: dict = Depends(current_user)):
    try:
        oid = ObjectId(reflection_id)
    except Exception:
        raise HTTPException(404, "Reflexao nao encontrada")
    result = await db.reflections.update_one(
        {"_id": oid, "user_id": str(user["_id"]), "deleted_at": None},
        {"$set": {"deleted_at": now_utc()}},
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Reflexao nao encontrada")
    return {"ok": True}
