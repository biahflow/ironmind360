from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import db
from app.dependencies import current_user, require_roles
from app.models.meal_plan import (
    MealPlanCreateIn,
    MealPlanReviewIn,
    NutritionScreeningIn,
)
from app.utils.time import now_utc

router = APIRouter(prefix="/meal-plans", tags=["meal-plans"])


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


# ── Screening ───────────────────────────────────────────────────


@router.post("/screening")
async def save_screening(
    data: NutritionScreeningIn,
    user: dict = Depends(current_user),
):
    user_id = str(user["_id"])
    screening = data.model_dump()
    screening["user_id"] = user_id
    screening["created_at"] = now_utc()

    await db.nutrition_screenings.update_one(
        {"user_id": user_id},
        {"$set": screening},
        upsert=True,
    )
    return {"ok": True}


@router.get("/screening")
async def get_screening(user: dict = Depends(current_user)):
    doc = await db.nutrition_screenings.find_one({"user_id": str(user["_id"])})
    if not doc:
        return {"screening": None}
    doc.pop("_id", None)

    alerts: list[dict[str, str]] = []
    if doc.get("eating_disorder_history"):
        alerts.append({
            "level": "attention",
            "message": "Histórico de transtorno alimentar informado. Recomenda-se acompanhamento profissional.",
        })
    if doc.get("pregnant_or_lactating"):
        alerts.append({
            "level": "attention",
            "message": "Gestação ou lactação. Plano alimentar exige acompanhamento nutricional.",
        })

    bmr = _estimate_bmr(doc)
    if bmr and doc.get("activity_level") in ("active", "very_active"):
        factor = {"active": 1.725, "very_active": 1.9}.get(doc["activity_level"], 1.55)
        tdee = bmr * factor
        lea_threshold = 30 * doc.get("weight_kg", 70)
        if tdee and (tdee - lea_threshold) < tdee * 0.6:
            alerts.append({
                "level": "informative",
                "message": (
                    f"Atenção à disponibilidade energética. "
                    f"TDEE estimado ~{int(tdee)} kcal. "
                    f"Consumo abaixo de ~{int(lea_threshold)} kcal do gasto com exercício "
                    f"pode indicar LEA (Low Energy Availability). "
                    f"Consulte um nutricionista esportivo para avaliação."
                ),
            })

    return {"screening": doc, "alerts": alerts}


def _estimate_bmr(screening: dict) -> float | None:
    w: float | None = screening.get("weight_kg")
    h: float | None = screening.get("height_cm")
    age: int | None = screening.get("age")
    sex: str | None = screening.get("sex")
    if w is None or h is None or age is None or sex is None:
        return None
    if sex == "male":
        return 10 * w + 6.25 * h - 5 * age + 5
    return 10 * w + 6.25 * h - 5 * age - 161


# ── Plan CRUD (athlete) ────────────────────────────────────────


@router.post("")
async def create_plan(
    data: MealPlanCreateIn,
    user: dict = Depends(current_user),
):
    user_id = str(user["_id"])

    active = await db.meal_plans.count_documents(
        {"user_id": user_id, "status": {"$in": ["draft", "professional_review", "published"]}, "deleted_at": None}
    )
    if active >= 10:
        raise HTTPException(400, "Limite de 10 planos ativos atingido")

    plan = {
        "user_id": user_id,
        "title": data.title,
        "goal": data.goal,
        "days": [d.model_dump() for d in data.days],
        "shopping_list": data.shopping_list,
        "notes": data.notes,
        "status": "draft",
        "source": "ai_draft",
        "nutritionist_id": None,
        "review_comments": [],
        "created_at": now_utc(),
        "updated_at": now_utc(),
        "published_at": None,
        "deleted_at": None,
    }
    result = await db.meal_plans.insert_one(plan)
    plan.pop("_id", None)
    plan["id"] = str(result.inserted_id)
    return plan


