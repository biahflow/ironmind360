from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.database import db
from app.dependencies import current_user
from app.models.notifications import (
    NotificationPrefsIn,
    PushTokenDeleteIn,
    PushTokenIn,
)
from app.utils.time import now_utc


router = APIRouter(tags=["notifications"])

DEFAULT_PREFS = {
    "checkin_reminder": True,
    "checkin_time": "07:00",
    "workout_reminder": True,
    "hydration_reminder": True,
    "equipment_alerts": True,
    "readiness_alerts": True,
    "meal_reminders": True,
    "race_countdown": True,
    "weekly_summary": True,
    "quiet_start": "22:00",
    "quiet_end": "07:00",
}


# --------------- Push tokens ---------------


@router.post("/push-token", status_code=201)
async def register_push_token(
    data: PushTokenIn, user: dict = Depends(current_user)
):
    user_id = str(user["_id"])
    now = now_utc()
    await db.push_tokens.update_one(
        {"user_id": user_id, "token": data.token},
        {"$set": {
            "platform": data.platform,
            "updated_at": now,
        }, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return {"ok": True, "token": data.token}


@router.delete("/push-token")
async def delete_push_token(
    data: PushTokenDeleteIn, user: dict = Depends(current_user)
):
    user_id = str(user["_id"])
    result = await db.push_tokens.delete_one(
        {"user_id": user_id, "token": data.token}
    )
    if result.deleted_count == 0:
        raise HTTPException(404, "Token nao encontrado")
    return {"ok": True}


# --------------- Preferências ---------------


@router.get("/notification-preferences")
async def get_notification_prefs(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    doc = await db.notification_preferences.find_one({"user_id": user_id})
    if not doc:
        return DEFAULT_PREFS
    result = {k: doc.get(k, v) for k, v in DEFAULT_PREFS.items()}
    return result


@router.put("/notification-preferences")
async def update_notification_prefs(
    data: NotificationPrefsIn, user: dict = Depends(current_user)
):
    user_id = str(user["_id"])
    now = now_utc()
    update = data.model_dump()
    await db.notification_preferences.update_one(
        {"user_id": user_id},
        {"$set": {**update, "updated_at": now}, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return {**update}


# --------------- Notificações ---------------


@router.get("/notifications")
async def list_notifications(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    docs = await db.notifications.find(
        {"user_id": user_id}
    ).sort("created_at", -1).to_list(50)
    items = []
    for d in docs:
        items.append({
            "id": str(d["_id"]),
            "type": d.get("type", ""),
            "title": d.get("title", ""),
            "body": d.get("body", ""),
            "data": d.get("data", {}),
            "read": d.get("read", False),
            "created_at": d["created_at"].isoformat() if d.get("created_at") else None,
        })
    return {"notifications": items, "count": len(items)}


@router.get("/notifications/unread-count")
async def unread_count(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    count = await db.notifications.count_documents(
        {"user_id": user_id, "read": False}
    )
    return {"unread": count}


@router.post("/notifications/{notification_id}/read")
async def mark_read(notification_id: str, user: dict = Depends(current_user)):
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(404, "Notificacao nao encontrada")
    result = await db.notifications.update_one(
        {"_id": ObjectId(notification_id), "user_id": str(user["_id"])},
        {"$set": {"read": True, "read_at": now_utc()}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Notificacao nao encontrada")
    return {"ok": True}


@router.post("/notifications/read-all")
async def mark_all_read(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    result = await db.notifications.update_many(
        {"user_id": user_id, "read": False},
        {"$set": {"read": True, "read_at": now_utc()}},
    )
    return {"ok": True, "updated": result.modified_count}
