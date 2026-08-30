from fastapi import APIRouter, Depends

from app.database import db
from app.dependencies import current_user
from app.models import SettingsIn
from app.security import public_user


router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("")
async def get_settings(user: dict = Depends(current_user)):
    return public_user(user)


@router.put("")
async def update_settings(data: SettingsIn, user: dict = Depends(current_user)):
    update: dict[str, object] = {}
    if data.name is not None:
        update["name"] = data.name
    if data.intervals_api_key is not None:
        update["intervals_api_key"] = data.intervals_api_key.strip() or None
    if data.intervals_athlete_id is not None:
        update["intervals_athlete_id"] = data.intervals_athlete_id.strip() or "0"
    if data.goals is not None:
        update["goals"] = data.goals.model_dump()
    if data.coach_tone is not None:
        update["coach_tone"] = data.coach_tone
    if update:
        await db.users.update_one({"_id": user["_id"]}, {"$set": update})
    fresh = await db.users.find_one({"_id": user["_id"]})
    if fresh is None:
        raise RuntimeError("Usuario desapareceu durante a atualizacao")
    return public_user(fresh)
