from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query

from collections import Counter

from app.database import db
from app.dependencies import current_user
from app.models.gi_training import GISessionLogIn, GITrainingPlanIn
from app.models.supplements import FuelingLogIn, SupplementLogIn, SweatTestIn
from app.utils.time import now_utc, today_str

router = APIRouter(prefix="/fueling", tags=["fueling"])

SUPPLEMENT_CATALOG_V1: list[dict[str, Any]] = [
    {
        "name": "Whey Protein",
        "category": "protein",
        "evidence_level": "strong",
        "purpose": "Completar meta proteica diária",
        "form": "Pó",
        "dose_min": "20g por dose",
        "dose_max": "40g por dose (ou 0.25-0.40 g/kg)",
        "timing": "Pós-treino ou entre refeições",
        "contraindications": ["Alergia a leite"],
        "requires_professional": False,
        "source": "ISSN Position Stand (2017)",
        "version": "1.0.0",
    },
    {
        "name": "Cafeína",
        "category": "caffeine",
        "evidence_level": "strong",
        "purpose": "Melhora de performance em endurance e força",
        "form": "Cápsula ou gel",
        "dose_min": "1 mg/kg (teste inicial)",
        "dose_max": "3 mg/kg (máx. automático); 3-6 mg/kg com nutricionista",
        "timing": "30-60 min antes do exercício",
        "contraindications": ["Ansiedade", "Arritmia", "Gestação", "Insônia severa"],
        "requires_professional": True,
        "source": "ISSN Position Stand (2021), IOC Consensus (2018)",
        "version": "1.0.0",
    },
    {
        "name": "Creatina monoidratada",
        "category": "creatine",
        "evidence_level": "strong",
        "purpose": "Aumento de força, potência e recuperação",
        "form": "Pó (monoidratada)",
        "dose_min": "3g/dia",
        "dose_max": "5g/dia (manutenção, sem carga obrigatória)",
        "timing": "Qualquer horário, com refeição",
        "contraindications": ["Doença renal pré-existente"],
        "requires_professional": False,
        "source": "ISSN Position Stand (2017), IOC Consensus (2018)",
        "version": "1.0.0",
    },
    {
        "name": "Nitrato (beterraba)",
        "category": "nitrate",
        "evidence_level": "moderate",
        "purpose": "Melhora da eficiência de oxigênio em endurance",
        "form": "Suco concentrado de beterraba",
        "dose_min": "5 mmol",
        "dose_max": "9 mmol",
        "timing": "2-3h antes do exercício; protocolo de dias com teste prévio",
        "contraindications": ["Hipotensão"],
        "requires_professional": True,
        "source": "IOC Consensus (2018)",
        "version": "1.0.0",
    },
    {
        "name": "Beta-alanina",
        "category": "beta_alanine",
        "evidence_level": "moderate",
        "purpose": "Buffer de acidose muscular em esforços de 1-10 min",
        "form": "Cápsula ou pó",
        "dose_min": "3.2g/dia divididos",
        "dose_max": "6.4g/dia divididos (protocolo de semanas)",
        "timing": "Dividido em 2-4 doses ao dia, com refeição",
        "contraindications": ["Parestesia intensa (ajustar dose)"],
        "requires_professional": False,
        "source": "ISSN Position Stand (2015)",
        "version": "1.0.0",
    },
    {
        "name": "Bicarbonato de sódio",
        "category": "bicarbonate",
        "evidence_level": "moderate",
        "purpose": "Buffer de acidose em esforços de alta intensidade",
        "form": "Pó ou cápsula",
        "dose_min": "0.2 g/kg",
        "dose_max": "0.3 g/kg (supervisionado)",
        "timing": "60-180 min antes do exercício, com teste GI prévio",
        "contraindications": ["Hipertensão", "Problemas gastrointestinais"],
        "requires_professional": True,
        "source": "IOC Consensus (2018)",
        "version": "1.0.0",
    },
    {
        "name": "Vitamina D",
        "category": "vitamin",
        "evidence_level": "moderate",
        "purpose": "Saúde óssea e função imune",
        "form": "Cápsula ou gotas",
        "dose_min": "Conforme avaliação profissional",
        "dose_max": "Conforme avaliação profissional",
        "timing": "Com refeição gordurosa",
        "contraindications": [],
        "requires_professional": True,
        "source": "IOC Consensus (2018)",
        "version": "1.0.0",
    },
    {
        "name": "Ferro",
        "category": "iron",
        "evidence_level": "strong",
        "purpose": "Correção de deficiência comprovada em exames",
        "form": "Comprimido ou intravenoso",
        "dose_min": "Conforme avaliação profissional",
        "dose_max": "Conforme avaliação profissional",
        "timing": "Em jejum ou conforme orientação",
        "contraindications": ["Hemocromatose"],
        "requires_professional": True,
        "source": "IOC Consensus (2018), ACSM",
        "version": "1.0.0",
    },
]


