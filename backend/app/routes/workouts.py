import asyncio
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

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
    athlete_id = user.get("intervals_athlete_id", "0")
    oldest = (now_utc() - timedelta(days=60)).strftime("%Y-%m-%d")
    newest = today_str()

    try:
        activities, events = await asyncio.gather(
            asyncio.to_thread(
                intervals.activities,
                api_key=api_key, athlete_id=athlete_id,
                oldest=oldest, newest=newest,
            ),
            asyncio.to_thread(
                intervals.events,
                api_key=api_key, athlete_id=athlete_id,
                oldest=oldest, newest=newest,
            ),
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
            "source": "intervals",
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

    for event in events:
        external_id = str(event.get("id"))
        document = {
            "user_id": user_id,
            "source": "intervals",
            "icu_event_id": external_id,
            "name": event.get("name"),
            "category": event.get("category"),
            "start_date_local": event.get("start_date_local"),
            "description": event.get("description"),
            "color": event.get("color"),
            "updated_at": now_utc(),
        }
        await db.planned_sessions.update_one(
            {"user_id": user_id, "icu_event_id": external_id},
            {"$set": document},
            upsert=True,
        )

    await db.users.update_one(
        {"_id": user["_id"]}, {"$set": {"intervals_last_sync": now_utc()}}
    )
    return {"synced_activities": len(activities), "synced_events": len(events)}


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


@router.get("/calendar")
async def calendar(
    oldest: str = Query(pattern=r"^\d{4}-\d{2}-\d{2}$"),
    newest: str = Query(pattern=r"^\d{4}-\d{2}-\d{2}$"),
    user: dict = Depends(current_user),
):
    user_id = str(user["_id"])

    activities_cursor = db.activities.find(
        {"user_id": user_id, "start_date_local": {"$gte": oldest, "$lte": newest + "T99"}},
    ).sort("start_date_local", 1)

    planned_cursor = db.planned_sessions.find(
        {"user_id": user_id, "start_date_local": {"$gte": oldest, "$lte": newest + "T99"}},
    ).sort("start_date_local", 1)

    races_cursor = db.races.find(
        {"user_id": user_id, "deleted_at": None, "date": {"$gte": oldest, "$lte": newest}},
    ).sort("date", 1)

    activities, planned, races = await asyncio.gather(
        activities_cursor.to_list(500),
        planned_cursor.to_list(500),
        races_cursor.to_list(100),
    )

    entries: list[dict] = []
    for a in activities:
        entries.append({
            "id": str(a["_id"]),
            "kind": "activity",
            "date": (a.get("start_date_local") or "")[:10],
            "name": a.get("name"),
            "type": a.get("type"),
            "source": a.get("source", "intervals"),
        })
    for p in planned:
        entries.append({
            "id": str(p["_id"]),
            "kind": "planned",
            "date": (p.get("start_date_local") or "")[:10],
            "name": p.get("name"),
            "category": p.get("category"),
            "source": "intervals",
        })
    for r in races:
        entries.append({
            "id": str(r["_id"]),
            "kind": "race",
            "date": r.get("date"),
            "name": r.get("name"),
            "race_type": r.get("race_type"),
            "priority": r.get("priority"),
        })

    entries.sort(key=lambda e: e.get("date") or "")
    return {"entries": entries}
