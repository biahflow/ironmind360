import uuid

from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from app.adapters.storage import S3StorageProvider
from app.database import db
from app.security import now_utc


storage = S3StorageProvider()


async def create_file(
    *, owner_user_id: str, data: bytes, content_type: str, original_name: str | None
) -> dict:
    file_id = str(uuid.uuid4())
    extension = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}.get(
        content_type, "bin"
    )
    storage_key = f"private/{owner_user_id}/{file_id}.{extension}"
    await storage.put(storage_key, data, content_type)
    document: dict = {
        "_id": file_id,
        "owner_user_id": owner_user_id,
        "provider": "s3",
        "storage_key": storage_key,
        "content_type": content_type,
        "size": len(data),
        "original_name": original_name,
        "derivative_ids": [],
        "created_at": now_utc(),
        "deleted_at": None,
    }
    try:
        await db.files.insert_one(document)
    except Exception:
        await storage.delete(storage_key)
        raise
    return document


async def ensure_legacy_meal_file(meal: dict) -> dict | None:
    if meal.get("photo_file_id"):
        return await db.files.find_one({"_id": meal["photo_file_id"]})
    legacy_key = meal.get("storage_path")
    if not legacy_key:
        return None
    file_id = str(uuid.uuid4())
    document: dict | None = {
        "_id": file_id,
        "owner_user_id": meal["user_id"],
        "provider": "legacy_proxy",
        "storage_key": legacy_key,
        "content_type": "image/jpeg",
        "size": None,
        "derivative_ids": [],
        "created_at": meal.get("created_at", now_utc()),
        "deleted_at": None,
    }
    try:
        await db.files.insert_one(document)
    except DuplicateKeyError:
        document = await db.files.find_one(
            {
                "owner_user_id": meal["user_id"],
                "provider": "legacy_proxy",
                "storage_key": legacy_key,
            }
        )
    if document:
        await db.meals.update_one(
            {"_id": meal["_id"], "user_id": meal["user_id"]},
            {"$set": {"photo_file_id": document["_id"]}},
        )
    return document


async def owned_file(file_id: str, owner_user_id: str) -> dict:
    document = await db.files.find_one(
        {"_id": file_id, "owner_user_id": owner_user_id, "deleted_at": None}
    )
    if not document:
        raise HTTPException(404, "Arquivo nao encontrado")
    return document


async def delete_file(document: dict, legacy_delete=None) -> None:
    for derivative_id in document.get("derivative_ids", []):
        derivative = await db.files.find_one({"_id": derivative_id, "deleted_at": None})
        if derivative:
            await delete_file(derivative, legacy_delete=legacy_delete)
    if document["provider"] == "s3":
        await storage.delete(document["storage_key"])
    elif legacy_delete:
        await legacy_delete(document["storage_key"])
    await db.files.update_one(
        {"_id": document["_id"]}, {"$set": {"deleted_at": now_utc()}}
    )
