from fastapi import APIRouter, Depends

from app.database import db
from app.dependencies import current_user
from app.models import NutritionProfileIn, SportProfileIn
from app.services.audit import audit_event
from app.services.fitness_level import recommend_complementary_level
from app.utils.time import now_utc


router = APIRouter(prefix="/profile", tags=["profile"])


def _serialize(document: dict | None) -> dict:
    document = document or {}
    sport = document.get("sport") or {}
    assessment = sport.get("self_assessment") or {}
    recommendation = recommend_complementary_level(assessment)
    override = sport.get("complementary_level_override")
    effective = override or recommendation["level"]
    return {
        "onboarding_completed": bool(document.get("onboarding_completed_at")),
        "sport": sport or None,
        "nutrition": document.get("nutrition") or None,
        "complementary_level": {
            "recommended": recommendation["level"],
            "reasons": recommendation["reasons"],
            "effective": effective,
            "source": "manual" if override else "recommended",
        },
    }


@router.get("")
async def get_profile(user: dict = Depends(current_user)):
    document = await db.profiles.find_one({"user_id": str(user["_id"])})
    return _serialize(document)


@router.put("/sport")
async def put_sport_profile(data: SportProfileIn, user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    existing = await db.profiles.find_one({"user_id": user_id})
    now = now_utc()
    update = {
        "sport": data.model_dump(),
        "updated_at": now,
    }
    if existing is None or not existing.get("onboarding_completed_at"):
        update["onboarding_completed_at"] = now
    await db.profiles.update_one(
        {"user_id": user_id},
        {"$set": update, "$setOnInsert": {"user_id": user_id, "created_at": now}},
        upsert=True,
    )
    await audit_event(
        actor_user_id=user_id,
        action="profile.sport.updated",
        resource_type="profile",
        resource_id=user_id,
    )
    fresh = await db.profiles.find_one({"user_id": user_id})
    return _serialize(fresh)


@router.put("/nutrition")
async def put_nutrition_profile(data: NutritionProfileIn, user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    now = now_utc()
    await db.profiles.update_one(
        {"user_id": user_id},
        {
            "$set": {"nutrition": data.model_dump(), "updated_at": now},
            "$setOnInsert": {"user_id": user_id, "created_at": now},
        },
        upsert=True,
    )
    await audit_event(
        actor_user_id=user_id,
        action="profile.nutrition.updated",
        resource_type="profile",
        resource_id=user_id,
    )
    fresh = await db.profiles.find_one({"user_id": user_id})
    return _serialize(fresh)
