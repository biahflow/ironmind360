from app.database import db
from app.security import now_utc


ALLOWED_ACTIONS = frozenset(
    {
        "consent.granted",
        "consent.revoked",
        "profile.sport.updated",
        "profile.nutrition.updated",
        "account.exported",
        "account.deleted",
        "file.deleted",
        "session.revoked",
    }
)


async def audit_event(
    *, actor_user_id: str | None, action: str, resource_type: str, resource_id: str | None = None
) -> None:
    if action not in ALLOWED_ACTIONS:
        raise ValueError(f"Evento de auditoria nao permitido: {action}")
    await db.audit_events.insert_one(
        {
            "actor_user_id": actor_user_id,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "created_at": now_utc(),
        }
    )
