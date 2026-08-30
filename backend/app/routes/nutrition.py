import json
from datetime import timedelta

import requests
from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.concurrency import run_in_threadpool

from app.adapters.ai import analyze_food_image, complete_text
from app.adapters.legacy_storage import legacy_storage
from app.config import settings
from app.database import db
from app.dependencies import current_user
from app.models import Goals
from app.models.nutrition import (
    FavoriteIn,
    ManualMealIn,
    MealEditIn,
    RecipeIdeasIn,
    RecipeIn,
)
from app.rate_limit import rate_limit
from app.services.files import create_file, delete_file, ensure_legacy_meal_file
from app.utils.time import now_utc, today_str

router = APIRouter(prefix="/nutrition", tags=["nutrition"])


def _sum_items(items: list[dict]) -> dict:
    keys = ["calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sodium_mg", "sugar_g"]
    return {k: sum(i.get(k, 0) or 0 for i in items) for k in keys}


def _serialize_meal(meal: dict, file_document: dict | None = None) -> dict:
    meal["id"] = str(meal.pop("_id"))
    meal["photo_url"] = (
        f"/api/v1/files/{file_document['_id']}" if file_document else None
    )
    return meal


# ── Photo analysis (existing) ──────────────────────────────────


@router.post("/analyze", dependencies=[Depends(rate_limit("upload", 12, 60))])
async def analyze_meal(
    file: UploadFile = File(...),
    meal_type: str = Form("meal"),
    user: dict = Depends(current_user),
):
    user_id = str(user["_id"])
    content = await file.read()
    content_type = file.content_type or "image/jpeg"
    if content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(415, "Formato de imagem nao permitido")
    if not content or len(content) > 10 * 1024 * 1024:
        raise HTTPException(413, "Imagem vazia ou maior que 10 MB")

    try:
        analysis = await analyze_food_image(content)
    except Exception:
        analysis = None

    stored_file = await create_file(
        owner_user_id=user_id,
        data=content,
        content_type=content_type,
        original_name=file.filename,
    )

    items_raw = analysis.get("items", []) if analysis else []
    items = []
    for item in items_raw:
        if isinstance(item, str):
            items.append({"name": item, "quantity": 1, "unit": "porcao",
                          "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0,
                          "fiber_g": 0, "sodium_mg": 0, "sugar_g": 0})
        elif isinstance(item, dict):
            items.append({
                "name": item.get("name", item.get("item", "Item")),
                "quantity": item.get("quantity", 1),
                "unit": item.get("unit", "porcao"),
                "calories": item.get("calories", 0),
                "protein_g": item.get("protein_g", 0),
                "carbs_g": item.get("carbs_g", 0),
                "fat_g": item.get("fat_g", 0),
                "fiber_g": item.get("fiber_g", 0),
                "sodium_mg": item.get("sodium_mg", 0),
                "sugar_g": item.get("sugar_g", 0),
            })

    totals = _sum_items(items) if items else {}

    meal = {
        "user_id": user_id,
        "date": today_str(),
        "meal_type": meal_type,
        "source": "photo",
        "photo_file_id": stored_file["_id"],
        "title": (analysis or {}).get("title", "Refeição"),
        "items": items,
        "calories": totals.get("calories", analysis.get("calories", 0) if analysis else 0),
        "protein_g": totals.get("protein_g", analysis.get("protein_g", 0) if analysis else 0),
        "carbs_g": totals.get("carbs_g", analysis.get("carbs_g", 0) if analysis else 0),
        "fat_g": totals.get("fat_g", analysis.get("fat_g", 0) if analysis else 0),
        "fiber_g": totals.get("fiber_g", 0),
        "sodium_mg": totals.get("sodium_mg", 0),
        "sugar_g": totals.get("sugar_g", 0),
        "health_score": (analysis or {}).get("health_score", 0),
        "coach_note": (analysis or {}).get("coach_note", ""),
        "ai_failed": analysis is None,
        "notes": "",
        "created_at": now_utc(),
        "deleted_at": None,
    }
    try:
        result = await db.meals.insert_one(meal)
    except Exception:
        await delete_file(stored_file)
        raise
    meal.pop("_id", None)
    meal["id"] = str(result.inserted_id)
    meal["photo_url"] = f"/api/v1/files/{stored_file['_id']}"
    return meal