@router.get("/supplement-catalog")
async def get_supplement_catalog(user: dict = Depends(current_user)):
    return {"catalog": SUPPLEMENT_CATALOG_V1, "version": "1.0.0"}


# ── Supplement log ──────────────────────────────────────────────


@router.post("/supplements")
async def log_supplement(
    data: SupplementLogIn,
    user: dict = Depends(current_user),
):
    user_id = str(user["_id"])

    catalog_entry = next(
        (s for s in SUPPLEMENT_CATALOG_V1 if str(s["name"]).lower() == data.supplement_name.lower()),
        None,
    )

    if catalog_entry and catalog_entry.get("requires_professional"):
        profile = await db.profiles.find_one({"user_id": user_id})
        allergies: list[str] = []
        if profile and profile.get("nutrition_profile"):
            allergies = profile["nutrition_profile"].get("allergies", [])
        contras = [str(c) for c in (catalog_entry.get("contraindications") or [])]
        for contra in contras:
            if any(contra.lower() in a.lower() for a in allergies):
                raise HTTPException(400, f"Contraindicado por perfil: {contra}")

    log = {
        "user_id": user_id,
        "date": today_str(),
        "supplement_name": data.supplement_name,
        "category": data.category,
        "product": data.product,
        "brand": data.brand,
        "dose": data.dose,
        "timing": data.timing,
        "antidoping_cert": data.antidoping_cert,
        "notes": data.notes,
        "catalog_version": "1.0.0",
        "created_at": now_utc(),
        "deleted_at": None,
    }
    result = await db.supplement_logs.insert_one(log)
    log.pop("_id", None)
    log["id"] = str(result.inserted_id)
    return log


@router.get("/supplements")
async def list_supplements(
    date: str | None = Query(None),
    user: dict = Depends(current_user),
):
    target = date or today_str()
    logs = await db.supplement_logs.find(
        {"user_id": str(user["_id"]), "date": target, "deleted_at": None}
    ).sort("created_at", 1).to_list(50)
    for log in logs:
        log["id"] = str(log.pop("_id"))
    return {"supplements": logs, "date": target}


