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
        [("user_id", ASCENDING), ("conversation_id", ASCENDING), ("created_at", ASCENDING)]
    )
    await db.coach_conversations.create_indexes(
        [
            IndexModel(
                [("user_id", ASCENDING), ("deleted_at", ASCENDING), ("updated_at", DESCENDING)],
            ),
        ]
    )
    await db.weekly_reports.create_index(
        [("user_id", ASCENDING), ("created_at", DESCENDING)]
    )
    await db.diary_entries.create_index(
        [("user_id", ASCENDING), ("created_at", DESCENDING)]
    )
    await db.breathing_sessions.create_index(
        [("user_id", ASCENDING), ("created_at", DESCENDING)]
    )
    await db.reflections.create_index(
        [("user_id", ASCENDING), ("created_at", DESCENDING)]
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
    await db.training_plans.create_indexes(
        [
            IndexModel(
                [("user_id", ASCENDING), ("status", ASCENDING)],
            ),
        ]
    )
    await db.training_sessions.create_indexes(
        [
            IndexModel(
                [("user_id", ASCENDING), ("status", ASCENDING)],
            ),
            IndexModel(
                [("user_id", ASCENDING), ("completed_at", DESCENDING)],
            ),
        ]
    )
    await db.health_documents.create_indexes(
        [
            IndexModel(
                [("user_id", ASCENDING), ("deleted_at", ASCENDING), ("created_at", DESCENDING)],
            ),
            IndexModel(
                [("user_id", ASCENDING), ("status", ASCENDING)],
            ),
        ]
    )
    await db.health_markers.create_indexes(
        [
            IndexModel(
                [("document_id", ASCENDING), ("user_id", ASCENDING), ("deleted_at", ASCENDING)],
            ),
            IndexModel(
                [("user_id", ASCENDING), ("name", ASCENDING), ("deleted_at", ASCENDING)],
            ),
        ]
    )
    await db.meal_favorites.create_index(
        [("user_id", ASCENDING), ("deleted_at", ASCENDING)]
    )
    await db.meal_recipes.create_index(
        [("user_id", ASCENDING), ("deleted_at", ASCENDING)]
    )
    await db.meal_plans.create_indexes(
        [
            IndexModel(
                [("user_id", ASCENDING), ("status", ASCENDING), ("deleted_at", ASCENDING)],
            ),
            IndexModel(
                [("status", ASCENDING), ("deleted_at", ASCENDING), ("updated_at", ASCENDING)],
            ),
        ]
    )
    await db.nutrition_screenings.create_index(
        [("user_id", ASCENDING)], unique=True
    )
    await db.supplement_logs.create_index(
        [("user_id", ASCENDING), ("date", DESCENDING), ("deleted_at", ASCENDING)]
    )
    await db.fueling_logs.create_index(
        [("user_id", ASCENDING), ("date", DESCENDING), ("deleted_at", ASCENDING)]
    )
    await db.sweat_tests.create_index(
        [("user_id", ASCENDING), ("created_at", DESCENDING)]
    )
    await db.nutrition_feedback.create_index(
        [("user_id", ASCENDING), ("created_at", DESCENDING)]
    )
    await db.equipment.create_index(
        [("user_id", ASCENDING), ("deleted_at", ASCENDING), ("category", ASCENDING)]
    )
    await db.shared_reports.create_indexes(
        [
            IndexModel([("token", ASCENDING)], unique=True),
            IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0),
        ]
    )
    await db.professional_accounts.create_index(
        [("user_id", ASCENDING)], unique=True
    )
    await db.payments.create_indexes(
        [
            IndexModel([("payer_user_id", ASCENDING), ("created_at", DESCENDING)]),
            IndexModel([("receiver_user_id", ASCENDING), ("created_at", DESCENDING)]),
            IndexModel(
                [("stripe_session_id", ASCENDING)], unique=True, sparse=True
            ),
            IndexModel([("idempotency_key", ASCENDING)], unique=True),
        ]
    )
    await db.payment_events.create_index(
        [("event_id", ASCENDING)], unique=True
    )
    await db.wearable_permissions.create_index(
        [("user_id", ASCENDING), ("source", ASCENDING)], unique=True
    )
    await db.gi_training_plans.create_index(
        [("user_id", ASCENDING), ("status", ASCENDING)]
    )
    await db.gi_session_logs.create_indexes(
        [
            IndexModel(
                [("user_id", ASCENDING), ("plan_id", ASCENDING), ("week", ASCENDING)],
            ),
        ]
    )
    await db.wearable_data.create_indexes(
        [
            IndexModel(
                [("user_id", ASCENDING), ("source", ASCENDING),
                 ("data_type", ASCENDING), ("source_id", ASCENDING)],
                unique=True,
                name="wearable_dedup",
            ),
            IndexModel(
                [("user_id", ASCENDING), ("data_type", ASCENDING),
                 ("date", DESCENDING), ("deleted_at", ASCENDING)],
                name="wearable_query",
            ),
        ]
    )
    await db.push_tokens.create_index(
        [("user_id", ASCENDING), ("token", ASCENDING)], unique=True
    )
    await db.notification_preferences.create_index(
        [("user_id", ASCENDING)], unique=True
    )
    await db.notifications.create_index(
        [("user_id", ASCENDING), ("read", ASCENDING), ("created_at", DESCENDING)]
    )
    await db.wellness_syncs.create_index(
        [("user_id", ASCENDING)], unique=True
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