# ── Busca por código de barras (OpenFoodFacts) ─────────────────


def _num(nutriments: dict, key: str) -> float:
    value = nutriments.get(key)
    if value in (None, ""):
        return 0.0
    try:
        return round(float(value), 1)
    except (TypeError, ValueError):
        return 0.0


@router.get("/barcode/{code}", dependencies=[Depends(rate_limit("barcode", 30, 60))])
async def barcode_lookup(code: str, _user: dict = Depends(current_user)):
    code = code.strip()
    if not code.isdigit() or not (6 <= len(code) <= 14):
        raise HTTPException(400, "Código de barras inválido")

    def fetch():
        return requests.get(
            f"https://world.openfoodfacts.org/api/v2/product/{code}.json",
            params={"fields": "product_name,product_name_pt,brands,nutriments"},
            headers={"User-Agent": "IronMind360/1.0 (nutrition)"},
            timeout=8,
        )

    try:
        resp = await run_in_threadpool(fetch)
    except Exception as exc:
        raise HTTPException(502, "Falha ao consultar a base de alimentos") from exc

    if resp.status_code != 200:
        raise HTTPException(404, "Produto não encontrado")
    body = resp.json()
    product = body.get("product")
    if body.get("status") != 1 or not product:
        raise HTTPException(404, "Produto não encontrado")

    nutriments = product.get("nutriments") or {}
    name = product.get("product_name_pt") or product.get("product_name") or "Produto"
    brand = (product.get("brands") or "").split(",")[0].strip()
    item = {
        "name": f"{name} ({brand})" if brand else name,
        "quantity": 100,
        "unit": "g",
        "calories": _num(nutriments, "energy-kcal_100g"),
        "protein_g": _num(nutriments, "proteins_100g"),
        "carbs_g": _num(nutriments, "carbohydrates_100g"),
        "fat_g": _num(nutriments, "fat_100g"),
        "fiber_g": _num(nutriments, "fiber_100g"),
        "sodium_mg": round(_num(nutriments, "sodium_100g") * 1000, 1),
        "sugar_g": _num(nutriments, "sugars_100g"),
    }
    return {"found": True, "code": code, "item": item}


def _product_to_item(product: dict) -> dict | None:
    nutriments = product.get("nutriments") or {}
    calories = _num(nutriments, "energy-kcal_100g")
    name = product.get("product_name_pt") or product.get("product_name")
    if isinstance(name, list):
        name = name[0] if name else None
    if not isinstance(name, str) or not name.strip() or calories <= 0:
        return None
    name = name.strip()
    brands = product.get("brands")
    if isinstance(brands, list):
        brand = (brands[0] if brands else "")
    else:
        brand = str(brands or "").split(",")[0]
    brand = brand.strip()
    return {
        "name": f"{name} ({brand})" if brand else name,
        "quantity": 100,
        "unit": "g",
        "calories": calories,
        "protein_g": _num(nutriments, "proteins_100g"),
        "carbs_g": _num(nutriments, "carbohydrates_100g"),
        "fat_g": _num(nutriments, "fat_100g"),
        "fiber_g": _num(nutriments, "fiber_100g"),
        "sodium_mg": round(_num(nutriments, "sodium_100g") * 1000, 1),
        "sugar_g": _num(nutriments, "sugars_100g"),
    }


@router.get("/search", dependencies=[Depends(rate_limit("food_search", 30, 60))])
async def food_search(q: str = Query(..., min_length=2, max_length=80), _user: dict = Depends(current_user)):
    def fetch():
        # Serviço de busca novo (Elasticsearch) — mais estável que o cgi/search.pl.
        return requests.get(
            "https://search.openfoodfacts.org/search",
            params={
                "q": q,
                "page_size": 15,
                "fields": "product_name,product_name_pt,brands,nutriments",
            },
            headers={"User-Agent": "IronMind360/1.0 (nutrition)"},
            timeout=12,
        )

    try:
        resp = await run_in_threadpool(fetch)
    except Exception as exc:
        raise HTTPException(502, "Falha ao buscar alimentos") from exc

    products: list = []
    if resp.status_code == 200:
        try:
            products = resp.json().get("hits", []) or []
        except ValueError:
            products = []

    items = [i for i in (_product_to_item(p) for p in products) if i]
    return {"query": q, "results": items[:20]}


