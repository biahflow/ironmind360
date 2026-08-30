from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import db
from app.dependencies import current_user
from app.models.wearables import WearableBatchIn, WearablePermissionIn
from app.utils.time import now_utc


router = APIRouter(tags=["wearables"])

VALID_SOURCES = {"apple_health", "health_connect"}


# --------------- Permissoes ---------------


@router.put("/wearable-permissions")
async def set_permissions(data: WearablePermissionIn, user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    now = now_utc()
    await db.wearable_permissions.update_one(
        {"user_id": user_id, "source": data.source},
        {"$set": {
            "data_types": list(data.data_types),
            "updated_at": now,
        }, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    doc = await db.wearable_permissions.find_one({"user_id": user_id, "source": data.source})
    if not doc:
        raise HTTPException(500, "Falha ao persistir permissao")
    return {
        "source": doc["source"],
        "data_types": doc["data_types"],
        "updated_at": doc["updated_at"].isoformat() if doc.get("updated_at") else None,
    }


@router.get("/wearable-permissions")
async def get_permissions(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    docs = await db.wearable_permissions.find({"user_id": user_id}).to_list(10)
    return {
        "permissions": [
            {
                "source": d["source"],
                "data_types": d["data_types"],
                "updated_at": d["updated_at"].isoformat() if d.get("updated_at") else None,
            }
            for d in docs
        ]
    }


@router.delete("/wearable-permissions/{source}")
async def revoke_permissions(source: str, user: dict = Depends(current_user)):
    if source not in VALID_SOURCES:
        raise HTTPException(400, "Fonte invalida")
    user_id = str(user["_id"])
    result = await db.wearable_permissions.delete_one({"user_id": user_id, "source": source})
    if result.deleted_count == 0:
        raise HTTPException(404, "Permissao nao encontrada")
    now = now_utc()
    await db.wearable_data.update_many(
        {"user_id": user_id, "source": source, "deleted_at": None},
        {"$set": {"deleted_at": now}},
    )
    return {"ok": True, "source": source}


# --------------- Dados ---------------


def _parse_timestamp(ts: str) -> datetime | None:
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"):
        try:
            return datetime.strptime(ts, fmt)
        except ValueError:
            continue
    return None


@router.post("/wearable-data")
async def import_data(data: WearableBatchIn, user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    perm = await db.wearable_permissions.find_one({"user_id": user_id, "source": data.source})
    if not perm:
        raise HTTPException(403, "Permissao nao concedida para esta fonte")
    allowed = set(perm["data_types"])
    now = now_utc()
    inserted = 0
    updated = 0
    skipped = 0

    for item in data.items:
        if item.data_type not in allowed:
            skipped += 1
            continue

        parsed_ts = _parse_timestamp(item.timestamp)

        if item.data_type == "sleep" and parsed_ts:
            existing = await db.wearable_data.find_one({
                "user_id": user_id,
                "source": data.source,
                "data_type": "sleep",
                "date": item.date,
                "source_id": {"$ne": item.source_id},
                "deleted_at": None,
            })
            if existing:
                existing_ts = existing.get("timestamp_parsed")
                if existing_ts and parsed_ts:
                    diff = abs((parsed_ts - existing_ts).total_seconds())
                    if diff < 1800:
                        skipped += 1
                        continue

        doc = {
            "user_id": user_id,
            "source": data.source,
            "data_type": item.data_type,
            "source_id": item.source_id,
            "timestamp": item.timestamp,
            "timestamp_parsed": parsed_ts,
            "date": item.date,
            "value": item.value,
            "metadata": item.metadata,
            "updated_at": now,
            "deleted_at": None,
        }

        result = await db.wearable_data.update_one(
            {
                "user_id": user_id,
                "source": data.source,
                "data_type": item.data_type,
                "source_id": item.source_id,
            },
            {"$set": doc, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
        if result.upserted_id:
            inserted += 1
        elif result.modified_count:
            updated += 1

    return {"inserted": inserted, "updated": updated, "skipped": skipped}


@router.get("/wearable-data")
async def list_data(
    source: str | None = Query(None),
    data_type: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    limit: int = Query(default=100, ge=1, le=100),
    user: dict = Depends(current_user),
):
    user_id = str(user["_id"])
    query: dict = {"user_id": user_id, "deleted_at": None}
    if source:
        query["source"] = source
    if data_type:
        query["data_type"] = data_type
    if date_from or date_to:
        date_filter: dict = {}
        if date_from:
            date_filter["$gte"] = date_from
        if date_to:
            date_filter["$lte"] = date_to
        query["date"] = date_filter

    docs = await db.wearable_data.find(query).sort("date", -1).to_list(limit)
    items = []
    for d in docs:
        items.append({
            "id": str(d["_id"]),
            "source": d["source"],
            "data_type": d["data_type"],
            "source_id": d["source_id"],
            "timestamp": d["timestamp"],
            "date": d["date"],
            "value": d["value"],
            "metadata": d.get("metadata"),
        })
    return {"data": items, "count": len(items)}


@router.delete("/wearable-data/{source}")
async def delete_source_data(source: str, user: dict = Depends(current_user)):
    if source not in VALID_SOURCES:
        raise HTTPException(400, "Fonte invalida")
    user_id = str(user["_id"])
    result = await db.wearable_data.update_many(
        {"user_id": user_id, "source": source, "deleted_at": None},
        {"$set": {"deleted_at": now_utc()}},
    )
    return {"ok": True, "deleted": result.modified_count}


# --------------- Resumo ---------------


@router.get("/wearable-summary")
async def get_summary(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    base_query = {"user_id": user_id, "deleted_at": None}

    async def _latest(dt: str) -> dict | None:
        doc = await db.wearable_data.find_one(
            {**base_query, "data_type": dt},
            sort=[("date", -1)],
        )
        if not doc:
            return None
        return {
            "source": doc["source"],
            "date": doc["date"],
            "value": doc["value"],
        }

    yesterday = (now_utc() - timedelta(days=1)).strftime("%Y-%m-%d")

    sleep_doc = await db.wearable_data.find_one(
        {**base_query, "data_type": "sleep", "date": {"$gte": yesterday}},
        sort=[("date", -1)],
    )

    return {
        "resting_hr": await _latest("resting_hr"),
        "hrv": await _latest("hrv"),
        "weight": await _latest("weight"),
        "last_sleep": {
            "source": sleep_doc["source"],
            "date": sleep_doc["date"],
            "value": sleep_doc["value"],
        } if sleep_doc else None,
        "sources_connected": [
            d["source"]
            for d in await db.wearable_permissions.find({"user_id": user_id}).to_list(10)
        ],
    }
