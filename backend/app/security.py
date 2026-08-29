import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import HTTPException

from app.config import settings
from app.database import db
from app.models import Goals


JWT_ALGORITHM = "HS256"


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except (ValueError, TypeError):
        return False


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def public_user(document: dict) -> dict:
    return {
        "id": str(document["_id"]),
        "email": document["email"],
        "name": document.get("name", ""),
        "roles": document.get("roles", ["athlete"]),
        "email_verified": bool(document.get("email_verified_at")),
        "goals": document.get("goals", Goals().model_dump()),
        "intervals_connected": bool(document.get("intervals_api_key")),
        "intervals_athlete_id": document.get("intervals_athlete_id", "0"),
    }


def _encode(payload: dict) -> str:
    return jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALGORITHM)


def decode_token(token: str, expected_type: str) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != expected_type:
            raise ValueError("wrong token type")
        return payload
    except Exception as exc:
        raise HTTPException(401, "Token invalido ou expirado") from exc


async def issue_token_pair(user_id: str, session_id: str | None = None, device_name: str = "unknown") -> dict:
    issued = now_utc()
    sid = session_id or str(uuid.uuid4())
    if session_id is None:
        await db.sessions.insert_one(
            {
                "_id": sid,
                "user_id": user_id,
                "device_name": device_name,
                "created_at": issued,
                "last_seen_at": issued,
                "revoked_at": None,
            }
        )
    access_exp = issued + timedelta(minutes=settings.access_token_minutes)
    refresh_exp = issued + timedelta(days=settings.refresh_token_days)
    access = _encode(
        {"sub": user_id, "sid": sid, "type": "access", "iat": issued, "exp": access_exp}
    )
    refresh_id = str(uuid.uuid4())
    refresh = _encode(
        {
            "sub": user_id,
            "sid": sid,
            "jti": refresh_id,
            "type": "refresh",
            "iat": issued,
            "exp": refresh_exp,
        }
    )
    await db.refresh_tokens.insert_one(
        {
            "_id": refresh_id,
            "session_id": sid,
            "user_id": user_id,
            "token_hash": token_hash(refresh),
            "created_at": issued,
            "expires_at": refresh_exp,
            "used_at": None,
        }
    )
    return {
        "token": access,
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "expires_in": settings.access_token_minutes * 60,
    }


async def create_action_token(user_id: str, purpose: str, hours: int = 1) -> str:
    raw = secrets.token_urlsafe(32)
    await db.action_tokens.delete_many({"user_id": user_id, "purpose": purpose, "used_at": None})
    await db.action_tokens.insert_one(
        {
            "user_id": user_id,
            "purpose": purpose,
            "token_hash": token_hash(raw),
            "created_at": now_utc(),
            "expires_at": now_utc() + timedelta(hours=hours),
            "used_at": None,
        }
    )
    return raw
