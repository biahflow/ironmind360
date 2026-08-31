from datetime import timedelta
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from app.services.files import storage
from app.data.exercise_catalog import (
    CATALOG_CHANGELOG,
    CATALOG_RELEASED_AT,
    CATALOG_VERSION,
    EXERCISES,
    EXERCISES_BY_ID,
)
from app.adapters.ml import MLClient
from app.data.programs import PROGRAMS, PROGRAMS_BY_ID, WEEK_PARAMS
from app.database import db
from app.dependencies import current_user
from app.models.exercise import CustomSessionIn, LogSetIn, StartSessionIn, TrainingPrefsIn
from app.services.periodization import compute_periodization
from app.services.readiness import compute_readiness
from app.utils.time import now_utc

router = APIRouter(tags=["exercises"])
_ml = MLClient()


async def _safe_ml_risk(user_id: str) -> Optional[dict]:
    """Risco de overtraining (fail-open): None se o serviço ml indisponível."""
    try:
        return await _ml.overtraining_risk(user_id=user_id)
    except Exception:
        return None


# ── Catálogo ──────────────────────────────────────

@router.get("/exercises/catalog")
async def get_catalog(
    pattern: Optional[str] = Query(default=None),
    equipment: Optional[str] = Query(default=None),
    level: Optional[str] = Query(default=None),
    _user: dict = Depends(current_user),
):
    results = EXERCISES
    if pattern:
        results = [e for e in results if e["movement_pattern"] == pattern]
    if equipment:
        results = [e for e in results if equipment in e["equipment"]]
    if level:
        level_order = {"beginner": 0, "intermediate": 1, "advanced": 2}
        max_level = level_order.get(level, 0)
        results = [
            e for e in results
            if level_order.get(e.get("min_level", "beginner"), 0) <= max_level
        ]
    return {
        "version": CATALOG_VERSION,
        "released_at": CATALOG_RELEASED_AT,
        "exercises": results,
        "total": len(results),
    }


@router.get("/exercises/catalog/version")
async def get_catalog_version(_user: dict = Depends(current_user)):
    return {
        "version": CATALOG_VERSION,
        "released_at": CATALOG_RELEASED_AT,
        "changelog": CATALOG_CHANGELOG,
        "total_exercises": len(EXERCISES),
    }


# GIFs do catálogo empacotados no backend (ativo compartilhado, não por-usuário).
_GIF_DIR = Path(__file__).resolve().parent.parent / "data" / "exercise_gifs"


def _catalog_media_key(exercise_id: str) -> str:
    return f"catalog/exercises/{exercise_id}.gif"


