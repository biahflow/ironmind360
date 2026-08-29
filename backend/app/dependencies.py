from typing import Optional

from bson import ObjectId
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.database import db
from app.models.roles import ALL_ROLES
from app.security import decode_token, now_utc


bearer = HTTPBearer(auto_error=False)


async def current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
) -> dict:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(401, "Autenticacao obrigatoria")
    payload = decode_token(credentials.credentials, "access")
    user_id, session_id = payload.get("sub"), payload.get("sid")
    if not ObjectId.is_valid(user_id) or not session_id:
        raise HTTPException(401, "Token invalido ou expirado")
    session = await db.sessions.find_one({"_id": session_id, "user_id": user_id, "revoked_at": None})
    if not session:
        raise HTTPException(401, "Sessao revogada")
    await db.sessions.update_one({"_id": session_id}, {"$set": {"last_seen_at": now_utc()}})
    user = await db.users.find_one({"_id": ObjectId(user_id), "deleted_at": None})
    if not user:
        raise HTTPException(401, "Usuario indisponivel")
    user["_session_id"] = session_id
    return user


def require_roles(*roles: str):
    unknown = set(roles) - ALL_ROLES
    if unknown:
        raise ValueError(f"Papeis RBAC desconhecidos: {sorted(unknown)}")

    async def dependency(user: dict = Depends(current_user)) -> dict:
        if not set(user.get("roles", ["athlete"])).intersection(roles):
            raise HTTPException(403, "Permissao insuficiente")
        return user

    return dependency
