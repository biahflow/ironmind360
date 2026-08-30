"""Seed local idempotente; nunca sobrescreve usuarios existentes."""

import os
from datetime import datetime, timedelta, timezone

import bcrypt
from pymongo import ASCENDING, MongoClient


# Padrão semanal de carga (TSS) para o atleta demo — perfil triatlo auxiliar.
# Segunda = descanso; volume maior no fim de semana. Determinístico (sem random)
# para o seed permanecer reproduzível.
_WEEKLY_TSS = {0: 0, 1: 60, 2: 45, 3: 35, 4: 70, 5: 120, 6: 90}
_WEEKLY_TYPE = {1: "Ride", 2: "Run", 3: "Swim", 4: "Ride", 5: "Ride", 6: "Run"}
_TYPE_META = {
    # tipo -> (distancia_m_por_tss, veloc_media_m_s, fc_media, fc_max)
    "Ride": (33.0, 7.8, 138, 168),
    "Run": (95.0, 3.1, 152, 178),
    "Swim": (14.0, 1.1, 132, 158),
}


def _seed_demo_activities(database, user_id: str, days: int = 35) -> None:
    """Injeta atividades intervals.icu do demo cobrindo `days` dias, com uma
    semana de build recente (últimos 7 dias ~1,3x) para exercitar o ACWR.

    Idempotente: remove atividades marcadas como `demo-seed-*` e reinsere.
    """
    database.activities.delete_many(
        {"user_id": user_id, "icu_id": {"$regex": "^demo-seed-"}}
    )

    today = datetime.now(timezone.utc).date()
    docs = []
    for offset in range(days):
        day = today - timedelta(days=offset)
        tss = _WEEKLY_TSS[day.weekday()]
        if tss == 0:
            continue
        if offset < 7:  # semana de build recente
            tss = round(tss * 1.3)
        act_type = _WEEKLY_TYPE[day.weekday()]
        dist_per_tss, speed, hr_avg, hr_max = _TYPE_META[act_type]
        distance = round(tss * dist_per_tss)
        moving_time = round(distance / speed)
        docs.append(
            {
                "user_id": user_id,
                "source": "intervals",
                "icu_id": f"demo-seed-{offset:02d}",
                "name": f"{act_type} {day.isoformat()}",
                "type": act_type,
                "start_date_local": f"{day.isoformat()}T06:30:00",
                "distance": distance,
                "moving_time": moving_time,
                "elapsed_time": moving_time + 120,
                "icu_training_load": tss,
                "average_heartrate": hr_avg,
                "max_heartrate": hr_max,
                "calories": round(tss * 9.5),
                "total_elevation_gain": 120 if act_type == "Ride" else 40,
                "average_speed": speed,
                "updated_at": datetime.now(timezone.utc),
            }
        )
    if docs:
        database.activities.insert_many(docs)
    print(f"Seed: {len(docs)} atividades demo inseridas")


def main() -> None:
    client = MongoClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=10_000)
    database = client[os.environ.get("DB_NAME", "ironmind360")]
    database.command("ping")
    database.users.create_index([("email", ASCENDING)], unique=True)

    if os.getenv("ENABLE_DEMO_SEED", "false").lower() not in {"1", "true", "yes"}:
        print("Demo seed desabilitado")
        return

    email = os.environ["DEMO_EMAIL"].strip().lower()
    password_hash = bcrypt.hashpw(
        os.environ["DEMO_PASSWORD"].encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")
    database.users.update_one(
        {"email": email},
        {
            "$setOnInsert": {
                "email": email,
                "name": os.getenv("DEMO_NAME", "Atleta Demo"),
                "password_hash": password_hash,
                "roles": ["athlete"],
                "goals": {
                    "calories": 2200,
                    "protein": 150,
                    "water_ml": 3000,
                    "sleep_hours": 7.5,
                },
                "intervals_api_key": None,
                "intervals_athlete_id": "0",
                "created_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )
    print(f"Seed verificado para {email}")

    demo_user = database.users.find_one({"email": email}, {"_id": 1})
    if demo_user:
        _seed_demo_activities(database, str(demo_user["_id"]))

    client.close()


if __name__ == "__main__":
    main()
