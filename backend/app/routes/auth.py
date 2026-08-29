import logging

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.adapters.email import SMTPEmailProvider
from app.config import settings
from app.database import db
from app.dependencies import current_user
from app.models import ActionTokenIn, EmailIn, LoginIn, RefreshIn, RegisterIn, ResetPasswordIn
from app.rate_limit import rate_limit
from app.security import (
    create_action_token,
    decode_token,
    hash_password,
    issue_token_pair,
    now_utc,
    public_user,
    token_hash,
    verify_password,
)


router = APIRouter(prefix="/auth", tags=["auth"])
email_provider = SMTPEmailProvider()
logger = logging.getLogger("ironmind.auth")


async def _send_action_email(user: dict, purpose: str) -> None:
    raw = await create_action_token(str(user["_id"]), purpose)
    if purpose == "verify_email":
        path, subject = "verify-email", "Verifique seu e-mail no IronMind 360"
    else:
        path, subject = "reset-password", "Recupere sua senha do IronMind 360"
    link = f"{settings.app_public_url}/{path}?token={raw}"
    try:
        await email_provider.send(to=user["email"], subject=subject, text=f"Acesse: {link}")
    except Exception:
        logger.warning("Falha ao enviar e-mail transacional", extra={"purpose": purpose})


@router.post("/register")
async def register(data: RegisterIn):
    document = {
        "email": data.email.lower(),
        "name": data.name.strip(),
        "password_hash": hash_password(data.password),
        "roles": ["athlete"],
        "email_verified_at": None,
        "goals": {"calories": 2200, "protein": 150, "water_ml": 3000, "sleep_hours": 7.5},
        "intervals_api_key": None,
        "intervals_athlete_id": "0",
        "created_at": now_utc(),
        "deleted_at": None,
    }
    try:
        result = await db.users.insert_one(document)
    except DuplicateKeyError as exc:
        raise HTTPException(409, "Email ja cadastrado") from exc
    document["_id"] = result.inserted_id
    tokens = await issue_token_pair(str(result.inserted_id), device_name="registration")
    await _send_action_email(document, "verify_email")
    return {**tokens, "user": public_user(document)}


@router.post("/login", dependencies=[Depends(rate_limit("login", 10, 60))])
async def login(data: LoginIn):
    user = await db.users.find_one({"email": data.email.lower(), "deleted_at": None})
    if not user or not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(401, "Email ou senha invalidos")
    tokens = await issue_token_pair(str(user["_id"]), device_name=data.device_name)
    return {**tokens, "user": public_user(user)}


@router.post("/refresh")
async def refresh(data: RefreshIn):
    payload = decode_token(data.refresh_token, "refresh")
    session_id = payload.get("sid")
    token_id = payload.get("jti")
    user_id = payload.get("sub")
    if not (
        isinstance(session_id, str) and session_id
        and isinstance(token_id, str) and token_id
        and isinstance(user_id, str) and user_id
    ):
        raise HTTPException(401, "Refresh token invalido")
    used = await db.refresh_tokens.find_one_and_update(
        {
            "_id": token_id,
            "session_id": session_id,
            "user_id": user_id,
            "token_hash": token_hash(data.refresh_token),
            "used_at": None,
            "expires_at": {"$gt": now_utc()},
        },
        {"$set": {"used_at": now_utc()}},
        return_document=ReturnDocument.BEFORE,
    )
    if not used:
        await db.sessions.update_one({"_id": session_id}, {"$set": {"revoked_at": now_utc()}})
        raise HTTPException(401, "Refresh token reutilizado ou revogado")
    session = await db.sessions.find_one({"_id": session_id, "user_id": user_id, "revoked_at": None})
    if not session:
        raise HTTPException(401, "Sessao revogada")
    return await issue_token_pair(user_id, session_id=session_id)


@router.post("/logout")
async def logout(user: dict = Depends(current_user)):
    await db.sessions.update_one(
        {"_id": user["_session_id"], "user_id": str(user["_id"])},
        {"$set": {"revoked_at": now_utc()}},
    )
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(current_user)):
    return public_user(user)


@router.post("/verify-email/request", status_code=202)
async def request_verification(user: dict = Depends(current_user)):
    if not user.get("email_verified_at"):
        await _send_action_email(user, "verify_email")
    return {"ok": True}


@router.post("/verify-email/confirm")
async def confirm_verification(data: ActionTokenIn):
    action = await db.action_tokens.find_one_and_update(
        {
            "token_hash": token_hash(data.token),
            "purpose": "verify_email",
            "used_at": None,
            "expires_at": {"$gt": now_utc()},
        },
        {"$set": {"used_at": now_utc()}},
        return_document=ReturnDocument.BEFORE,
    )
    if not action:
        raise HTTPException(400, "Token de verificacao invalido ou expirado")
    await db.users.update_one({"_id": ObjectId(action["user_id"])}, {"$set": {"email_verified_at": now_utc()}})
    return {"ok": True}


@router.post("/password/forgot", status_code=202)
async def forgot_password(data: EmailIn):
    user = await db.users.find_one({"email": data.email.lower(), "deleted_at": None})
    if user:
        await _send_action_email(user, "reset_password")
    return {"ok": True}


@router.post("/password/reset")
async def reset_password(data: ResetPasswordIn):
    action = await db.action_tokens.find_one_and_update(
        {
            "token_hash": token_hash(data.token),
            "purpose": "reset_password",
            "used_at": None,
            "expires_at": {"$gt": now_utc()},
        },
        {"$set": {"used_at": now_utc()}},
        return_document=ReturnDocument.BEFORE,
    )
    if not action:
        raise HTTPException(400, "Token de recuperacao invalido ou expirado")
    user_id = action["user_id"]
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"password_hash": hash_password(data.password)}})
    await db.sessions.update_many({"user_id": user_id, "revoked_at": None}, {"$set": {"revoked_at": now_utc()}})
    return {"ok": True}
