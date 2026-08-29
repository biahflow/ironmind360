import asyncio
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException

from app.adapters.intervals import IntervalsClient
from app.database import db
from app.dependencies import current_user
from app.utils.time import now_utc, today_str


router = APIRouter(tags=["workouts"])
intervals = IntervalsClient()


@router.post("/intervals/sync")
async def sync_intervals(user: dict = Depends(current_user)):
    api_key = user.get("intervals_api_key")
    if not api_key:
        raise HTTPException(400, "Conecte sua chave da intervals.icu nas configuracoes primeiro")
    user_id = str(user["_id"])
    try:
        activities = await asyncio.to_thread(
            intervals.activities,
            api_key=api_key,
            athlete_id=user.get("intervals_athlete_id", "0"),
            oldest=(now_utc() - timedelta(days=60)).strftime("%Y-%m-%d"),
            newest=today_str(),
        )
    except ValueError as exc:
        raise HTTPException(400, "Chave da intervals.icu invalida") from exc
    except RuntimeError as exc:
        raise HTTPException(429, "Limite da intervals.icu atingido") from exc
    except Exception as exc:
        raise HTTPException(502, "Falha ao consultar a intervals.icu") from exc
    for activity in activities:
        external_id = str(activity.get("id"))
        document = {
            "user_id": user_id,
            "icu_id": external_id,
            "name": activity.get("name"),
            "type": activity.get("type"),
            "start_date_local": activity.get("start_date_local"),
            "distance": activity.get("distance"),
            "moving_time": activity.get("moving_time"),
            "elapsed_time": activity.get("elapsed_time"),
            "icu_training_load": activity.get("icu_training_load"),
            "average_heartrate": activity.get("average_heartrate"),
            "max_heartrate": activity.get("max_heartrate"),
            "calories": activity.get("calories"),
            "total_elevation_gain": activity.get("total_elevation_gain"),
            "average_speed": activity.get("average_speed"),
            "updated_at": now_utc(),
        }
        await db.activities.update_one(
            {"user_id": user_id, "icu_id": external_id}, {"$set": document}, upsert=True
        )
    await db.users.update_one(
        {"_id": user["_id"]}, {"$set": {"intervals_last_sync": now_utc()}}
    )
    return {"synced": len(activities)}


@router.get("/workouts")
async def list_workouts(user: dict = Depends(current_user)):
    documents = (
        await db.activities.find({"user_id": str(user["_id"])})
        .sort("start_date_local", -1)
        .to_list(200)
    )
    for document in documents:
        document["id"] = str(document.pop("_id"))
    return {"workouts": documents, "connected": bool(user.get("intervals_api_key"))}
