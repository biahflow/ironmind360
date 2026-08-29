from fastapi import APIRouter, Depends, HTTPException

from app.database import db
from app.dependencies import current_user
from app.models import ConsentIn
from app.security import now_utc
from app.services.audit import audit_event


router = APIRouter(prefix="/privacy", tags=["privacy"])


@router.get("/consents")
async def list_consents(user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    documents = await db.consents.find({"user_id": user_id}).sort("created_at", -1).to_list(500)
    latest: dict[str, dict] = {}
    for document in documents:
        purpose = document["purpose"]
        if purpose not in latest:
            latest[purpose] = {
                "purpose": purpose,
                "version": document["version"],
                "status": document["status"],
                "created_at": document["created_at"],
            }
    return {"consents": list(latest.values())}


@router.post("/consents", status_code=201)
async def grant_consent(data: ConsentIn, user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    document = {
        "user_id": user_id,
        "purpose": data.purpose,
        "version": data.version,
        "status": "granted",
        "origin": "user",
        "created_at": now_utc(),
    }
    result = await db.consents.insert_one(document)
    await audit_event(
        actor_user_id=user_id,
        action="consent.granted",
        resource_type="consent",
        resource_id=str(result.inserted_id),
    )
    return {**data.model_dump(), "status": "granted", "created_at": document["created_at"]}


@router.delete("/consents/{purpose}")
async def revoke_consent(purpose: str, user: dict = Depends(current_user)):
    user_id = str(user["_id"])
    current = await db.consents.find_one(
        {"user_id": user_id, "purpose": purpose}, sort=[("created_at", -1)]
    )
    if not current or current["status"] != "granted":
        raise HTTPException(404, "Consentimento ativo nao encontrado")
    document = {
        "user_id": user_id,
        "purpose": purpose,
        "version": current["version"],
        "status": "revoked",
        "origin": "user",
        "created_at": now_utc(),
    }
    result = await db.consents.insert_one(document)
    await audit_event(
        actor_user_id=user_id,
        action="consent.revoked",
        resource_type="consent",
        resource_id=str(result.inserted_id),
    )
    return {"ok": True, "purpose": purpose, "status": "revoked"}
