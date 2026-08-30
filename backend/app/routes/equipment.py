from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.database import db
from app.dependencies import current_user
from app.models.equipment import EquipmentIn
from app.utils.time import now_utc

router = APIRouter(prefix="/equipment", tags=["equipment"])


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    doc.pop("user_id", None)
    return doc


@router.get("")
async def list_equipment(user: dict = Depends(current_user)):
    docs = await db.equipment.find(
        {"user_id": str(user["_id"]), "deleted_at": None}
    ).sort("created_at", -1).to_list(200)
    return {"equipment": [_serialize(d) for d in docs]}


@router.post("", status_code=201)
async def create_equipment(data: EquipmentIn, user: dict = Depends(current_user)):
    now = now_utc()
    doc = {
        "user_id": str(user["_id"]),
        **data.model_dump(),
        "total_distance_km": 0.0,
        "total_hours": 0.0,
        "maintenance_log": [],
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    }
    result = await db.equipment.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


@router.get("/{equipment_id}")
async def get_equipment(equipment_id: str, user: dict = Depends(current_user)):
    if not ObjectId.is_valid(equipment_id):
        raise HTTPException(404, "Equipamento nao encontrado")
    doc = await db.equipment.find_one(
        {"_id": ObjectId(equipment_id), "user_id": str(user["_id"]), "deleted_at": None}
    )
    if not doc:
        raise HTTPException(404, "Equipamento nao encontrado")
    return _serialize(doc)


@router.put("/{equipment_id}")
async def update_equipment(
    equipment_id: str, data: EquipmentIn, user: dict = Depends(current_user),
):
    if not ObjectId.is_valid(equipment_id):
        raise HTTPException(404, "Equipamento nao encontrado")
    result = await db.equipment.update_one(
        {"_id": ObjectId(equipment_id), "user_id": str(user["_id"]), "deleted_at": None},
        {"$set": {**data.model_dump(), "updated_at": now_utc()}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Equipamento nao encontrado")
    doc = await db.equipment.find_one({"_id": ObjectId(equipment_id)})
    if not doc:
        raise HTTPException(404, "Equipamento nao encontrado")
    return _serialize(doc)


@router.delete("/{equipment_id}")
async def delete_equipment(equipment_id: str, user: dict = Depends(current_user)):
    if not ObjectId.is_valid(equipment_id):
        raise HTTPException(404, "Equipamento nao encontrado")
    result = await db.equipment.update_one(
        {"_id": ObjectId(equipment_id), "user_id": str(user["_id"]), "deleted_at": None},
        {"$set": {"deleted_at": now_utc()}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Equipamento nao encontrado")
    return {"ok": True}


@router.post("/{equipment_id}/add-usage")
async def add_usage(
    equipment_id: str,
    user: dict = Depends(current_user),
    distance_km: float = 0.0,
    hours: float = 0.0,
):
    if not ObjectId.is_valid(equipment_id):
        raise HTTPException(404, "Equipamento nao encontrado")
    result = await db.equipment.update_one(
        {"_id": ObjectId(equipment_id), "user_id": str(user["_id"]), "deleted_at": None},
        {
            "$inc": {"total_distance_km": distance_km, "total_hours": hours},
            "$set": {"updated_at": now_utc()},
        },
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Equipamento nao encontrado")
    doc = await db.equipment.find_one({"_id": ObjectId(equipment_id)})
    if not doc:
        raise HTTPException(404, "Equipamento nao encontrado")
    return _serialize(doc)


@router.post("/{equipment_id}/maintenance")
async def log_maintenance(
    equipment_id: str,
    user: dict = Depends(current_user),
    description: str = "Manutenção realizada",
):
    if not ObjectId.is_valid(equipment_id):
        raise HTTPException(404, "Equipamento nao encontrado")
    now = now_utc()
    doc = await db.equipment.find_one(
        {"_id": ObjectId(equipment_id), "user_id": str(user["_id"]), "deleted_at": None}
    )
    if not doc:
        raise HTTPException(404, "Equipamento nao encontrado")

    entry = {
        "date": now.strftime("%Y-%m-%d"),
        "description": description,
        "distance_at": doc.get("total_distance_km", 0),
        "hours_at": doc.get("total_hours", 0),
    }
    await db.equipment.update_one(
        {"_id": ObjectId(equipment_id)},
        {"$push": {"maintenance_log": entry}, "$set": {"updated_at": now}},
    )
    return {"ok": True, "entry": entry}


@router.get("/{equipment_id}/alerts")
async def equipment_alerts(equipment_id: str, user: dict = Depends(current_user)):
    if not ObjectId.is_valid(equipment_id):
        raise HTTPException(404, "Equipamento nao encontrado")
    doc = await db.equipment.find_one(
        {"_id": ObjectId(equipment_id), "user_id": str(user["_id"]), "deleted_at": None}
    )
    if not doc:
        raise HTTPException(404, "Equipamento nao encontrado")

    alerts: list[dict] = []
    total_km = doc.get("total_distance_km", 0)
    total_h = doc.get("total_hours", 0)
    max_km = doc.get("max_distance_km")
    max_h = doc.get("max_hours")
    maint_km = doc.get("maintenance_interval_km")
    maint_h = doc.get("maintenance_interval_hours")

    if max_km and total_km >= max_km * 0.9:
        pct = round(total_km / max_km * 100)
        alerts.append({
            "type": "replacement",
            "severity": "high" if total_km >= max_km else "medium",
            "message": f"Distância em {pct}% da vida útil ({total_km:.0f}/{max_km:.0f} km).",
        })

    if max_h and total_h >= max_h * 0.9:
        pct = round(total_h / max_h * 100)
        alerts.append({
            "type": "replacement",
            "severity": "high" if total_h >= max_h else "medium",
            "message": f"Horas em {pct}% da vida útil ({total_h:.0f}/{max_h:.0f} h).",
        })

    if maint_km:
        last_maint_km = 0
        for m in doc.get("maintenance_log", []):
            last_maint_km = max(last_maint_km, m.get("distance_at", 0))
        since = total_km - last_maint_km
        if since >= maint_km * 0.9:
            alerts.append({
                "type": "maintenance",
                "severity": "high" if since >= maint_km else "medium",
                "message": f"Manutenção: {since:.0f} km desde a última ({maint_km:.0f} km intervalo).",
            })

    if maint_h:
        last_maint_h = 0
        for m in doc.get("maintenance_log", []):
            last_maint_h = max(last_maint_h, m.get("hours_at", 0))
        since = total_h - last_maint_h
        if since >= maint_h * 0.9:
            alerts.append({
                "type": "maintenance",
                "severity": "high" if since >= maint_h else "medium",
                "message": f"Manutenção: {since:.0f} h desde a última ({maint_h:.0f} h intervalo).",
            })

    return {"alerts": alerts}
