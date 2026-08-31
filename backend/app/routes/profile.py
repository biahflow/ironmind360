from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.database import db
from app.dependencies import current_user
from app.models import NutritionProfileIn, SportProfileIn
from app.services.audit import audit_event
from app.services.files import create_file, delete_file, owned_file
from app.services.fitness_level import recommend_complementary_level
from app.utils.time import now_utc


router = APIRouter(prefix="/profile", tags=["profile"])

AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_AVATAR_BYTES = 5 * 1024 * 1024


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


class ThresholdsIn(BaseModel):
    ftp_watts: Optional[int] = Field(default=None, ge=0, le=600)
    lthr_bpm: Optional[int] = Field(default=None, ge=0, le=230)
    max_hr_bpm: Optional[int] = Field(default=None, ge=0, le=230)
    threshold_pace_per_km: Optional[str] = Field(default=None, pattern=r"^\d{1,2}:\d{2}$")


@router.get("/thresholds")
async def get_thresholds(user: dict = Depends(current_user)):
    return user.get("training_thresholds") or {}


@router.put("/thresholds")
async def put_thresholds(data: ThresholdsIn, user: dict = Depends(current_user)):
    thresholds = data.model_dump()
    await db.users.update_one(
        {"_id": user["_id"]}, {"$set": {"training_thresholds": thresholds}}
    )
    return thresholds


@router.put("/avatar")
async def put_avatar(file: UploadFile = File(...), user: dict = Depends(current_user)):
    if file.content_type not in AVATAR_TYPES:
        raise HTTPException(400, "Envie uma imagem JPG, PNG ou WEBP.")
    data = await file.read()
    if not data:
        raise HTTPException(400, "Arquivo vazio.")
    if len(data) > MAX_AVATAR_BYTES:
        raise HTTPException(400, "Imagem muito grande (máx. 5 MB).")
    user_id = str(user["_id"])

    document = await create_file(
        owner_user_id=user_id,
        data=data,
        content_type=file.content_type,
        original_name=file.filename,
    )
    avatar_url = f"/api/v1/files/{document['_id']}"

    previous_file_id = user.get("avatar_file_id")
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"avatar_file_id": document["_id"], "avatar_url": avatar_url}},
    )
    if previous_file_id and previous_file_id != document["_id"]:
        try:
            old = await owned_file(previous_file_id, user_id)
            await delete_file(old)
        except HTTPException:
            pass

    await audit_event(
        actor_user_id=user_id,
        action="profile.avatar.updated",
        resource_type="user",
        resource_id=user_id,
    )
    return {"avatar_url": avatar_url}


@router.delete("/avatar")
async def delete_avatar(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    file_id = user.get("avatar_file_id")
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$unset": {"avatar_file_id": "", "avatar_url": ""}},
    )
    if file_id:
        try:
            document = await owned_file(file_id, user_id)
            await delete_file(document)
        except HTTPException:
            pass
    return {"ok": True}


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