@router.get("/templates")
async def list_templates(user: dict = Depends(current_user)):
    """Modelos educativos para quem não tem nutricionista. Claramente rotulados."""
    templates = [
        {
            "id": "template_maintenance",
            "title": "Modelo educativo: manutenção para endurance",
            "disclaimer": "Este é um modelo educativo genérico. Não substitui orientação de um nutricionista.",
            "goal": "maintenance",
            "kcal_range": "2200-2800 kcal",
            "macro_split": "Carboidrato 50-60%, Proteína 15-20%, Gordura 25-30%",
            "meals_per_day": 5,
            "source": "ACSM Nutrition & Athletic Performance (2016)",
        },
        {
            "id": "template_race_day",
            "title": "Modelo educativo: dia de prova (olímpico/70.3)",
            "disclaimer": "Este é um modelo educativo genérico. Não substitui orientação de um nutricionista.",
            "goal": "race_day",
            "kcal_range": "Variável conforme duração",
            "macro_split": "Carboidrato 60-70% nos dias anteriores (carga)",
            "meals_per_day": 4,
            "source": "IOC Consensus Statement on Sports Nutrition (2011)",
        },
        {
            "id": "template_recovery",
            "title": "Modelo educativo: recuperação pós-treino longo",
            "disclaimer": "Este é um modelo educativo genérico. Não substitui orientação de um nutricionista.",
            "goal": "recovery",
            "kcal_range": "Suficiente para repor gasto",
            "macro_split": "1-1.2g carbo/kg/h nas primeiras 4h + 0.25-0.4g proteína/kg",
            "meals_per_day": 5,
            "source": "ISSN Position Stand - Nutrient Timing (2017)",
        },
    ]
    return {"templates": templates}


@router.get("")
async def list_plans(
    status: str | None = Query(None),
    user: dict = Depends(current_user),
):
    query: dict = {"user_id": str(user["_id"]), "deleted_at": None}
    if status:
        query["status"] = status
    plans = await db.meal_plans.find(query).sort("created_at", -1).to_list(20)
    for p in plans:
        _serialize(p)
    return {"plans": plans}


@router.get("/{plan_id}")
async def get_plan(plan_id: str, user: dict = Depends(current_user)):
    if not ObjectId.is_valid(plan_id):
        raise HTTPException(404, "Plano nao encontrado")
    plan = await db.meal_plans.find_one(
        {"_id": ObjectId(plan_id), "user_id": str(user["_id"]), "deleted_at": None}
    )
    if not plan:
        raise HTTPException(404, "Plano nao encontrado")
    return _serialize(plan)


@router.put("/{plan_id}")
async def update_plan(
    plan_id: str,
    data: MealPlanCreateIn,
    user: dict = Depends(current_user),
):
    if not ObjectId.is_valid(plan_id):
        raise HTTPException(404, "Plano nao encontrado")
    plan = await db.meal_plans.find_one(
        {"_id": ObjectId(plan_id), "user_id": str(user["_id"]), "deleted_at": None}
    )
    if not plan:
        raise HTTPException(404, "Plano nao encontrado")
    if plan["status"] not in ("draft",):
        raise HTTPException(400, "Somente planos em rascunho podem ser editados")

    await db.meal_plans.update_one(
        {"_id": plan["_id"]},
        {"$set": {
            "title": data.title,
            "goal": data.goal,
            "days": [d.model_dump() for d in data.days],
            "shopping_list": data.shopping_list,
            "notes": data.notes,
            "updated_at": now_utc(),
        }},
    )
    updated = await db.meal_plans.find_one({"_id": plan["_id"]})
    if not updated:
        raise HTTPException(404, "Plano nao encontrado")
    return _serialize(updated)


@router.post("/{plan_id}/submit")
async def submit_for_review(
    plan_id: str,
    user: dict = Depends(current_user),
):
    if not ObjectId.is_valid(plan_id):
        raise HTTPException(404, "Plano nao encontrado")
    plan = await db.meal_plans.find_one(
        {"_id": ObjectId(plan_id), "user_id": str(user["_id"]), "deleted_at": None}
    )
    if not plan:
        raise HTTPException(404, "Plano nao encontrado")
    if plan["status"] != "draft":
        raise HTTPException(400, "Somente rascunhos podem ser enviados para revisao")

    await db.meal_plans.update_one(
        {"_id": plan["_id"]},
        {"$set": {"status": "professional_review", "updated_at": now_utc()}},
    )
    return {"ok": True, "status": "professional_review"}


