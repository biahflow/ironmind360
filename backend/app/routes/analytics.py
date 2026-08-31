from datetime import timedelta
from typing import Any, Mapping

from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import db
from app.dependencies import current_user
from app.utils.time import now_utc

router = APIRouter(prefix="/analytics", tags=["analytics"])


OBSERVATIONAL_DISCLAIMER = (
    "Correlações são observacionais — não indicam causa e efeito. "
    "Consulte um profissional para interpretação."
)


# ---------------------------------------------------------------------------
# Carga de treino (TSS/distância/duração por dia)
# ---------------------------------------------------------------------------

@router.get("/load")
async def training_load(
    days: int = Query(28, ge=7, le=365),
    user: dict = Depends(current_user),
):
    user_id = str(user["_id"])
    since = (now_utc() - timedelta(days=days)).strftime("%Y-%m-%d")

    pipeline: list[Mapping[str, Any]] = [
        {"$match": {"user_id": user_id, "start_date_local": {"$gte": since}}},
        {"$group": {
            "_id": "$start_date_local",
            "total_tss": {"$sum": {"$ifNull": ["$icu_training_load", 0]}},
            "total_distance_km": {"$sum": {"$divide": [{"$ifNull": ["$distance", 0]}, 1000]}},
            "total_duration_min": {"$sum": {"$divide": [{"$ifNull": ["$moving_time", 0]}, 60]}},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    cursor = await db.activities.aggregate(pipeline)
    data = await cursor.to_list(400)
    return {"data": data, "days": days}


# ---------------------------------------------------------------------------
# Consistência (dias com atividade, check-in, refeição)
# ---------------------------------------------------------------------------

@router.get("/consistency")
async def consistency(
    days: int = Query(28, ge=7, le=365),
    user: dict = Depends(current_user),
):
    user_id = str(user["_id"])
    since = (now_utc() - timedelta(days=days)).strftime("%Y-%m-%d")

    activity_dates = set()
    async for a in db.activities.find(
        {"user_id": user_id, "start_date_local": {"$gte": since}},
        {"start_date_local": 1},
    ):
        activity_dates.add(a["start_date_local"][:10])

    checkin_dates = set()
    async for h in db.habits.find(
        {"user_id": user_id, "date": {"$gte": since}},
        {"date": 1},
    ):
        checkin_dates.add(h["date"])

    meal_dates = set()
    async for m in db.meals.find(
        {"user_id": user_id, "date": {"$gte": since}, "deleted_at": None},
        {"date": 1},
    ):
        meal_dates.add(m["date"])

    return {
        "days": days,
        "activity_days": len(activity_dates),
        "checkin_days": len(checkin_dates),
        "meal_days": len(meal_dates),
        "total_days": days,
        "activity_rate": round(len(activity_dates) / days * 100, 1),
        "checkin_rate": round(len(checkin_dates) / days * 100, 1),
        "meal_rate": round(len(meal_dates) / days * 100, 1),
    }


# ---------------------------------------------------------------------------
# Sono, fadiga, dor, humor, estresse, energia (séries temporais)
# ---------------------------------------------------------------------------

@router.get("/wellness-trends")
async def wellness_trends(
    days: int = Query(28, ge=7, le=365),
    user: dict = Depends(current_user),
):
    user_id = str(user["_id"])
    since = (now_utc() - timedelta(days=days)).strftime("%Y-%m-%d")

    habits = await db.habits.find(
        {"user_id": user_id, "date": {"$gte": since}}
    ).sort("date", 1).to_list(400)

    series: dict = {
        "sleep_hours": [], "sleep_quality": [], "fatigue": [],
        "stress": [], "energy": [], "mood": [], "motivation": [], "anxiety": [],
    }
    for h in habits:
        date = h.get("date")
        for key in series:
            val = h.get(key)
            if val is not None:
                series[key].append({"date": date, "value": val})

    pain_logs = await db.pain_logs.find(
        {"user_id": user_id, "date": {"$gte": since}}
    ).sort("date", 1).to_list(400)
    pain_series = []
    for p in pain_logs:
        max_intensity = max(
            (e.get("intensity", 0) for e in p.get("entries", [])), default=0
        )
        pain_series.append({"date": p.get("date"), "value": max_intensity})

    series["pain"] = pain_series
    return {"data": series, "days": days}


# ---------------------------------------------------------------------------
# Nutrição (macros, calorias por dia)
# ---------------------------------------------------------------------------

@router.get("/nutrition-trends")
async def nutrition_trends(
    days: int = Query(28, ge=7, le=365),
    user: dict = Depends(current_user),
):
    user_id = str(user["_id"])
    since = (now_utc() - timedelta(days=days)).strftime("%Y-%m-%d")

    pipeline: list[Mapping[str, Any]] = [
        {"$match": {"user_id": user_id, "date": {"$gte": since}, "deleted_at": None}},
        {"$group": {
            "_id": "$date",
            "calories": {"$sum": {"$ifNull": ["$calories", 0]}},
            "protein_g": {"$sum": {"$ifNull": ["$protein_g", 0]}},
            "carbs_g": {"$sum": {"$ifNull": ["$carbs_g", 0]}},
            "fat_g": {"$sum": {"$ifNull": ["$fat_g", 0]}},
            "meals_count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    cursor = await db.meals.aggregate(pipeline)
    data = await cursor.to_list(400)
    return {"data": data, "days": days}


# ---------------------------------------------------------------------------
# Resumo semanal consolidado
# ---------------------------------------------------------------------------

async def _training_window(user_id: str, since: str, until: str | None):
    """Agrega treino/sono de uma janela [since, until) — reutilizado para
    comparar a semana atual com a anterior."""
    act_query: dict = {"user_id": user_id, "start_date_local": {"$gte": since}}
    hab_query: dict = {"user_id": user_id, "date": {"$gte": since}}
    if until is not None:
        act_query["start_date_local"]["$lt"] = until
        hab_query["date"]["$lt"] = until

    activities = await db.activities.find(
        act_query, {"distance": 1, "icu_training_load": 1},
    ).to_list(200)
    habits = await db.habits.find(
        hab_query, {"sleep_hours": 1},
    ).to_list(20)
    sleeps = [h["sleep_hours"] for h in habits if h.get("sleep_hours") is not None]

    return {
        "sessions": len(activities),
        "km": round(sum((a.get("distance") or 0) for a in activities) / 1000, 1),
        "tss": round(sum((a.get("icu_training_load") or 0) for a in activities)),
        "avg_sleep": round(sum(sleeps) / len(sleeps), 1) if sleeps else None,
    }


@router.get("/weekly-summary")
async def weekly_summary(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    since = (now_utc() - timedelta(days=7)).strftime("%Y-%m-%d")
    prev_since = (now_utc() - timedelta(days=14)).strftime("%Y-%m-%d")

    activities = await db.activities.find(
        {"user_id": user_id, "start_date_local": {"$gte": since}},
        {"distance": 1, "icu_training_load": 1},
    ).to_list(200)
    sessions = len(activities)
    km = round(sum((a.get("distance") or 0) for a in activities) / 1000, 1)
    tss = round(sum((a.get("icu_training_load") or 0) for a in activities))

    meals = await db.meals.find(
        {"user_id": user_id, "date": {"$gte": since}, "deleted_at": None},
        {"date": 1, "calories": 1},
    ).to_list(400)
    meal_days = len({m["date"] for m in meals})
    avg_calories = round(sum((m.get("calories") or 0) for m in meals) / meal_days) if meal_days else 0

    habits = await db.habits.find(
        {"user_id": user_id, "date": {"$gte": since}},
        {"sleep_hours": 1, "mood": 1},
    ).to_list(10)
    checkins = len(habits)

    def avg(key: str):
        vals = [h[key] for h in habits if h.get(key) is not None]
        return round(sum(vals) / len(vals), 1) if vals else None

    weight_series = []
    async for h in db.habits.find(
        {"user_id": user_id, "date": {"$gte": since}, "weight_kg": {"$ne": None}},
        {"weight_kg": 1},
    ).sort("date", 1):
        weight_series.append(h["weight_kg"])
    weight_delta = round(weight_series[-1] - weight_series[0], 1) if len(weight_series) >= 2 else None

    # Semana anterior (dias 8–14) para comparação "vs semana passada".
    previous = await _training_window(user_id, prev_since, since)

    return {
        "sessions": sessions, "km": km, "tss": tss,
        "meal_days": meal_days, "avg_calories": avg_calories,
        "checkins": checkins, "avg_sleep": avg("sleep_hours"), "avg_mood": avg("mood"),
        "weight_delta": weight_delta,
        "previous": previous,
    }


# ---------------------------------------------------------------------------
# Métricas corporais (peso / cintura ao longo do tempo)
# ---------------------------------------------------------------------------

@router.get("/body-metrics")
async def body_metrics(
    days: int = Query(90, ge=7, le=365),
    user: dict = Depends(current_user),
):
    user_id = str(user["_id"])
    since = (now_utc() - timedelta(days=days)).strftime("%Y-%m-%d")

    weight: list[dict] = []
    waist: list[dict] = []
    cursor = db.habits.find(
        {"user_id": user_id, "date": {"$gte": since}},
        {"date": 1, "weight_kg": 1, "waist_cm": 1},
    ).sort("date", 1)
    async for h in cursor:
        if h.get("weight_kg") is not None:
            weight.append({"date": h["date"], "value": round(float(h["weight_kg"]), 1)})
        if h.get("waist_cm") is not None:
            waist.append({"date": h["date"], "value": round(float(h["waist_cm"]), 1)})

    def summary(series: list[dict]) -> dict:
        if not series:
            return {"latest": None, "delta": None, "min": None, "max": None}
        values = [p["value"] for p in series]
        return {
            "latest": series[-1]["value"],
            "delta": round(series[-1]["value"] - series[0]["value"], 1),
            "min": min(values),
            "max": max(values),
        }

    return {
        "weight": weight,
        "waist": waist,
        "weight_summary": summary(weight),
        "waist_summary": summary(waist),
        "days": days,
    }


# ---------------------------------------------------------------------------
# Força (progresso nos exercícios de treino)
# ---------------------------------------------------------------------------

@router.get("/strength-progress")
async def strength_progress(
    days: int = Query(90, ge=7, le=365),
    user: dict = Depends(current_user),
):
    user_id = str(user["_id"])
    since = now_utc() - timedelta(days=days)

    sessions = await db.training_sessions.find(
        {"user_id": user_id, "status": "completed", "completed_at": {"$gte": since}}
    ).sort("completed_at", 1).to_list(500)

    exercise_progress: dict = {}
    for session in sessions:
        raw = session.get("completed_at", "")
        date = raw.strftime("%Y-%m-%d") if hasattr(raw, "strftime") else str(raw)[:10]
        for ex in session.get("exercises", []):
            ex_id = ex.get("exercise_id", "unknown")
            best_set = max(
                (s for s in ex.get("sets", []) if s.get("reps")),
                key=lambda s: (s.get("weight_kg", 0) or 0) * (s.get("reps", 0) or 0),
                default=None,
            )
            if best_set:
                if ex_id not in exercise_progress:
                    exercise_progress[ex_id] = []
                exercise_progress[ex_id].append({
                    "date": date,
                    "weight_kg": best_set.get("weight_kg"),
                    "reps": best_set.get("reps"),
                    "volume": (best_set.get("weight_kg", 0) or 0) * (best_set.get("reps", 0) or 0),
                })

    return {"data": exercise_progress, "days": days}


# ---------------------------------------------------------------------------
# Recordes pessoais
# ---------------------------------------------------------------------------

@router.get("/personal-records")
async def personal_records(user: dict = Depends(current_user)):
    user_id = str(user["_id"])

    records: dict = {"running": {}, "cycling": {}, "swimming": {}, "strength": {}}

    activities = await db.activities.find(
        {"user_id": user_id}
    ).sort("start_date_local", -1).to_list(2000)

    for a in activities:
        atype = (a.get("type") or "").lower()
        distance = a.get("distance", 0) or 0
        moving_time = a.get("moving_time", 0) or 0
        date = a.get("start_date_local", "")[:10]

        if "run" in atype and distance > 0:
            pace = moving_time / (distance / 1000) if distance > 0 else None
            for label, dist_m in [("1km", 1000), ("5km", 5000), ("10km", 10000), ("21km", 21097), ("42km", 42195)]:
                if distance >= dist_m * 0.95:
                    key = f"best_pace_{label}"
                    if key not in records["running"] or pace < records["running"][key]["value"]:
                        records["running"][key] = {
                            "value": round(pace, 1) if pace else None,
                            "unit": "s/km",
                            "date": date,
                            "distance_m": distance,
                        }

        if "ride" in atype or "cycling" in atype:
            if distance > 0 and moving_time > 0:
                speed_kmh = (distance / 1000) / (moving_time / 3600)
                key = "best_speed"
                if key not in records["cycling"] or speed_kmh > records["cycling"][key]["value"]:
                    records["cycling"][key] = {
                        "value": round(speed_kmh, 1),
                        "unit": "km/h",
                        "date": date,
                    }
            longest_key = "longest_ride_km"
            if longest_key not in records["cycling"] or distance / 1000 > records["cycling"][longest_key]["value"]:
                records["cycling"][longest_key] = {
                    "value": round(distance / 1000, 1),
                    "unit": "km",
                    "date": date,
                }

        if "swim" in atype:
            if distance > 0 and moving_time > 0:
                pace_100m = moving_time / (distance / 100)
                key = "best_pace_100m"
                if key not in records["swimming"] or pace_100m < records["swimming"][key]["value"]:
                    records["swimming"][key] = {
                        "value": round(pace_100m, 1),
                        "unit": "s/100m",
                        "date": date,
                    }

    sessions = await db.training_sessions.find(
        {"user_id": user_id, "status": "completed"}
    ).to_list(2000)

    for session in sessions:
        for ex in session.get("exercises", []):
            ex_id = ex.get("exercise_id", "unknown")
            for s in ex.get("sets", []):
                weight = s.get("weight_kg", 0) or 0
                reps = s.get("reps", 0) or 0
                if weight > 0 and reps > 0:
                    key = f"pr_{ex_id}"
                    current = records["strength"].get(key)
                    if not current or weight > current["value"]:
                        date = session.get("completed_at", "")
                        if hasattr(date, "strftime"):
                            date = date.strftime("%Y-%m-%d")
                        else:
                            date = str(date)[:10]
                        records["strength"][key] = {
                            "value": weight,
                            "unit": "kg",
                            "reps": reps,
                            "date": date,
                        }

    return {"records": records}


# ---------------------------------------------------------------------------
# Provas: retrospectivas resumidas
# ---------------------------------------------------------------------------

@router.get("/race-history")
async def race_history(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    races = await db.races.find(
        {"user_id": user_id, "deleted_at": None}
    ).sort("date", -1).to_list(100)

    results = []
    for r in races:
        entry = {
            "id": str(r["_id"]),
            "name": r.get("name"),
            "race_type": r.get("race_type"),
            "date": r.get("date"),
            "priority": r.get("priority"),
            "result": r.get("result"),
        }
        retro = r.get("retrospective")
        if retro:
            entry["retrospective"] = {
                "overall_rating": retro.get("overall_rating"),
                "finish_time": retro.get("finish_time"),
                "placement": retro.get("placement"),
            }
        results.append(entry)

    return {"races": results}


# ---------------------------------------------------------------------------
# Correlações observacionais
# ---------------------------------------------------------------------------

@router.get("/correlations")
async def correlations(
    days: int = Query(28, ge=14, le=365),
    user: dict = Depends(current_user),
):
    user_id = str(user["_id"])
    since = (now_utc() - timedelta(days=days)).strftime("%Y-%m-%d")

    habits = await db.habits.find(
        {"user_id": user_id, "date": {"$gte": since}}
    ).sort("date", 1).to_list(400)

    load_pipeline: list[Mapping[str, Any]] = [
        {"$match": {"user_id": user_id, "start_date_local": {"$gte": since}}},
        {"$group": {
            "_id": "$start_date_local",
            "tss": {"$sum": {"$ifNull": ["$icu_training_load", 0]}},
        }},
    ]
    load_cursor = await db.activities.aggregate(load_pipeline)
    loads = {d["_id"]: d["tss"] for d in await load_cursor.to_list(400)}

    paired: list[dict] = []
    for h in habits:
        date = h.get("date")
        paired.append({
            "date": date,
            "sleep": h.get("sleep_hours"),
            "fatigue": h.get("fatigue"),
            "mood": h.get("mood"),
            "energy": h.get("energy"),
            "stress": h.get("stress"),
            "tss": loads.get(date, 0),
        })

    observations = []
    if len(paired) >= 7:
        sleep_vals = [p["sleep"] for p in paired if p["sleep"] is not None]
        mood_vals = [p["mood"] for p in paired if p["mood"] is not None and p["sleep"] is not None]
        if len(sleep_vals) >= 7 and len(mood_vals) >= 7:
            avg_sleep = sum(sleep_vals) / len(sleep_vals)
            good_sleep_mood = [p["mood"] for p in paired if p["sleep"] and p["sleep"] >= avg_sleep and p["mood"]]
            bad_sleep_mood = [p["mood"] for p in paired if p["sleep"] and p["sleep"] < avg_sleep and p["mood"]]
            if good_sleep_mood and bad_sleep_mood:
                diff = sum(good_sleep_mood) / len(good_sleep_mood) - sum(bad_sleep_mood) / len(bad_sleep_mood)
                if abs(diff) > 0.3:
                    direction = "melhor" if diff > 0 else "pior"
                    observations.append({
                        "pair": "sono → humor",
                        "observation": (
                            f"Nos dias com sono acima da média ({avg_sleep:.1f}h), "
                            f"humor tende a ser {direction}."
                        ),
                        "type": "observational",
                        "disclaimer": OBSERVATIONAL_DISCLAIMER,
                    })

        tss_vals = [p["tss"] for p in paired if p["tss"] > 0]
        fatigue_vals = [p["fatigue"] for p in paired if p["fatigue"] is not None and p["tss"] > 0]
        if len(tss_vals) >= 7 and len(fatigue_vals) >= 7:
            avg_tss = sum(tss_vals) / len(tss_vals)
            high_tss_fatigue = [p["fatigue"] for p in paired if p["tss"] > avg_tss and p["fatigue"]]
            low_tss_fatigue = [p["fatigue"] for p in paired if 0 < p["tss"] <= avg_tss and p["fatigue"]]
            if high_tss_fatigue and low_tss_fatigue:
                diff = sum(high_tss_fatigue) / len(high_tss_fatigue) - sum(low_tss_fatigue) / len(low_tss_fatigue)
                if abs(diff) > 0.3:
                    direction = "maior" if diff > 0 else "menor"
                    observations.append({
                        "pair": "carga → fadiga",
                        "observation": (
                            f"Em dias com carga acima da média (TSS {avg_tss:.0f}), "
                            f"fadiga tende a ser {direction}."
                        ),
                        "type": "observational",
                        "disclaimer": OBSERVATIONAL_DISCLAIMER,
                    })

    return {
        "observations": observations,
        "disclaimer": OBSERVATIONAL_DISCLAIMER,
        "days": days,
        "data_points": len(paired),
    }


# ---------------------------------------------------------------------------
# Relatório compartilhável
# ---------------------------------------------------------------------------

@router.post("/share-report")
async def create_share_report(
    user: dict = Depends(current_user),
    scope: list[str] = Query(default=["load", "consistency", "wellness"]),
    days: int = Query(28, ge=7, le=365),
):
    user_id = str(user["_id"])
    now = now_utc()
    import uuid

    report_data: dict = {"scope": scope}
    if "load" in scope:
        report_data["load"] = (await training_load(days=days, user=user))["data"]
    if "consistency" in scope:
        report_data["consistency"] = await consistency(days=days, user=user)
    if "wellness" in scope:
        report_data["wellness"] = (await wellness_trends(days=days, user=user))["data"]
    if "nutrition" in scope:
        report_data["nutrition"] = (await nutrition_trends(days=days, user=user))["data"]
    if "records" in scope:
        report_data["records"] = (await personal_records(user=user))["records"]

    token = str(uuid.uuid4())
    doc = {
        "user_id": user_id,
        "token": token,
        "scope": scope,
        "days": days,
        "data": report_data,
        "created_at": now,
        "expires_at": now + timedelta(days=7),
    }
    await db.shared_reports.insert_one(doc)
    return {"token": token, "expires_in_days": 7, "scope": scope}


@router.get("/shared/{token}")
async def get_shared_report(token: str):
    doc = await db.shared_reports.find_one(
        {"token": token, "expires_at": {"$gte": now_utc()}}
    )
    if not doc:
        raise HTTPException(404, "Relatório não encontrado ou expirado")
    doc.pop("_id", None)
    doc.pop("user_id", None)
    return doc
