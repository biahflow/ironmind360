import json
from datetime import date, datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from app.database import db
from app.adapters.legacy_storage import legacy_storage
from app.dependencies import current_user
from app.models import DeleteAccountIn
from app.security import verify_password
from app.services.audit import audit_event
from app.services.files import delete_file


router = APIRouter(prefix="/account", tags=["account"])


def _json_safe(value):
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, (ObjectId, datetime, date)):
        return str(value)
    return value


@router.get("/export")
async def export_account(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    safe_user = {
        key: value
        for key, value in user.items()
        if key
        not in {
            "password_hash",
            "intervals_api_key",
            "_session_id",
        }
    }
    collections = {
        "activities": "user_id",
        "habits": "user_id",
        "meals": "user_id",
        "chat_messages": "user_id",
        "weekly_reports": "user_id",
        "consents": "user_id",
        "files": "owner_user_id",
    }
    payload = {"exported_at": datetime.now().astimezone().isoformat(), "user": safe_user}
    for name, owner_field in collections.items():
        payload[name] = await db[name].find({owner_field: user_id}).to_list(10_000)
    await audit_event(
        actor_user_id=user_id,
        action="account.exported",
        resource_type="account",
        resource_id=user_id,
    )
    return Response(
        content=json.dumps(_json_safe(payload), ensure_ascii=False),
        media_type="application/json",
        headers={
            "Content-Disposition": 'attachment; filename="ironmind360-export.json"',
            "Cache-Control": "private, no-store",
        },
    )


@router.post("/delete")
async def delete_account(data: DeleteAccountIn, user: dict = Depends(current_user)):
    if not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(401, "Senha invalida")
    user_id = str(user["_id"])

    files = await db.files.find({"owner_user_id": user_id, "deleted_at": None}).to_list(10_000)
    for document in files:
        await delete_file(document, legacy_delete=legacy_storage.delete)

    await audit_event(
        actor_user_id=user_id,
        action="account.deleted",
        resource_type="account",
        resource_id=None,
    )
    for name in (
        "activities",
        "habits",
        "meals",
        "chat_messages",
        "weekly_reports",
        "consents",
        "action_tokens",
        "refresh_tokens",
        "sessions",
    ):
        await db[name].delete_many({"user_id": user_id})
    await db.files.delete_many({"owner_user_id": user_id})
    await db.users.delete_one({"_id": user["_id"]})
    return {"ok": True}