@router.delete("/{plan_id}")
async def delete_plan(plan_id: str, user: dict = Depends(current_user)):
    if not ObjectId.is_valid(plan_id):
        raise HTTPException(404, "Plano nao encontrado")
    result = await db.meal_plans.update_one(
        {"_id": ObjectId(plan_id), "user_id": str(user["_id"]), "deleted_at": None},
        {"$set": {"deleted_at": now_utc()}},
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Plano nao encontrado")
    return {"ok": True}


# ── Nutritionist review ────────────────────────────────────────


@router.get("/review/queue", dependencies=[Depends(require_roles("nutritionist", "administrator"))])
async def review_queue(user: dict = Depends(current_user)):
    plans = await db.meal_plans.find(
        {"status": "professional_review", "deleted_at": None}
    ).sort("updated_at", 1).to_list(50)
    for p in plans:
        _serialize(p)
    return {"plans": plans}


@router.post("/{plan_id}/review", dependencies=[Depends(require_roles("nutritionist", "administrator"))])
async def review_plan(
    plan_id: str,
    data: MealPlanReviewIn,
    user: dict = Depends(current_user),
):
    if not ObjectId.is_valid(plan_id):
        raise HTTPException(404, "Plano nao encontrado")
    plan = await db.meal_plans.find_one(
        {"_id": ObjectId(plan_id), "status": "professional_review", "deleted_at": None}
    )
    if not plan:
        raise HTTPException(404, "Plano em revisao nao encontrado")

    reviewer_id = str(user["_id"])
    review_entry = {
        "reviewer_id": reviewer_id,
        "reviewer_name": user.get("name", ""),
        "comments": data.comments,
        "approved": data.approved,
        "created_at": now_utc(),
    }

    update: dict = {
        "$push": {"review_comments": review_entry},
        "$set": {
            "nutritionist_id": reviewer_id,
            "updated_at": now_utc(),
        },
    }

    if data.approved:
        await db.meal_plans.update_many(
            {"user_id": plan["user_id"], "status": "published", "deleted_at": None},
            {"$set": {"status": "superseded", "updated_at": now_utc()}},
        )
        update["$set"]["status"] = "published"
        update["$set"]["published_at"] = now_utc()
    else:
        update["$set"]["status"] = "draft"

    await db.meal_plans.update_one({"_id": plan["_id"]}, update)
    return {"ok": True, "status": "published" if data.approved else "draft"}


@router.put("/{plan_id}/professional-edit", dependencies=[Depends(require_roles("nutritionist", "administrator"))])
async def professional_edit(
    plan_id: str,
    data: MealPlanCreateIn,
    user: dict = Depends(current_user),
):
    if not ObjectId.is_valid(plan_id):
        raise HTTPException(404, "Plano nao encontrado")
    plan = await db.meal_plans.find_one(
        {"_id": ObjectId(plan_id), "deleted_at": None}
    )
    if not plan:
        raise HTTPException(404, "Plano nao encontrado")
    if plan["status"] not in ("professional_review", "draft"):
        raise HTTPException(400, "Plano nao esta em revisao ou rascunho")

    await db.meal_plans.update_one(
        {"_id": plan["_id"]},
        {"$set": {
            "title": data.title,
            "goal": data.goal,
            "days": [d.model_dump() for d in data.days],
            "shopping_list": data.shopping_list,
            "notes": data.notes,
            "nutritionist_id": str(user["_id"]),
            "updated_at": now_utc(),
        }},
    )
    updated = await db.meal_plans.find_one({"_id": plan["_id"]})
    if not updated:
        raise HTTPException(404, "Plano nao encontrado")
    return _serialize(updated)
