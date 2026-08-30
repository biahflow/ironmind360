"""Sincronizacao de dados de wellness do intervals.icu para wearable_data e habits."""

import asyncio
import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from app.adapters.intervals import IntervalsClient
from app.database import db
from app.dependencies import current_user
from app.utils.time import now_utc

router = APIRouter(prefix="/intervals", tags=["intervals"])
logger = logging.getLogger("ironmind.intervals_sync")

_intervals = IntervalsClient()

SOURCE = "intervals_icu"
WELLNESS_DATA_TYPES = ["sleep", "resting_hr", "hrv", "weight"]


def _transform_wellness_day(day: dict) -> list[dict]:
    """Converte um dia de wellness do intervals.icu em entradas wearable_data."""
    date = day.get("id", "")
    if not date:
        return []

    entries = []

    resting_hr = day.get("restingHR")
    if resting_hr is not None:
        entries.append({
            "data_type": "resting_hr",
            "source_id": f"{date}_resting_hr",
            "date": date,
            "value": {"bpm": int(resting_hr)},
        })

    hrv = day.get("hrv")
    if hrv is not None:
        entries.append({
            "data_type": "hrv",
            "source_id": f"{date}_hrv",
            "date": date,
            "value": {"ms": round(float(hrv), 1)},
        })

    weight = day.get("weight")
    if weight is not None:
        entries.append({
            "data_type": "weight",
            "source_id": f"{date}_weight",
            "date": date,
            "value": {"kg": round(float(weight), 1)},
        })

    sleep_secs = day.get("sleepSecs")
    if sleep_secs is not None:
        sleep_quality = day.get("sleepQuality")
        value: dict = {"hours": round(sleep_secs / 3600, 1)}
        if sleep_quality is not None:
            value["quality"] = int(sleep_quality)
        entries.append({
            "data_type": "sleep",
            "source_id": f"{date}_sleep",
            "date": date,
            "value": value,
        })

    return entries


def _extract_habits_fields(day: dict) -> dict:
    """Extrai campos de habits mapeáveis do wellness intervals.icu."""
    fields: dict = {}
    date = day.get("id", "")
    if not date:
        return fields

    fatigue = day.get("fatigue")
    if fatigue is not None:
        fields["fatigue"] = int(fatigue)

    mood = day.get("mood")
    if mood is not None:
        fields["mood"] = int(mood)

    stress = day.get("stress")
    if stress is not None:
        fields["stress"] = int(stress)

    sleep_secs = day.get("sleepSecs")
    if sleep_secs is not None:
        fields["sleep_hours"] = round(sleep_secs / 3600, 1)

    sleep_quality = day.get("sleepQuality")
    if sleep_quality is not None:
        fields["sleep_quality"] = int(sleep_quality)

    return fields


@router.post("/sync-wellness")
async def sync_wellness(
    days: int = Query(default=30, ge=1, le=90),
    user: dict = Depends(current_user),
):
    api_key = user.get("intervals_api_key")
    athlete_id = user.get("intervals_athlete_id", "0")
    if not api_key:
        raise HTTPException(403, "Intervals.icu nao conectado")

    user_id = str(user["_id"])
    now = now_utc()
    newest = now.strftime("%Y-%m-%d")
    oldest = (now - timedelta(days=days)).strftime("%Y-%m-%d")

    try:
        wellness_data = await asyncio.to_thread(
            _intervals.wellness,
            api_key=api_key,
            athlete_id=athlete_id,
            oldest=oldest,
            newest=newest,
        )
    except ValueError:
        raise HTTPException(401, "Credenciais intervals.icu invalidas")
    except RuntimeError:
        raise HTTPException(429, "Rate limit do intervals.icu atingido")

    await db.wearable_permissions.update_one(
        {"user_id": user_id, "source": SOURCE},
        {
            "$set": {"data_types": WELLNESS_DATA_TYPES, "updated_at": now},
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )

    synced = 0
    skipped = 0
    habits_enriched = 0

    for day in wellness_data:
        entries = _transform_wellness_day(day)
        if not entries:
            skipped += 1
            continue

        for entry in entries:
            result = await db.wearable_data.update_one(
                {
                    "user_id": user_id,
                    "source": SOURCE,
                    "data_type": entry["data_type"],
                    "source_id": entry["source_id"],
                },
                {
                    "$set": {
                        "user_id": user_id,
                        "source": SOURCE,
                        "data_type": entry["data_type"],
                        "source_id": entry["source_id"],
                        "timestamp": f"{entry['date']}T00:00:00",
                        "timestamp_parsed": None,
                        "date": entry["date"],
                        "value": entry["value"],
                        "metadata": {"provider": "intervals.icu"},
                        "updated_at": now,
                        "deleted_at": None,
                    },
                    "$setOnInsert": {"created_at": now},
                },
                upsert=True,
            )
            if result.upserted_id or result.modified_count:
                synced += 1

        habits_fields = _extract_habits_fields(day)
        date = day.get("id", "")
        if habits_fields and date:
            existing_habit = await db.habits.find_one(
                {"user_id": user_id, "date": date}
            )
            if not existing_habit:
                await db.habits.update_one(
                    {"user_id": user_id, "date": date},
                    {
                        "$setOnInsert": {
                            "user_id": user_id,
                            "date": date,
                            **habits_fields,
                            "water_ml": 0,
                            "meditate": False,
                            "read": False,
                            "cold_shower": False,
                            "updated_at": now,
                            "source": "intervals_icu",
                        },
                    },
                    upsert=True,
                )
                habits_enriched += 1

    await db.wellness_syncs.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "last_sync_at": now,
                "last_oldest": oldest,
                "last_newest": newest,
                "last_count": synced,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )

    return {
        "synced": synced,
        "skipped": skipped,
        "habits_enriched": habits_enriched,
        "period": {"oldest": oldest, "newest": newest},
    }


@router.get("/wellness-status")
async def wellness_status(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    sync_doc = await db.wellness_syncs.find_one({"user_id": user_id})
    if not sync_doc:
        return {
            "synced": False,
            "last_sync_at": None,
            "records": 0,
            "date_range": None,
        }

    records = await db.wearable_data.count_documents(
        {"user_id": user_id, "source": SOURCE, "deleted_at": None}
    )

    return {
        "synced": True,
        "last_sync_at": (
            sync_doc["last_sync_at"].isoformat()
            if sync_doc.get("last_sync_at") else None
        ),
        "records": records,
        "date_range": {
            "oldest": sync_doc.get("last_oldest"),
            "newest": sync_doc.get("last_newest"),
        },
    }
