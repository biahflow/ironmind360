from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

from app.adapters.ai import analyze_food_image
from app.adapters.legacy_storage import legacy_storage
from app.database import db
from app.dependencies import current_user
from app.models import Goals
from app.rate_limit import rate_limit
from app.services.files import create_file, delete_file, ensure_legacy_meal_file
from app.utils.time import now_utc, today_str


router = APIRouter(prefix="/nutrition", tags=["nutrition"])


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
    analysis = await analyze_food_image(content)
    stored_file = await create_file(
        owner_user_id=user_id,
        data=content,
        content_type=content_type,
        original_name=file.filename,
    )
    meal = {
        "user_id": user_id,
        "date": today_str(),
        "meal_type": meal_type,
        "photo_file_id": stored_file["_id"],
        "title": analysis.get("title", "Refeicao"),
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
    try:
        result = await db.meals.insert_one(meal)
    except Exception:
        await delete_file(stored_file)
        raise
    meal["id"] = str(result.inserted_id)
    meal["photo_url"] = f"/api/v1/files/{stored_file['_id']}"
    return meal


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
    totals = {"calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0}
    for meal in meals:
        file_document = await ensure_legacy_meal_file(meal)
        meal["id"] = str(meal.pop("_id"))
        meal["photo_url"] = (
            f"/api/v1/files/{file_document['_id']}" if file_document else None
        )
        for key in totals:
            totals[key] += meal.get(key, 0) or 0
    return {
        "meals": meals,
        "totals": totals,
        "date": target_date,
        "goals": user.get("goals", Goals().model_dump()),
    }


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
