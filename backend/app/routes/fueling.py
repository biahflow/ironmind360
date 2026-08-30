from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import db
from app.dependencies import current_user
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