# ── Plano nutricional sugerido (IA, por modalidade) ────────────

PLAN_DISCLAIMER = (
    "Sugestão automática gerada por IA com base nos seus dados. NÃO substitui "
    "acompanhamento com nutricionista — que fica disponível ao enviar seus exames."
)


def _derive_modality(disciplines: list) -> str:
    d = set(disciplines or [])
    if {"swim", "bike", "run"}.issubset(d):
        return "triatlo"
    if d == {"run"}:
        return "corrida"
    if d:
        return "+".join(sorted(d))
    return "geral"


async def _gather_plan_context(user: dict) -> dict:
    user_id = str(user["_id"])
    profile = await db.profiles.find_one({"user_id": user_id}) or {}
    sport = profile.get("sport") or {}
    goals = user.get("goals") or Goals().model_dump()

    since = (now_utc() - timedelta(days=14)).strftime("%Y-%m-%d")
    cursor = await db.activities.aggregate([
        {"$match": {"user_id": user_id, "start_date_local": {"$gte": since}}},
        {"$group": {"_id": None, "tss": {"$sum": {"$ifNull": ["$icu_training_load", 0]}}, "n": {"$sum": 1}}},
    ])
    agg = await cursor.to_list(1)
    weekly_tss = round((agg[0]["tss"] / 2) if agg else 0)
    sessions_14d = agg[0]["n"] if agg else 0

    weight = None
    async for h in db.habits.find(
        {"user_id": user_id, "weight_kg": {"$ne": None}}, {"weight_kg": 1}
    ).sort("date", -1).limit(1):
        weight = h.get("weight_kg")

    return {
        "modality": _derive_modality(sport.get("disciplines")),
        "experience": sport.get("experience"),
        "weekly_availability_hours": sport.get("weekly_availability_hours"),
        "goals": goals,
        "avg_weekly_tss": weekly_tss,
        "sessions_last_14d": sessions_14d,
        "weight_kg": weight,
    }


@router.get("/plan")
async def get_nutrition_plan(user: dict = Depends(current_user)):
    doc = await db.nutrition_plans.find_one({"user_id": str(user["_id"])})
    if not doc:
        return {"plan": None, "disclaimer": PLAN_DISCLAIMER}
    return {
        "plan": doc.get("plan"),
        "modality": doc.get("modality"),
        "generated_at": doc.get("created_at"),
        "disclaimer": PLAN_DISCLAIMER,
    }


@router.post("/plan/generate", dependencies=[Depends(rate_limit("nutrition_plan", 6, 3600))])
async def generate_nutrition_plan(user: dict = Depends(current_user)):
    ctx = await _gather_plan_context(user)
    system = (
        "Voce e um nutricionista esportivo criando uma SUGESTAO de plano alimentar "
        "diario para um atleta de " + ctx["modality"] + ". Use os dados fornecidos "
        "para calibrar calorias e macros a carga de treino. NAO faca diagnostico nem "
        "prescricao medica. Maximo 6 refeicoes, sugestoes curtas. Responda SOMENTE "
        "JSON valido, sem markdown e sem texto fora do JSON, no formato: "
        '{"summary":"", "daily_calories":0, "protein_g":0, "carbs_g":0, "fat_g":0, '
        '"hydration_ml":0, "meals":[{"name":"", "suggestion":"", "kcal":0}], '
        '"pre_workout":"", "post_workout":"", "notes":""}'
    )
    prompt = "Dados do atleta (JSON):\n" + json.dumps(ctx, ensure_ascii=False)

    try:
        raw = await complete_text(
            session_id=f"nutriplan-{user['_id']}",
            system=system,
            prompt=prompt,
            provider=settings.coach_provider,
            model=settings.coach_model,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, "Falha ao gerar o plano") from exc

    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1].removeprefix("json").strip()
    try:
        plan = json.loads(raw)
    except json.JSONDecodeError:
        start, end = raw.find("{"), raw.rfind("}")
        if start < 0 or end <= start:
            raise HTTPException(502, "Resposta invalida da IA")
        plan = json.loads(raw[start:end + 1])

    now = now_utc()
    await db.nutrition_plans.update_one(
        {"user_id": str(user["_id"])},
        {"$set": {"plan": plan, "modality": ctx["modality"], "created_at": now}},
        upsert=True,
    )
    return {"plan": plan, "modality": ctx["modality"], "generated_at": now, "disclaimer": PLAN_DISCLAIMER}