@router.get("/exercises/{exercise_id}/media")
async def get_exercise_media(exercise_id: str, _user: dict = Depends(current_user)):
    """Serve o GIF animado do exercício.

    Ativo de catálogo compartilhado (não owner-scoped como /files/{id}): basta
    estar autenticado. Prioriza o GIF empacotado no backend (reproduzível, sem
    dependência de rede); se não houver, tenta o S3/MinIO (enriquecimentos
    recentes ainda não empacotados). Sem mídia → 404 e o app cai no ícone."""
    if exercise_id not in EXERCISES_BY_ID:
        raise HTTPException(404, "Exercício não encontrado")

    bundled = _GIF_DIR / f"{exercise_id}.gif"
    content: Optional[bytes] = None
    if bundled.is_file():
        content = bundled.read_bytes()
    else:
        try:
            content, _ct = await storage.get(_catalog_media_key(exercise_id))
        except Exception as exc:
            raise HTTPException(404, "Mídia do exercício não disponível") from exc

    return Response(
        content=content,
        media_type="image/gif",
        headers={
            # Ativo estático não sensível: pode cachear no cliente.
            "Cache-Control": "public, max-age=604800, immutable",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/exercises/{exercise_id}")
async def get_exercise(exercise_id: str, _user: dict = Depends(current_user)):
    ex = EXERCISES_BY_ID.get(exercise_id)
    if not ex:
        raise HTTPException(404, "Exercício não encontrado")
    return ex


# ── Programas ─────────────────────────────────────

@router.get("/programs")
async def list_programs(_user: dict = Depends(current_user)):
    summaries = []
    for p in PROGRAMS:
        summaries.append({
            "id": p["id"],
            "name": p["name"],
            "level": p["level"],
            "environment": p["environment"],
            "weeks": p["weeks"],
            "sessions_per_week": p["sessions_per_week"],
            "description": p["description"],
        })
    return {"programs": summaries}


@router.get("/programs/{program_id}")
async def get_program(program_id: str, _user: dict = Depends(current_user)):
    program = PROGRAMS_BY_ID.get(program_id)
    if not program:
        raise HTTPException(404, "Programa não encontrado")
    return program


@router.get("/programs/{program_id}/sessions/{session_number}")
async def get_program_session(
    program_id: str,
    session_number: int,
    length: str = Query(default="full"),
    autoregulate: bool = Query(default=False),
    user: dict = Depends(current_user),
):
    program = PROGRAMS_BY_ID.get(program_id)
    if not program:
        raise HTTPException(404, "Programa não encontrado")
    session = next(
        (s for s in program["sessions"] if s["session_number"] == session_number),
        None,
    )
    if not session:
        raise HTTPException(404, "Sessão não encontrada")

    # Personalização por tempo (essential) + interconexão com recuperação e prova.
    session = _trim_session(session, length)
    if autoregulate:
        uid = str(user["_id"])
        # Prova-alvo tem precedência (taper é data-certa); senão, carga do ML.
        race = await _days_to_target_race(uid)
        if race and race["days"] <= 10:
            session = _taper_session(session, race["days"], race.get("name"))
        else:
            risk = await _safe_ml_risk(uid)
            session = _autoregulate(session, (risk or {}).get("risk_level"))

    exercises_enriched = []
    for ex in session["exercises"]:
        catalog_entry = EXERCISES_BY_ID.get(ex["exercise_id"])
        exercises_enriched.append({
            **ex,
            "exercise": catalog_entry,
        })
    return {**session, "exercises": exercises_enriched}


# ── Personalização por tempo disponível ───────────

def _build_session_sequence(days_per_week: int) -> list[int]:
    """Ordem dos session_numbers do programa (1..16, ímpar=A / par=B, semana =
    (n+1)//2) conforme a frequência semanal escolhida pelo atleta.

    - 1x/semana: alterna A/B por semana (8 sessões, ~metade do compromisso).
    - 2x/semana: as 16 sessões nativas (desenho original).
    - 3x/semana: adiciona uma 3ª sessão/semana repetindo o dia A (24 sessões).
    """
    if days_per_week == 1:
        seq = []
        for w in range(1, 9):
            a, b = 2 * w - 1, 2 * w
            seq.append(a if w % 2 == 1 else b)
        return seq
    if days_per_week == 3:
        seq = []
        for w in range(1, 9):
            a, b = 2 * w - 1, 2 * w
            seq += [a, b, a]
        return seq
    return list(range(1, 17))


def _trim_session(session: dict, length: str) -> dict:
    """Versão 'essential' (~20 min): mantém os principais compostos, apara
    aquecimento a 2, remove panturrilha + estabilidade e reduz o desaquecimento
    a 1. 'full' devolve a sessão intacta."""
    if length != "essential":
        return session
    ex = session.get("exercises", [])
    warm = [e for e in ex if e.get("phase") == "warmup"][:2]
    main = [
        e for e in ex
        if e.get("phase") in ("strength", "power")
        and not str(e.get("exercise_id", "")).startswith("calf-")
    ]
    cool = [e for e in ex if e.get("phase") == "cooldown"][:1]
    return {**session, "exercises": warm + main + cool}


def _autoregulate(session: dict, risk_level: Optional[str]) -> dict:
    """Interconexão treino×recuperação: quando o ML sinaliza carga alta/crítica
    de endurance (ACWR/overtraining), reduz o volume de força (–1 série nos
    exercícios de força/estabilidade) para proteger a recuperação. Nunca
    aumenta; nunca diagnostica — só um ajuste de segurança sinalizado."""
    if risk_level not in ("alto", "critico"):
        return session
    adjusted = _reduce_sets(session.get("exercises", []))
    note = (
        "Volume reduzido automaticamente: sua carga de treino está "
        + ("crítica" if risk_level == "critico" else "alta")
        + ". Priorize a recuperação."
    )
    return {**session, "exercises": adjusted, "autoregulated": True, "autoregulation_note": note}


def _reduce_sets(exercises: list[dict]) -> list[dict]:
    """Remove 1 série dos exercícios de força/potência/estabilidade (mín. 1)."""
    out = []
    for e in exercises:
        if e.get("phase") in ("strength", "power", "stability") and isinstance(e.get("sets"), int) and e["sets"] > 1:
            out.append({**e, "sets": e["sets"] - 1})
        else:
            out.append(e)
    return out


def _taper_session(session: dict, days: int, race_name: Optional[str]) -> dict:
    """Interconexão treino×prova: aproxima-se a prova-alvo → afinação (taper).
    ≤3 dias: só aquecimento + soltura (guarda as pernas). 4-10 dias: volume
    reduzido. Reduzir perto da prova é consenso — chega descansado."""
    ex = session.get("exercises", [])
    ref = f" para {race_name}" if race_name else ""
    if days <= 3:
        kept = [e for e in ex if e.get("phase") in ("warmup", "cooldown", "mobility")]
        note = f"Prova{ref} em {days} dia(s): só ative e solte — guarde as pernas para a prova."
        return {**session, "exercises": kept, "autoregulated": True, "autoregulation_note": note}
    note = f"Prova{ref} em {days} dias: fase de afinação (taper) — volume reduzido para chegar descansado."
    return {**session, "exercises": _reduce_sets(ex), "autoregulated": True, "autoregulation_note": note}


async def _days_to_target_race(user_id: str) -> Optional[dict]:
    """Dias até a prova-alvo (prioridade A futura mais próxima; senão a próxima
    futura). None se não houver."""
    today = now_utc().strftime("%Y-%m-%d")
    races = await db.races.find(
        {"user_id": user_id, "deleted_at": None, "date": {"$gte": today}},
        {"date": 1, "priority": 1, "name": 1},
    ).sort("date", 1).to_list(20)
    if not races:
        return None
    target = next((r for r in races if r.get("priority") == "A"), races[0])
    try:
        from datetime import datetime
        target_date = datetime.strptime(target["date"], "%Y-%m-%d").date()
    except (ValueError, KeyError):
        return None
    days = (target_date - now_utc().date()).days
    if days < 0:
        return None
    return {"days": days, "name": target.get("name")}


# ── Plano ativo do atleta ─────────────────────────

@router.get("/training/active")
async def get_active_plan(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    plan = await db.training_plans.find_one(
        {"user_id": user_id, "status": {"$in": ["active", "in_progress"]}},
        sort=[("started_at", -1)],
    )
    if not plan:
        return {"plan": None}
    plan["id"] = str(plan.pop("_id"))
    return {"plan": plan}


@router.post("/training/start")
async def start_program(body: StartSessionIn, user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    program = PROGRAMS_BY_ID.get(body.program_id)
    if not program:
        raise HTTPException(404, "Programa não encontrado")

    existing = await db.training_plans.find_one(
        {"user_id": user_id, "status": {"$in": ["active", "in_progress"]}}
    )
    if existing:
        raise HTTPException(
            409, "Já existe um programa ativo. Finalize ou cancele antes de iniciar outro."
        )

    session_length = body.session_length if body.session_length in ("full", "essential") else "full"
    sequence = _build_session_sequence(body.days_per_week)

    plan = {
        "user_id": user_id,
        "program_id": body.program_id,
        "program_name": program["name"],
        "level": program["level"],
        "environment": program["environment"],
        # Personalização por tempo disponível.
        "days_per_week": body.days_per_week,
        "session_length": session_length,
        "session_sequence": sequence,
        "total_sessions": len(sequence),
        "completed_sessions": 0,
        "current_session": body.session_number,
        "status": "active",
        "started_at": now_utc(),
        "updated_at": now_utc(),
    }
    result = await db.training_plans.insert_one(plan)
    plan["id"] = str(result.inserted_id)
    plan.pop("_id", None)
    return {"plan": plan}


@router.put("/training/preferences")
async def update_training_prefs(body: TrainingPrefsIn, user: dict = Depends(current_user)):
    """Atualiza dias/semana e duração de um plano ATIVO sem reiniciar do zero.
    Recalcula a sequência, ajusta o total e mantém o progresso (limitado ao novo
    tamanho). A mudança de duração reflete já na próxima sessão aberta."""
    user_id = str(user["_id"])
    plan = await db.training_plans.find_one(
        {"user_id": user_id, "status": {"$in": ["active", "in_progress"]}}
    )
    if not plan:
        raise HTTPException(404, "Nenhum programa ativo encontrado")

    session_length = body.session_length if body.session_length in ("full", "essential") else "full"
    sequence = _build_session_sequence(body.days_per_week)
    completed = plan.get("completed_sessions", 0)
    # Mantém o progresso, mas dentro dos limites da nova sequência.
    current = min(max(completed + 1, 1), len(sequence))

    await db.training_plans.update_one(
        {"_id": plan["_id"]},
        {"$set": {
            "days_per_week": body.days_per_week,
            "session_length": session_length,
            "session_sequence": sequence,
            "total_sessions": len(sequence),
            "current_session": current,
            "updated_at": now_utc(),
        }},
    )
    return {
        "updated": True,
        "days_per_week": body.days_per_week,
        "session_length": session_length,
        "total_sessions": len(sequence),
        "current_session": current,
    }


@router.post("/training/cancel")
async def cancel_plan(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    result = await db.training_plans.update_one(
        {"user_id": user_id, "status": {"$in": ["active", "in_progress"]}},
        {"$set": {"status": "cancelled", "updated_at": now_utc()}},
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Nenhum programa ativo encontrado")
    return {"cancelled": True}


@router.post("/training/restart")
async def restart_plan(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    plan = await db.training_plans.find_one(
        {"user_id": user_id, "status": {"$in": ["active", "in_progress"]}}
    )
    if not plan:
        raise HTTPException(404, "Nenhum programa ativo encontrado")

    await db.training_sessions.update_many(
        {"user_id": user_id, "status": "in_progress"},
        {"$set": {"status": "skipped", "updated_at": now_utc()}},
    )

    await db.training_plans.update_one(
        {"_id": plan["_id"]},
        {"$set": {
            "current_session": 1,
            "completed_sessions": 0,
            "status": "active",
            "restarted_at": now_utc(),
            "updated_at": now_utc(),
        }},
    )
    return {
        "restarted": True,
        "program_id": plan["program_id"],
        "program_name": plan.get("program_name"),
    }


# ── Sessões de treino ─────────────────────────────

@router.post("/training/custom/start")
async def start_custom_session(body: CustomSessionIn, user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    existing = await db.training_sessions.find_one(
        {"user_id": user_id, "status": "in_progress"}
    )
    if existing:
        raise HTTPException(
            409, "Você já tem uma sessão em andamento. Finalize-a antes de iniciar outra."
        )

    prescription = []
    for item in body.items:
        catalog_entry = EXERCISES_BY_ID.get(item.exercise_id)
        if not catalog_entry:
            raise HTTPException(400, f"Exercício inválido: {item.exercise_id}")
        prescription.append({
            "exercise_id": item.exercise_id,
            "phase": "strength",
            "sets": item.sets,
            "reps": item.reps,
            "duration_seconds": None,
            "rest_seconds": item.rest_seconds,
            "rpe_target": None,
            "tempo": None,
            "notes": None,
            "exercise": catalog_entry,
        })

    now = now_utc()
    session_doc = {
        "user_id": user_id,
        "custom": True,
        "plan_id": None,
        "program_id": None,
        "session_number": 0,
        "week": 0,
        "day": "-",
        "title": body.title.strip() or "Meu treino",
        "is_deload": False,
        "prescription": prescription,
        "exercises": [],
        "status": "in_progress",
        "started_at": now,
        "updated_at": now,
    }
    result = await db.training_sessions.insert_one(session_doc)
    session_doc["id"] = str(result.inserted_id)
    session_doc.pop("_id", None)
    return {"session": session_doc, "resumed": False}


@router.post("/training/sessions/start")
async def start_session(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    existing = await db.training_sessions.find_one(
        {"user_id": user_id, "status": "in_progress"}
    )
    if existing:
        existing["id"] = str(existing.pop("_id"))
        return {"session": existing, "resumed": True}

    plan = await db.training_plans.find_one(
        {"user_id": user_id, "status": {"$in": ["active", "in_progress"]}}
    )
    if not plan:
        raise HTTPException(404, "Nenhum programa ativo encontrado")

    program = PROGRAMS_BY_ID.get(plan["program_id"])
    if not program:
        raise HTTPException(500, "Programa do plano não encontrado no catálogo")

    # Mapeia current_session (índice na sequência personalizada) → session_number
    # do programa. Planos antigos sem sequência usam o índice direto.
    sequence = plan.get("session_sequence")
    idx = plan.get("current_session", 1)
    if sequence:
        if idx < 1 or idx > len(sequence):
            raise HTTPException(400, "Programa concluído — todas as sessões foram realizadas")
        target_number = sequence[idx - 1]
    else:
        target_number = idx

    session_def = next(
        (s for s in program["sessions"] if s["session_number"] == target_number),
        None,
    )
    if not session_def:
        raise HTTPException(400, "Programa concluído — todas as sessões foram realizadas")

    session_doc = {
        "user_id": user_id,
        "plan_id": str(plan["_id"]),
        "program_id": plan["program_id"],
        # session_number aponta para o conteúdo do programa (usado pelo app para
        # buscar a prescrição); seq_index é a posição na jornada personalizada.
        "session_number": session_def["session_number"],
        "seq_index": idx,
        "session_length": plan.get("session_length", "full"),
        "week": session_def["week"],
        "day": session_def["day"],
        "title": session_def["title"],
        "is_deload": session_def.get("is_deload", False),
        "exercises": [],
        "status": "in_progress",
        "started_at": now_utc(),
        "updated_at": now_utc(),
    }
    result = await db.training_sessions.insert_one(session_doc)
    session_doc["id"] = str(result.inserted_id)
    session_doc.pop("_id", None)

    await db.training_plans.update_one(
        {"_id": plan["_id"]},
        {"$set": {"status": "in_progress", "updated_at": now_utc()}},
    )

    return {"session": session_doc, "resumed": False}


@router.post("/training/sessions/log-set")
async def log_set(body: LogSetIn, user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    session = await db.training_sessions.find_one(
        {"user_id": user_id, "status": "in_progress"}
    )
    if not session:
        raise HTTPException(404, "Nenhuma sessão em andamento")

    set_data = {
        "set_number": body.set_number,
        "reps": body.reps,
        "weight_kg": body.weight_kg,
        "duration_seconds": body.duration_seconds,
        "rpe": body.rpe,
        "pain": body.pain,
        "notes": body.notes,
        "completed": body.completed,
        "logged_at": now_utc(),
    }

    exercises = session.get("exercises", [])
    ex_entry = next((e for e in exercises if e["exercise_id"] == body.exercise_id), None)

    if ex_entry:
        existing_set = next(
            (s for s in ex_entry["sets"] if s["set_number"] == body.set_number),
            None,
        )
        if existing_set:
            ex_entry["sets"] = [
                set_data if s["set_number"] == body.set_number else s
                for s in ex_entry["sets"]
            ]
        else:
            ex_entry["sets"].append(set_data)
            ex_entry["sets"].sort(key=lambda s: s["set_number"])
    else:
        exercises.append({
            "exercise_id": body.exercise_id,
            "sets": [set_data],
        })

    await db.training_sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {"exercises": exercises, "updated_at": now_utc()}},
    )

    return {"logged": True, "exercise_id": body.exercise_id, "set_number": body.set_number}


@router.post("/training/sessions/complete")
async def complete_session(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    session = await db.training_sessions.find_one(
        {"user_id": user_id, "status": "in_progress"}
    )
    if not session:
        raise HTTPException(404, "Nenhuma sessão em andamento")

    await db.training_sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {"status": "completed", "completed_at": now_utc(), "updated_at": now_utc()}},
    )

    plan = None
    if not session.get("custom"):
        plan = await db.training_plans.find_one({"_id": session.get("plan_id")})
        if not plan:
            plan = await db.training_plans.find_one(
                {"user_id": user_id, "status": "in_progress"}
            )

    if plan:
        completed = plan.get("completed_sessions", 0) + 1
        next_session = plan.get("current_session", 1) + 1
        total = plan.get("total_sessions", 16)
        updates: dict = {
            "completed_sessions": completed,
            "current_session": next_session,
            "updated_at": now_utc(),
        }
        if completed >= total:
            updates["status"] = "completed"
            updates["completed_at"] = now_utc()
        else:
            updates["status"] = "active"

        await db.training_plans.update_one({"_id": plan["_id"]}, {"$set": updates})

    duration = None
    started = session.get("started_at")
    if started:
        now = now_utc()
        if started.tzinfo is None:
            from datetime import timezone
            started = started.replace(tzinfo=timezone.utc)
        duration = int((now - started).total_seconds())

    return {
        "completed": True,
        "session_number": session["session_number"],
        "duration_seconds": duration,
    }


@router.post("/training/sessions/skip")
async def skip_session(user: dict = Depends(current_user)):
    user_id = str(user["_id"])

    in_progress = await db.training_sessions.find_one(
        {"user_id": user_id, "status": "in_progress"}
    )
    if in_progress:
        await db.training_sessions.update_one(
            {"_id": in_progress["_id"]},
            {"$set": {"status": "skipped", "updated_at": now_utc()}},
        )

    plan = await db.training_plans.find_one(
        {"user_id": user_id, "status": {"$in": ["active", "in_progress"]}}
    )
    if not plan:
        raise HTTPException(404, "Nenhum programa ativo encontrado")

    next_session = plan.get("current_session", 1) + 1
    total = plan.get("total_sessions", 16)
    updates: dict = {"current_session": next_session, "updated_at": now_utc()}
    if next_session > total:
        updates["status"] = "completed"
        updates["completed_at"] = now_utc()
    else:
        updates["status"] = "active"

    await db.training_plans.update_one({"_id": plan["_id"]}, {"$set": updates})
    return {"skipped": True, "next_session": min(next_session, total)}


# ── Histórico ─────────────────────────────────────

@router.get("/training/history")
async def training_history(
    limit: int = Query(default=20, ge=1, le=100),
    user: dict = Depends(current_user),
):
    user_id = str(user["_id"])
    sessions = (
        await db.training_sessions.find(
            {"user_id": user_id, "status": {"$in": ["completed", "skipped"]}}
        )
        .sort("completed_at", -1)
        .to_list(limit)
    )
    for s in sessions:
        s["id"] = str(s.pop("_id"))
    return {"sessions": sessions, "source": "ironmind"}


# ── Periodização inteligente ─────────────────────

@router.get("/training/periodization")
async def get_periodization(user: dict = Depends(current_user)):
    user_id = str(user["_id"])

    plan = await db.training_plans.find_one(
        {"user_id": user_id, "status": {"$in": ["active", "in_progress"]}},
        sort=[("started_at", -1)],
    )

    today_str = now_utc().strftime("%Y-%m-%d")

    readiness: dict | None = None
    habit = await db.habits.find_one(
        {"user_id": user_id, "date": today_str},
    )
    if habit:
        pain_logs = await db.pain_logs.find(
            {"user_id": user_id, "date": today_str},
        ).to_list(10)
        pain_entries = []
        for p in pain_logs:
            pain_entries.extend(p.get("entries", []))
        readiness = compute_readiness(habit, pain_entries)

    races = await db.races.find(
        {"user_id": user_id, "deleted_at": None, "date": {"$gte": today_str}},
    ).sort("date", 1).to_list(50)

    since = (now_utc() - timedelta(days=7)).strftime("%Y-%m-%d")
    load_pipeline = [
        {"$match": {"user_id": user_id, "start_date_local": {"$gte": since}}},
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$icu_training_load", 0]}}}},
    ]
    load_cursor = await db.activities.aggregate(load_pipeline)
    load_result = await load_cursor.to_list(1)
    training_load_7d = load_result[0]["total"] if load_result else 0.0

    plan_dict = None
    if plan:
        plan_dict = {
            "program_id": plan["program_id"],
            "current_session": plan.get("current_session", 1),
            "level": plan.get("level"),
            "environment": plan.get("environment"),
        }

    periodization = compute_periodization(plan_dict, readiness, races, training_load_7d)

    adjusted_session = None
    if plan_dict:
        program = PROGRAMS_BY_ID.get(plan_dict["program_id"])
        if program:
            session_def = next(
                (s for s in program["sessions"]
                 if s["session_number"] == plan_dict["current_session"]),
                None,
            )
            if session_def:
                week = session_def["week"]
                wp = WEEK_PARAMS.get(week, {"sets": 3, "rpe": 7})
                original_sets = wp["sets"]
                original_rpe = wp["rpe"]

                vm = periodization["volume_multiplier"]
                ia = periodization["intensity_adjustment"]

                adjusted_sets = max(1, round(original_sets * vm))
                adjusted_rpe = max(1, min(10, original_rpe + ia))

                is_deload = session_def.get("is_deload", False) or periodization["force_deload"]

                adjusted_session = {
                    "session_number": session_def["session_number"],
                    "week": week,
                    "day": session_def["day"],
                    "title": session_def["title"],
                    "original_sets": original_sets,
                    "adjusted_sets": adjusted_sets,
                    "original_rpe": original_rpe,
                    "adjusted_rpe": adjusted_rpe,
                    "is_deload": is_deload,
                }

    return {
        "periodization": periodization,
        "adjusted_session": adjusted_session,
        "readiness": readiness,
    }