@router.delete("/supplements/{log_id}")
async def delete_supplement_log(log_id: str, user: dict = Depends(current_user)):
    if not ObjectId.is_valid(log_id):
        raise HTTPException(404, "Registro nao encontrado")
    result = await db.supplement_logs.update_one(
        {"_id": ObjectId(log_id), "user_id": str(user["_id"]), "deleted_at": None},
        {"$set": {"deleted_at": now_utc()}},
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Registro nao encontrado")
    return {"ok": True}


# ── Fueling log ─────────────────────────────────────────────────


@router.post("/sessions")
async def log_fueling_session(
    data: FuelingLogIn,
    user: dict = Depends(current_user),
):
    log = {
        "user_id": str(user["_id"]),
        "date": today_str(),
        **data.model_dump(),
        "created_at": now_utc(),
        "deleted_at": None,
    }
    result = await db.fueling_logs.insert_one(log)
    log.pop("_id", None)
    log["id"] = str(result.inserted_id)
    return log


@router.get("/sessions")
async def list_fueling_sessions(
    date: str | None = Query(None),
    user: dict = Depends(current_user),
):
    target = date or today_str()
    logs = await db.fueling_logs.find(
        {"user_id": str(user["_id"]), "date": target, "deleted_at": None}
    ).sort("created_at", 1).to_list(50)
    for log in logs:
        log["id"] = str(log.pop("_id"))
    return {"sessions": logs, "date": target}


@router.delete("/sessions/{log_id}")
async def delete_fueling_session(log_id: str, user: dict = Depends(current_user)):
    if not ObjectId.is_valid(log_id):
        raise HTTPException(404, "Registro nao encontrado")
    result = await db.fueling_logs.update_one(
        {"_id": ObjectId(log_id), "user_id": str(user["_id"]), "deleted_at": None},
        {"$set": {"deleted_at": now_utc()}},
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Registro nao encontrado")
    return {"ok": True}


# ── Sweat test ──────────────────────────────────────────────────


@router.post("/sweat-test")
async def log_sweat_test(
    data: SweatTestIn,
    user: dict = Depends(current_user),
):
    weight_loss_kg = data.weight_pre_kg - data.weight_post_kg
    net_fluid_loss_ml = (weight_loss_kg * 1000) + data.fluid_intake_ml - data.urine_ml
    sweat_rate_ml_per_hour = round(net_fluid_loss_ml / (data.duration_min / 60), 0) if data.duration_min > 0 else 0

    test = {
        "user_id": str(user["_id"]),
        "date": today_str(),
        **data.model_dump(),
        "weight_loss_kg": round(weight_loss_kg, 2),
        "net_fluid_loss_ml": round(net_fluid_loss_ml, 0),
        "sweat_rate_ml_per_hour": sweat_rate_ml_per_hour,
        "created_at": now_utc(),
    }
    result = await db.sweat_tests.insert_one(test)
    test.pop("_id", None)
    test["id"] = str(result.inserted_id)
    return test


@router.get("/sweat-tests")
async def list_sweat_tests(user: dict = Depends(current_user)):
    tests = await db.sweat_tests.find(
        {"user_id": str(user["_id"])}
    ).sort("created_at", -1).to_list(20)
    for t in tests:
        t["id"] = str(t.pop("_id"))
    return {"tests": tests}


# ── Fueling strategy (race/training) ───────────────────────────


@router.get("/strategy")
async def fueling_strategy(
    duration_min: int = Query(ge=0, le=1440),
    intensity: str = Query(default="moderate"),
    user: dict = Depends(current_user),
):
    """Recomendação de fueling baseada na duração e intensidade."""
    recs: list[dict[str, str]] = []

    if duration_min <= 60:
        recs.append({
            "category": "hydration",
            "recommendation": "Água conforme sede. Isotônico opcional se calor intenso.",
            "source": "ACSM Position Stand (2016)",
        })
        recs.append({
            "category": "carbohydrate",
            "recommendation": "Não é necessário suplementar carboidrato durante sessões até 60 min.",
            "source": "IOC Consensus (2011)",
        })
    elif duration_min <= 150:
        recs.append({
            "category": "hydration",
            "recommendation": "400-800 ml/h conforme taxa de suor. Não exceder perda estimada.",
            "source": "ACSM Position Stand (2016)",
        })
        recs.append({
            "category": "carbohydrate",
            "recommendation": "30-60 g/h de carboidrato. Iniciar nos primeiros 30 min.",
            "source": "IOC Consensus (2011), ISSN (2017)",
        })
        recs.append({
            "category": "sodium",
            "recommendation": "300-600 mg/h de sódio via isotônico ou pastilha de sal.",
            "source": "ACSM Position Stand (2016)",
        })
    else:
        recs.append({
            "category": "hydration",
            "recommendation": "500-1000 ml/h conforme taxa de suor e condições. Testar previamente.",
            "source": "ACSM Position Stand (2016)",
        })
        recs.append({
            "category": "carbohydrate",
            "recommendation": (
                "Até 90 g/h somente com treino gastrointestinal prévio "
                "e mix de glicose:frutose (2:1). Iniciar com 60 g/h e aumentar gradualmente."
            ),
            "source": "IOC Consensus (2011), ISSN (2017)",
        })
        recs.append({
            "category": "sodium",
            "recommendation": "500-1000 mg/h de sódio. Individualizar por taxa de suor.",
            "source": "ACSM Position Stand (2016)",
        })
        recs.append({
            "category": "gi_training",
            "recommendation": (
                "Recomenda-se treinar o trato gastrointestinal em sessões longas antes da prova. "
                "Testar produtos, volumes e concentrações progressivamente."
            ),
            "source": "IOC Consensus (2011)",
        })

    checklist = [
        "Testar todos os produtos em treinos antes da prova",
        "Calcular taxa de suor com teste de peso pré/pós",
        "Preparar sachês/garrafas com quantidades pré-calculadas",
        "Definir pontos de ingestão a cada 15-20 min",
        "Ter alternativa caso produto principal cause desconforto",
        "Considerar temperatura e umidade previstas",
    ]

    return {
        "duration_min": duration_min,
        "intensity": intensity,
        "recommendations": recs,
        "checklist": checklist,
    }


# ── GI Training ──────────────────────────────────────────────────


def _round5(v: float) -> int:
    return int(round(v / 5) * 5)


def generate_gi_schedule(
    start: int, target: int, weeks: int, sessions_per_week: int,
) -> list[dict]:
    schedule: list[dict] = []
    ramp_weeks = max(weeks - 2, 1)
    increment = (target - start) / ramp_weeks

    for w in range(1, weeks + 1):
        if w == 1:
            rate = start
        elif w == weeks:
            rate = target
        else:
            rate = _round5(start + increment * (w - 1))
            rate = min(rate, target)

        recs: list[str] = []
        if rate > 60:
            recs.append(
                "Usar mix de glicose:frutose (2:1) para absorção acima de 60 g/h."
            )
        if w == 1:
            recs.append(
                "Semana de baseline: familiarizar-se com produtos e volume."
            )
        if w == weeks:
            recs.append(
                "Semana de validação: simular condições de prova."
            )
        recs.append(
            "Praticar em sessões longas de intensidade leve a moderada."
        )
        recs.append(
            "Observar nausea, cramping, bloating e desconforto abdominal."
        )
        if rate >= 60:
            vol_ml = int(rate / 0.06)
            recs.append(
                f"Concentracao sugerida: ~6% ({rate}g em ~{vol_ml} ml)."
            )

        schedule.append({
            "week": w,
            "target_carb_g_per_hour": rate,
            "sessions": sessions_per_week,
            "recommendations": recs,
        })

    return schedule


@router.post("/gi-training/plan", status_code=201)
async def create_gi_plan(
    data: GITrainingPlanIn, user: dict = Depends(current_user),
):
    user_id = str(user["_id"])
    now = now_utc()

    await db.gi_training_plans.update_many(
        {"user_id": user_id, "status": "active"},
        {"$set": {"status": "superseded", "updated_at": now}},
    )

    schedule = generate_gi_schedule(
        data.start_carb_g_per_hour,
        data.target_carb_g_per_hour,
        data.duration_weeks,
        data.sessions_per_week,
    )

    plan = {
        "user_id": user_id,
        "target_carb_g_per_hour": data.target_carb_g_per_hour,
        "start_carb_g_per_hour": data.start_carb_g_per_hour,
        "duration_weeks": data.duration_weeks,
        "sessions_per_week": data.sessions_per_week,
        "preferred_products": data.preferred_products,
        "schedule": schedule,
        "status": "active",
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    }
    result = await db.gi_training_plans.insert_one(plan)
    plan["id"] = str(result.inserted_id)
    plan.pop("_id", None)
    return plan


@router.get("/gi-training/plan")
async def get_gi_plan(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    plan = await db.gi_training_plans.find_one(
        {"user_id": user_id, "status": "active", "deleted_at": None}
    )
    if not plan:
        raise HTTPException(404, "Nenhum plano de treino GI ativo")
    plan["id"] = str(plan.pop("_id"))
    plan.pop("user_id", None)

    logs = await db.gi_session_logs.find(
        {"plan_id": plan["id"], "user_id": user_id}
    ).sort([("week", 1), ("session_number", 1)]).to_list(200)
    plan["sessions_completed"] = len(logs)
    return plan


@router.delete("/gi-training/plan/{plan_id}")
async def delete_gi_plan(plan_id: str, user: dict = Depends(current_user)):
    if not ObjectId.is_valid(plan_id):
        raise HTTPException(404, "Plano nao encontrado")
    result = await db.gi_training_plans.update_one(
        {
            "_id": ObjectId(plan_id),
            "user_id": str(user["_id"]),
            "deleted_at": None,
        },
        {"$set": {"deleted_at": now_utc(), "status": "deleted"}},
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Plano nao encontrado")
    return {"ok": True}


@router.post("/gi-training/log")
async def log_gi_session(
    data: GISessionLogIn, user: dict = Depends(current_user),
):
    user_id = str(user["_id"])
    plan = await db.gi_training_plans.find_one(
        {"user_id": user_id, "status": "active", "deleted_at": None}
    )
    if not plan:
        raise HTTPException(400, "Nenhum plano de treino GI ativo")

    plan_id = str(plan["_id"])
    now = now_utc()

    log = {
        "user_id": user_id,
        "plan_id": plan_id,
        **data.model_dump(),
        "created_at": now,
    }
    result = await db.gi_session_logs.insert_one(log)

    plateau_recommended = False
    if data.tolerance_score <= 2:
        recent = await db.gi_session_logs.find(
            {"plan_id": plan_id, "user_id": user_id, "week": data.week}
        ).sort("session_number", -1).to_list(3)
        low_count = sum(1 for r in recent if r.get("tolerance_score", 5) <= 2)
        if low_count >= 2:
            plateau_recommended = True

    next_rec: dict[str, Any] = {}
    if data.tolerance_score >= 4:
        next_rate = min(
            _round5(data.planned_carb_g_per_hour + 5),
            plan["target_carb_g_per_hour"],
        )
        next_rec = {
            "action": "increase",
            "next_carb_g_per_hour": next_rate,
            "message": f"Boa tolerancia! Proximo objetivo: {next_rate} g/h.",
        }
    elif data.tolerance_score <= 2:
        next_rec = {
            "action": "hold",
            "next_carb_g_per_hour": int(data.planned_carb_g_per_hour),
            "message": "Manter a mesma taxa ate melhorar a tolerancia.",
        }
    else:
        next_rec = {
            "action": "hold",
            "next_carb_g_per_hour": int(data.planned_carb_g_per_hour),
            "message": "Tolerancia moderada. Repetir esta taxa na proxima sessao.",
        }

    return {
        "id": str(result.inserted_id),
        "plateau_recommended": plateau_recommended,
        "next_recommendation": next_rec,
    }


@router.get("/gi-training/log")
async def list_gi_logs(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    plan = await db.gi_training_plans.find_one(
        {"user_id": user_id, "status": "active", "deleted_at": None}
    )
    if not plan:
        raise HTTPException(404, "Nenhum plano de treino GI ativo")

    logs = await db.gi_session_logs.find(
        {"plan_id": str(plan["_id"]), "user_id": user_id}
    ).sort([("week", 1), ("session_number", 1)]).to_list(200)
    for log in logs:
        log["id"] = str(log.pop("_id"))
        log.pop("user_id", None)
    return {"logs": logs}


@router.get("/gi-training/progress")
async def gi_progress(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    plan = await db.gi_training_plans.find_one(
        {"user_id": user_id, "status": "active", "deleted_at": None}
    )
    if not plan:
        raise HTTPException(404, "Nenhum plano de treino GI ativo")

    plan_id = str(plan["_id"])
    logs = await db.gi_session_logs.find(
        {"plan_id": plan_id, "user_id": user_id}
    ).sort([("week", 1), ("session_number", 1)]).to_list(200)

    total = len(logs)
    expected_total = plan["duration_weeks"] * plan["sessions_per_week"]

    tolerance_by_week: dict[int, list[int]] = {}
    symptom_counter: Counter[str] = Counter()
    max_week = 0
    for log in logs:
        w = log["week"]
        if w > max_week:
            max_week = w
        tolerance_by_week.setdefault(w, []).append(log.get("tolerance_score", 3))
        for s in log.get("symptoms", []):
            symptom_counter[s] += 1

    avg_tolerance = [
        {"week": w, "avg_tolerance": round(sum(scores) / len(scores), 1)}
        for w, scores in sorted(tolerance_by_week.items())
    ]

    schedule = plan.get("schedule", [])
    current_week_target = plan["start_carb_g_per_hour"]
    for entry in schedule:
        if entry["week"] <= max_week + 1:
            current_week_target = entry["target_carb_g_per_hour"]

    if total == 0:
        status = "not_started"
    elif total >= expected_total:
        status = "completed"
    elif max_week * plan["sessions_per_week"] > total + plan["sessions_per_week"]:
        status = "behind"
    else:
        status = "on_track"

    next_rec: dict[str, Any] = {
        "week": min(max_week + 1, plan["duration_weeks"]),
        "target_carb_g_per_hour": current_week_target,
    }
    if current_week_target > 60:
        next_rec["product_mix"] = "Glicose:frutose 2:1"
        vol = int(current_week_target / 0.06)
        next_rec["volume_suggestion_ml"] = vol

    return {
        "plan_id": plan_id,
        "total_sessions": total,
        "expected_sessions": expected_total,
        "current_week": min(max_week + 1, plan["duration_weeks"]),
        "current_target_carb_g_per_hour": current_week_target,
        "status": status,
        "tolerance_by_week": avg_tolerance,
        "symptom_frequency": dict(symptom_counter.most_common(10)),
        "next_recommendation": next_rec,
    }