# ── Meta do dia ajustada pela carga de treino ──────────────────

@router.get("/today-target")
async def today_target(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    today = today_str()

    plan_doc = await db.nutrition_plans.find_one({"user_id": user_id})
    plan = plan_doc.get("plan") if plan_doc else None
    if plan:
        base = {
            "calories": plan.get("daily_calories") or 0,
            "protein_g": plan.get("protein_g") or 0,
            "carbs_g": plan.get("carbs_g") or 0,
            "fat_g": plan.get("fat_g") or 0,
        }
        source = "plano"
    else:
        goals = user.get("goals") or Goals().model_dump()
        base = {
            "calories": goals.get("calories") or 0,
            "protein_g": goals.get("protein") or 0,
            "carbs_g": 0,
            "fat_g": 0,
        }
        source = "metas"

    today_tss = 0
    async for a in db.activities.find(
        {"user_id": user_id, "start_date_local": {"$regex": f"^{today}"}},
        {"icu_training_load": 1},
    ):
        today_tss += a.get("icu_training_load") or 0
    today_tss = round(today_tss)

    is_training_day = today_tss >= 30
    extra_kcal = min(round(today_tss * 6), 700) if is_training_day else 0

    # Interconexão: prova de hoje e sinais de recuperação (sono/fadiga do
    # check-in) ajustam o contexto nutricional — combustível para o trabalho
    # exigido, sem depender do serviço de ML (latência/fail-open).
    race_today = await db.races.find_one(
        {"user_id": user_id, "deleted_at": None, "date": today}, {"name": 1},
    )
    checkin = await db.habits.find_one(
        {"user_id": user_id, "date": today}, {"fatigue": 1, "sleep_hours": 1},
    ) or {}
    fatigue = checkin.get("fatigue")
    sleep_h = checkin.get("sleep_hours")
    needs_recovery = (fatigue is not None and fatigue >= 4) or (sleep_h is not None and sleep_h < 6)

    adjusted = dict(base)
    adjusted["calories"] = base["calories"] + extra_kcal
    if extra_kcal:
        adjusted["carbs_g"] = (base["carbs_g"] or 0) + round(extra_kcal / 4)

    if race_today:
        context = "race"
        message = ("Dia de prova: priorize carboidrato de fácil digestão e "
                   "hidratação. Não experimente nada novo hoje.")
        # Garante um piso alto de carboidrato (carb load).
        ref_kcal = adjusted["calories"] or base["calories"] or 2000
        adjusted["carbs_g"] = max(adjusted["carbs_g"], round(ref_kcal * 0.6 / 4))
    elif is_training_day:
        context = "training"
        message = (f"Combustível para o treino de hoje: +{extra_kcal} kcal, "
                   "com foco em carboidrato ao redor da sessão.")
    elif needs_recovery:
        context = "recovery"
        message = ("Dia de recuperação: mantenha a proteína e a hidratação; "
                   "segure o excesso de carboidrato.")
    else:
        context = "rest"
        message = "Dia leve: coma conforme a fome, mantendo proteína e vegetais."

    return {
        **adjusted,
        "source": source,
        "is_training_day": is_training_day,
        "today_tss": today_tss,
        "extra_kcal": extra_kcal,
        "is_race_day": bool(race_today),
        "context": context,
        "message": message,
    }


# ── Receitas fit com o que tem em casa (IA) ────────────────────

def _json_from_ai(raw: str) -> dict:
    raw = (raw or "").strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1].removeprefix("json").strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start, end = raw.find("{"), raw.rfind("}")
        if start < 0 or end <= start:
            raise HTTPException(502, "Resposta invalida da IA")
        return json.loads(raw[start:end + 1])


