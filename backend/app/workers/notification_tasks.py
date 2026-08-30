"""Tarefas Celery para envio de notificações push via Expo Push API."""

import logging

import requests
from pymongo import MongoClient

from app.config import settings
from app.workers.celery import celery_app


logger = logging.getLogger("ironmind.notifications")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def _get_sync_db():
    client = MongoClient(settings.mongo_url)
    return client[settings.db_name]


@celery_app.task(name="ironmind.send_push_notification")
def send_push_notification(
    user_id: str, title: str, body: str,
    notification_type: str = "", data: dict | None = None,
):
    db = _get_sync_db()

    db.notifications.insert_one({
        "user_id": user_id,
        "type": notification_type,
        "title": title,
        "body": body,
        "data": data or {},
        "read": False,
        "created_at": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ),
    })

    tokens = list(db.push_tokens.find({"user_id": user_id}))
    if not tokens:
        return {"sent": 0, "stored": True}

    messages = []
    for token_doc in tokens:
        messages.append({
            "to": token_doc["token"],
            "title": title,
            "body": body,
            "data": data or {},
            "sound": "default",
        })

    try:
        resp = requests.post(
            EXPO_PUSH_URL,
            json=messages,
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        resp.raise_for_status()
        logger.info("Push enviado para %s (%d tokens)", user_id, len(messages))
    except Exception:
        logger.exception("Falha ao enviar push para %s", user_id)

    return {"sent": len(messages), "stored": True}


@celery_app.task(name="ironmind.generate_daily_reminders")
def generate_daily_reminders():
    import asyncio
    from app.services.smart_reminders import generate_reminders

    db = _get_sync_db()

    user_ids = db.push_tokens.distinct("user_id")
    total_sent = 0

    for user_id in user_ids:
        try:
            reminders = asyncio.run(generate_reminders(user_id))
        except Exception:
            logger.exception(
                "Falha ao gerar lembretes para %s", user_id
            )
            continue

        for reminder in reminders:
            send_push_notification.delay(
                user_id=user_id,
                title=reminder["title"],
                body=reminder["body"],
                notification_type=reminder["type"],
                data=reminder.get("data"),
            )
            total_sent += 1

    logger.info(
        "Lembretes diarios: %d usuarios, %d lembretes",
        len(user_ids), total_sent,
    )
    return {"users": len(user_ids), "reminders": total_sent}
