import inspect
from contextlib import asynccontextmanager

from fastapi import FastAPI
from pymongo import ASCENDING, DESCENDING, AsyncMongoClient, IndexModel

from app.config import settings


client: AsyncMongoClient = AsyncMongoClient(settings.mongo_url)
db = client[settings.db_name]


async def ensure_indexes() -> None:
    session_indexes = await db.sessions.index_information()
    if "refresh_token_hash_1" in session_indexes:
        await db.sessions.drop_index("refresh_token_hash_1")
    await db.users.create_indexes(
        [
            IndexModel([("email", ASCENDING)], unique=True, name="email_1"),
            IndexModel([("roles", ASCENDING)], name="users_roles"),
        ]
    )
    await db.sessions.create_indexes(
        [
            IndexModel([("user_id", ASCENDING), ("revoked_at", ASCENDING)]),
        ]
    )
    await db.refresh_tokens.create_indexes(
        [
            IndexModel([("token_hash", ASCENDING)], unique=True),
            IndexModel([("session_id", ASCENDING), ("used_at", ASCENDING)]),
            IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0),
        ]
    )
    await db.action_tokens.create_indexes(
        [
            IndexModel([("token_hash", ASCENDING)], unique=True),
            IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0),
        ]
    )
    await db.activities.create_index(
        [("user_id", ASCENDING), ("icu_id", ASCENDING)], unique=True
    )
    await db.activities.create_index(
        [("user_id", ASCENDING), ("start_date_local", DESCENDING)]
    )
    await db.habits.create_index([("user_id", ASCENDING), ("date", DESCENDING)], unique=True)
    await db.meals.create_index(
        [("user_id", ASCENDING), ("date", DESCENDING), ("deleted_at", ASCENDING)]
    )
    await db.files.create_indexes(
        [
            IndexModel([("owner_user_id", ASCENDING), ("deleted_at", ASCENDING)]),
            IndexModel(
                [("owner_user_id", ASCENDING), ("provider", ASCENDING), ("storage_key", ASCENDING)],
                unique=True,
            ),
        ]
    )
    await db.chat_messages.create_index(
        [("user_id", ASCENDING), ("created_at", ASCENDING)]
    )
    await db.consents.create_index(
        [("user_id", ASCENDING), ("purpose", ASCENDING), ("created_at", DESCENDING)]
    )
    await db.profiles.create_index([("user_id", ASCENDING)], unique=True)
    await db.races.create_index(
        [("user_id", ASCENDING), ("date", ASCENDING), ("deleted_at", ASCENDING)]
    )
    await db.planned_sessions.create_indexes(
        [
            IndexModel(
                [("user_id", ASCENDING), ("icu_event_id", ASCENDING)],
                unique=True,
            ),
            IndexModel(
                [("user_id", ASCENDING), ("start_date_local", ASCENDING)],
            ),
        ]
    )
    await db.pain_logs.create_index(
        [("user_id", ASCENDING), ("date", DESCENDING)], unique=True
    )
    await db.custom_habits.create_index(
        [("user_id", ASCENDING), ("deleted_at", ASCENDING)]
    )
    await db.custom_habit_logs.create_index(
        [("habit_id", ASCENDING), ("user_id", ASCENDING), ("date", DESCENDING)],
        unique=True,
    )
    await db.body_photos.create_index(
        [("user_id", ASCENDING), ("date", DESCENDING)]
    )
    await db.audit_events.create_index(
        [("actor_user_id", ASCENDING), ("created_at", DESCENDING)]
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.command("ping")
    await ensure_indexes()
    app.state.mongo = db
    yield
    close_result = client.close()
    if inspect.isawaitable(close_result):
        await close_result