@router.post("/recipe-ideas", dependencies=[Depends(rate_limit("recipe_ideas", 10, 3600))])
async def recipe_ideas(data: RecipeIdeasIn, user: dict = Depends(current_user)):
    ingredients = [i.strip() for i in data.ingredients if i.strip()][:30]
    if not ingredients:
        raise HTTPException(400, "Informe ao menos um ingrediente")

    system = (
        "Voce e um chef de nutricao esportiva. Crie 1 a 2 receitas FIT usando "
        "PRINCIPALMENTE os ingredientes que o usuario tem em casa (pode assumir "
        "basicos: sal, agua, azeite, temperos). Sugestoes praticas e saudaveis. "
        "NAO faca prescricao medica. Responda SOMENTE JSON valido, sem markdown e "
        "sem texto fora do JSON, no formato: "
        '{"recipes":[{"name":"", "ingredients":[""], "steps":[""], "calories":0, '
        '"protein_g":0, "carbs_g":0, "fat_g":0, "prep_minutes":0}]}'
    )
    prompt = "Ingredientes disponiveis: " + ", ".join(ingredients)
    if data.meal_type:
        prompt += f"\nTipo de refeicao desejado: {data.meal_type}"

    try:
        raw = await complete_text(
            session_id=f"recipe-{user['_id']}",
            system=system,
            prompt=prompt,
            provider=settings.coach_provider,
            model=settings.coach_model,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, "Falha ao gerar receitas") from exc

    parsed = _json_from_ai(raw)
    return {"recipes": parsed.get("recipes", [])}


# ── Manual entry ────────────────────────────────────────────────


@router.post("/manual")
async def create_manual_meal(
    data: ManualMealIn,
    user: dict = Depends(current_user),
):
    user_id = str(user["_id"])
    items = [i.model_dump() for i in data.items]
    totals = _sum_items(items)
    meal = {
        "user_id": user_id,
        "date": today_str(),
        "meal_type": data.meal_type,
        "source": "manual",
        "photo_file_id": None,
        "title": data.title,
        "items": items,
        **totals,
        "health_score": 0,
        "coach_note": "",
        "ai_failed": False,
        "notes": data.notes,
        "created_at": now_utc(),
        "deleted_at": None,
    }
    result = await db.meals.insert_one(meal)
    meal.pop("_id", None)
    meal["id"] = str(result.inserted_id)
    meal["photo_url"] = None
    return meal


# ── Edit meal (AI or manual) ───────────────────────────────────


@router.put("/{meal_id}")
async def edit_meal(
    meal_id: str,
    data: MealEditIn,
    user: dict = Depends(current_user),
):
    if not ObjectId.is_valid(meal_id):
        raise HTTPException(404, "Refeicao nao encontrada")
    meal = await db.meals.find_one(
        {"_id": ObjectId(meal_id), "user_id": str(user["_id"]), "deleted_at": None}
    )
    if not meal:
        raise HTTPException(404, "Refeicao nao encontrada")

    update: dict = {"updated_at": now_utc()}
    if data.title is not None:
        update["title"] = data.title
    if data.meal_type is not None:
        update["meal_type"] = data.meal_type
    if data.notes is not None:
        update["notes"] = data.notes
    if data.items is not None:
        items = [i.model_dump() for i in data.items]
        update["items"] = items
        totals = _sum_items(items)
        update.update(totals)

    await db.meals.update_one({"_id": meal["_id"]}, {"$set": update})
    updated = await db.meals.find_one({"_id": meal["_id"]})
    if not updated:
        raise HTTPException(404, "Refeicao nao encontrada")
    file_document = await ensure_legacy_meal_file(updated)
    return _serialize_meal(updated, file_document)


# ── List meals (single day) ────────────────────────────────────


@router.get("")
async def list_meals(
    date: str | None = Query(None), user: dict = Depends(current_user)
):
    target_date = date or today_str()
    meals = (
        await db.meals.find(
            {
                "user_id": str(user["_id"]),
                "date": target_date,
                "deleted_at": None,
            }
        )
        .sort("created_at", 1)
        .to_list(100)
    )
    macro_keys = ["calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sodium_mg", "sugar_g"]
    totals = {k: 0 for k in macro_keys}
    for meal in meals:
        file_document = await ensure_legacy_meal_file(meal)
        _serialize_meal(meal, file_document)
        for key in totals:
            totals[key] += meal.get(key, 0) or 0
    return {
        "meals": meals,
        "totals": totals,
        "date": target_date,
        "goals": user.get("goals", Goals().model_dump()),
    }


# ── Weekly history ──────────────────────────────────────────────


