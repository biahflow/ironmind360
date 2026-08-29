"""Seed local idempotente; nunca sobrescreve usuarios existentes."""

import os
from datetime import datetime, timezone

import bcrypt
from pymongo import ASCENDING, MongoClient


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
    client.close()


if __name__ == "__main__":
    main()
