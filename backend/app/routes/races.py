from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.database import db
from app.dependencies import current_user
from app.models import RaceIn
from app.models.race_plan import ChecklistIn, RaceRetrospectiveIn, RaceStrategyIn
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


async def _get_race(race_id: str, user_id: str) -> dict:
    if not ObjectId.is_valid(race_id):
        raise HTTPException(404, "Prova nao encontrada")
    doc = await db.races.find_one(
        {"_id": ObjectId(race_id), "user_id": user_id, "deleted_at": None}
    )
    if not doc:
        raise HTTPException(404, "Prova nao encontrada")
    return doc


# ---------------------------------------------------------------------------
# Checklist
# ---------------------------------------------------------------------------

DEFAULT_CHECKLIST_ITEMS = [
    {"text": "Documento de identidade", "category": "documents", "checked": False},
    {"text": "Comprovante de inscrição", "category": "documents", "checked": False},
    {"text": "Atestado médico", "category": "documents", "checked": False},
    {"text": "Wetsuit / roupa de borracha", "category": "equipment", "checked": False},
    {"text": "Bike revisada", "category": "equipment", "checked": False},
    {"text": "Capacete", "category": "equipment", "checked": False},
    {"text": "Tênis de corrida", "category": "equipment", "checked": False},
    {"text": "Óculos de natação", "category": "equipment", "checked": False},
    {"text": "Sapatilha de ciclismo", "category": "equipment", "checked": False},
    {"text": "Gel / carboidrato", "category": "nutrition", "checked": False},
    {"text": "Isotônico / eletrólitos", "category": "nutrition", "checked": False},
    {"text": "Garrafa / caramanhola", "category": "nutrition", "checked": False},
    {"text": "Organizar área de transição", "category": "transition", "checked": False},
    {"text": "Testar equipamento na véspera", "category": "logistics", "checked": False},
    {"text": "Verificar horário de largada", "category": "logistics", "checked": False},
]


@router.get("/{race_id}/checklist")
async def get_checklist(race_id: str, user: dict = Depends(current_user)):
    doc = await _get_race(race_id, str(user["_id"]))
    items = doc.get("checklist", DEFAULT_CHECKLIST_ITEMS)
    return {"checklist": items}


@router.put("/{race_id}/checklist")
async def update_checklist(
    race_id: str, data: ChecklistIn, user: dict = Depends(current_user),
):
    await _get_race(race_id, str(user["_id"]))
    items = [i.model_dump() for i in data.items]
    await db.races.update_one(
        {"_id": ObjectId(race_id)},
        {"$set": {"checklist": items, "updated_at": now_utc()}},
    )
    return {"checklist": items}


@router.put("/{race_id}/checklist/{item_index}/toggle")
async def toggle_checklist_item(
    race_id: str, item_index: int, user: dict = Depends(current_user),
):
    doc = await _get_race(race_id, str(user["_id"]))
    items = doc.get("checklist", DEFAULT_CHECKLIST_ITEMS)
    if item_index < 0 or item_index >= len(items):
        raise HTTPException(400, "Indice invalido")
    items[item_index]["checked"] = not items[item_index]["checked"]
    await db.races.update_one(
        {"_id": ObjectId(race_id)},
        {"$set": {"checklist": items, "updated_at": now_utc()}},
    )
    return {"checklist": items}


# ---------------------------------------------------------------------------
# Estratégia de prova
# ---------------------------------------------------------------------------

@router.get("/{race_id}/strategy")
async def get_strategy(race_id: str, user: dict = Depends(current_user)):
    doc = await _get_race(race_id, str(user["_id"]))
    return {"strategy": doc.get("strategy", {})}


@router.put("/{race_id}/strategy")
async def update_strategy(
    race_id: str, data: RaceStrategyIn, user: dict = Depends(current_user),
):
    await _get_race(race_id, str(user["_id"]))
    strategy = data.model_dump(exclude_none=True)
    await db.races.update_one(
        {"_id": ObjectId(race_id)},
        {"$set": {"strategy": strategy, "updated_at": now_utc()}},
    )
    return {"strategy": strategy}


# ---------------------------------------------------------------------------
# Retrospectiva pós-prova
# ---------------------------------------------------------------------------

@router.get("/{race_id}/retrospective")
async def get_retrospective(race_id: str, user: dict = Depends(current_user)):
    doc = await _get_race(race_id, str(user["_id"]))
    return {"retrospective": doc.get("retrospective", {})}


@router.put("/{race_id}/retrospective")
async def update_retrospective(
    race_id: str, data: RaceRetrospectiveIn, user: dict = Depends(current_user),
):
    await _get_race(race_id, str(user["_id"]))
    retro = data.model_dump()
    await db.races.update_one(
        {"_id": ObjectId(race_id)},
        {"$set": {"retrospective": retro, "updated_at": now_utc()}},
    )
    return {"retrospective": retro}


# ---------------------------------------------------------------------------
# Duplicar checklist e estratégia para outra prova
# ---------------------------------------------------------------------------

@router.post("/{race_id}/duplicate-plan-to/{target_race_id}")
async def duplicate_plan(
    race_id: str, target_race_id: str, user: dict = Depends(current_user),
):
    user_id = str(user["_id"])
    source = await _get_race(race_id, user_id)
    await _get_race(target_race_id, user_id)

    update: dict = {"updated_at": now_utc()}
    if "checklist" in source:
        unchecked = [{**i, "checked": False} for i in source["checklist"]]
        update["checklist"] = unchecked
    if "strategy" in source:
        update["strategy"] = source["strategy"]

    await db.races.update_one({"_id": ObjectId(target_race_id)}, {"$set": update})
    return {"ok": True}