@router.get("/weekly")
async def weekly_history(
    start: str | None = Query(None),
    user: dict = Depends(current_user),
):
    from datetime import datetime

    if start:
        try:
            base = datetime.strptime(start, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(400, "Formato de data invalido (YYYY-MM-DD)")
    else:
        base = now_utc()

    dates = [(base - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
    user_id = str(user["_id"])

    pipeline: list[dict[str, object]] = [
        {"$match": {"user_id": user_id, "date": {"$in": dates}, "deleted_at": None}},
        {"$group": {
            "_id": "$date",
            "calories": {"$sum": "$calories"},
            "protein_g": {"$sum": "$protein_g"},
            "carbs_g": {"$sum": "$carbs_g"},
            "fat_g": {"$sum": "$fat_g"},
            "fiber_g": {"$sum": {"$ifNull": ["$fiber_g", 0]}},
            "sodium_mg": {"$sum": {"$ifNull": ["$sodium_mg", 0]}},
            "sugar_g": {"$sum": {"$ifNull": ["$sugar_g", 0]}},
            "meal_count": {"$sum": 1},
        }},
        {"$sort": {"_id": -1}},
    ]
    cursor = await db.meals.aggregate(pipeline)
    agg = await cursor.to_list(7)

    by_date = {d["_id"]: {**d, "date": d.pop("_id")} for d in agg}
    days = []
    for d in sorted(dates):
        if d in by_date:
            days.append(by_date[d])
        else:
            days.append({
                "date": d, "calories": 0, "protein_g": 0, "carbs_g": 0,
                "fat_g": 0, "fiber_g": 0, "sodium_mg": 0, "sugar_g": 0, "meal_count": 0,
            })
    return {"days": days, "goals": user.get("goals", Goals().model_dump())}


# ── Delete meal ─────────────────────────────────────────────────


@router.delete("/{meal_id}")
async def delete_meal(meal_id: str, user: dict = Depends(current_user)):
    if not ObjectId.is_valid(meal_id):
        raise HTTPException(404, "Refeicao nao encontrada")
    meal = await db.meals.find_one(
        {
            "_id": ObjectId(meal_id),
            "user_id": str(user["_id"]),
            "deleted_at": None,
        }
    )
    if not meal:
        raise HTTPException(404, "Refeicao nao encontrada")
    file_document = await ensure_legacy_meal_file(meal)
    if file_document:
        await delete_file(file_document, legacy_delete=legacy_storage.delete)
    await db.meals.update_one(
        {"_id": meal["_id"], "user_id": str(user["_id"])},
        {"$set": {"deleted_at": now_utc()}},
    )
    return {"ok": True}


# ── Favorites ───────────────────────────────────────────────────


@router.post("/favorites")
async def create_favorite(
    data: FavoriteIn,
    user: dict = Depends(current_user),
):
    user_id = str(user["_id"])
    existing = await db.meal_favorites.count_documents(
        {"user_id": user_id, "deleted_at": None}
    )
    if existing >= 100:
        raise HTTPException(400, "Limite de 100 favoritos atingido")
    fav = {
        "user_id": user_id,
        "name": data.name,
        "meal_type": data.meal_type,
        "items": [i.model_dump() for i in data.items],
        "created_at": now_utc(),
        "deleted_at": None,
    }
    result = await db.meal_favorites.insert_one(fav)
    fav["id"] = str(result.inserted_id)
    del fav["_id"]
    return fav


@router.get("/favorites")
async def list_favorites(user: dict = Depends(current_user)):
    favs = (
        await db.meal_favorites.find(
            {"user_id": str(user["_id"]), "deleted_at": None}
        )
        .sort("name", 1)
        .to_list(100)
    )
    for f in favs:
        f["id"] = str(f.pop("_id"))
    return {"favorites": favs}


@router.delete("/favorites/{fav_id}")
async def delete_favorite(fav_id: str, user: dict = Depends(current_user)):
    if not ObjectId.is_valid(fav_id):
        raise HTTPException(404, "Favorito nao encontrado")
    result = await db.meal_favorites.update_one(
        {"_id": ObjectId(fav_id), "user_id": str(user["_id"]), "deleted_at": None},
        {"$set": {"deleted_at": now_utc()}},
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Favorito nao encontrado")
    return {"ok": True}


@router.post("/favorites/{fav_id}/use")
async def use_favorite(fav_id: str, user: dict = Depends(current_user)):
    if not ObjectId.is_valid(fav_id):
        raise HTTPException(404, "Favorito nao encontrado")
    fav = await db.meal_favorites.find_one(
        {"_id": ObjectId(fav_id), "user_id": str(user["_id"]), "deleted_at": None}
    )
    if not fav:
        raise HTTPException(404, "Favorito nao encontrado")
    items = fav["items"]
    totals = _sum_items(items)
    meal = {
        "user_id": str(user["_id"]),
        "date": today_str(),
        "meal_type": fav.get("meal_type", "meal"),
        "source": "favorite",
        "photo_file_id": None,
        "title": fav["name"],
        "items": items,
        **totals,
        "health_score": 0,
        "coach_note": "",
        "ai_failed": False,
        "notes": "",
        "created_at": now_utc(),
        "deleted_at": None,
    }
    result = await db.meals.insert_one(meal)
    meal.pop("_id", None)
    meal["id"] = str(result.inserted_id)
    meal["photo_url"] = None
    return meal


# ── Recipes ─────────────────────────────────────────────────────


@router.post("/recipes")
async def create_recipe(
    data: RecipeIn,
    user: dict = Depends(current_user),
):
    user_id = str(user["_id"])
    existing = await db.meal_recipes.count_documents(
        {"user_id": user_id, "deleted_at": None}
    )
    if existing >= 50:
        raise HTTPException(400, "Limite de 50 receitas atingido")
    items = [i.model_dump() for i in data.items]
    totals = _sum_items(items)
    recipe = {
        "user_id": user_id,
        "name": data.name,
        "servings": data.servings,
        "items": items,
        "totals_per_recipe": totals,
        "totals_per_serving": {k: round(v / data.servings, 1) for k, v in totals.items()},
        "instructions": data.instructions,
        "created_at": now_utc(),
        "deleted_at": None,
    }
    result = await db.meal_recipes.insert_one(recipe)
    recipe["id"] = str(result.inserted_id)
    del recipe["_id"]
    return recipe


@router.get("/recipes")
async def list_recipes(user: dict = Depends(current_user)):
    recipes = (
        await db.meal_recipes.find(
            {"user_id": str(user["_id"]), "deleted_at": None}
        )
        .sort("name", 1)
        .to_list(50)
    )
    for r in recipes:
        r["id"] = str(r.pop("_id"))
    return {"recipes": recipes}


@router.delete("/recipes/{recipe_id}")
async def delete_recipe(recipe_id: str, user: dict = Depends(current_user)):
    if not ObjectId.is_valid(recipe_id):
        raise HTTPException(404, "Receita nao encontrada")
    result = await db.meal_recipes.update_one(
        {"_id": ObjectId(recipe_id), "user_id": str(user["_id"]), "deleted_at": None},
        {"$set": {"deleted_at": now_utc()}},
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Receita nao encontrada")
    return {"ok": True}


@router.post("/recipes/{recipe_id}/use")
async def use_recipe(
    recipe_id: str,
    servings: int = Query(default=1, ge=1, le=50),
    user: dict = Depends(current_user),
):
    if not ObjectId.is_valid(recipe_id):
        raise HTTPException(404, "Receita nao encontrada")
    recipe = await db.meal_recipes.find_one(
        {"_id": ObjectId(recipe_id), "user_id": str(user["_id"]), "deleted_at": None}
    )
    if not recipe:
        raise HTTPException(404, "Receita nao encontrada")
    per_serving = recipe["totals_per_serving"]
    scaled = {k: round(v * servings, 1) for k, v in per_serving.items()}
    items = recipe["items"]
    meal = {
        "user_id": str(user["_id"]),
        "date": today_str(),
        "meal_type": "meal",
        "source": "recipe",
        "photo_file_id": None,
        "title": f"{recipe['name']} ({servings}x)",
        "items": items,
        **scaled,
        "health_score": 0,
        "coach_note": "",
        "ai_failed": False,
        "notes": "",
        "created_at": now_utc(),
        "deleted_at": None,
    }
    result = await db.meals.insert_one(meal)
    meal.pop("_id", None)
    meal["id"] = str(result.inserted_id)
    meal["photo_url"] = None
    return meal
