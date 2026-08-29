from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.database import db
from app.dependencies import current_user
from app.models import RaceIn
from app.services.audit import audit_event
from app.utils.time import now_utc


router = APIRouter(prefix="/races", tags=["races"])


def _serialize(document: dict) -> dict:
    document["id"] = str(document.pop("_id"))
    document.pop("user_id", None)
    return document


@router.get("")
async def list_races(user: dict = Depends(current_user)):
    documents = (
        await db.races.find({"user_id": str(user["_id"]), "deleted_at": None})
        .sort("date", 1)
        .to_list(200)
    )
    return {"races": [_serialize(d) for d in documents]}


@router.post("", status_code=201)
async def create_race(data: RaceIn, user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    now = now_utc()
    document = {
        "user_id": user_id,
        **data.model_dump(),
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    }
    result = await db.races.insert_one(document)
    document["_id"] = result.inserted_id
    await audit_event(
        actor_user_id=user_id,
        action="race.created",
        resource_type="race",
        resource_id=str(result.inserted_id),
    )
    return _serialize(document)


@router.put("/{race_id}")
async def update_race(race_id: str, data: RaceIn, user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    if not ObjectId.is_valid(race_id):
        raise HTTPException(404, "Prova nao encontrada")
    result = await db.races.update_one(
        {"_id": ObjectId(race_id), "user_id": user_id, "deleted_at": None},
        {"$set": {**data.model_dump(), "updated_at": now_utc()}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Prova nao encontrada")
    document = await db.races.find_one({"_id": ObjectId(race_id)})
    if document is None:
        raise HTTPException(404, "Prova nao encontrada")
    await audit_event(
        actor_user_id=user_id,
        action="race.updated",
        resource_type="race",
        resource_id=race_id,
    )
    return _serialize(document)


@router.delete("/{race_id}")
async def delete_race(race_id: str, user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    if not ObjectId.is_valid(race_id):
        raise HTTPException(404, "Prova nao encontrada")
    result = await db.races.update_one(
        {"_id": ObjectId(race_id), "user_id": user_id, "deleted_at": None},
        {"$set": {"deleted_at": now_utc()}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Prova nao encontrada")
    await audit_event(
        actor_user_id=user_id,
        action="race.deleted",
        resource_type="race",
        resource_id=race_id,
    )
    return {"ok": True}
