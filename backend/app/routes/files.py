from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from app.dependencies import current_user
from app.adapters.legacy_storage import legacy_storage
from app.services.files import owned_file, storage


router = APIRouter(prefix="/files", tags=["files"])


@router.get("/{file_id}")
async def download_file(file_id: str, user: dict = Depends(current_user)):
    document = await owned_file(file_id, str(user["_id"]))
    try:
        if document["provider"] == "s3":
            content, content_type = await storage.get(document["storage_key"])
        else:
            content, content_type = await legacy_storage.get(document["storage_key"])
    except Exception as exc:
        raise HTTPException(404, "Arquivo nao encontrado") from exc
    return Response(
        content=content,
        media_type=content_type,
        headers={
            "Cache-Control": "private, no-store",
            "Pragma": "no-cache",
            "X-Content-Type-Options": "nosniff",
        },
    )
