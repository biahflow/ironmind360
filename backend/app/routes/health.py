from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from typing import Optional

from app.dependencies import current_user
from app.models.health import MarkerCorrection
from app.rate_limit import rate_limit
from app.services.health import (
    ALLOWED_CONTENT_TYPES,
    MAX_FILE_SIZE,
    MAX_PAGES,
    correct_marker,
    count_pdf_pages,
    create_health_document,
    delete_health_document,
    get_document_markers,
    get_marker_trends,
    get_user_document,
    get_user_documents,
    toggle_marker_context,
    validate_file_signature,
)
from app.services.files import create_file


router = APIRouter(prefix="/health", tags=["health"])


def _doc_to_out(doc: dict) -> dict:
    return {
        "id": doc["_id"],
        "title": doc.get("title"),
        "file_id": doc["file_id"],
        "content_type": doc["content_type"],
        "original_name": doc.get("original_name"),
        "page_count": doc.get("page_count"),
        "status": doc["status"],
        "error": doc.get("error"),
        "doc_type": doc.get("doc_type"),
        "doc_issuer": doc.get("doc_issuer"),
        "doc_date": doc.get("doc_date"),
        "marker_count": doc.get("marker_count", 0),
        "alerts": doc.get("alerts", []),
        "created_at": doc["created_at"],
        "processed_at": doc.get("processed_at"),
    }


def _marker_to_out(m: dict) -> dict:
    return {
        "id": m["_id"],
        "document_id": m["document_id"],
        "name": m["name"],
        "value": m.get("value"),
        "value_text": m.get("value_text"),
        "unit": m.get("unit"),
        "reference_low": m.get("reference_low"),
        "reference_high": m.get("reference_high"),
        "reference_text": m.get("reference_text"),
        "flag": m["flag"],
        "page": m.get("page"),
        "category": m.get("category"),
        "status": m["status"],
        "alert_level": m.get("alert_level"),
        "alert_text": m.get("alert_text"),
        "context_enabled": m.get("context_enabled", True),
        "corrected_by": m.get("corrected_by"),
        "corrected_at": m.get("corrected_at"),
        "created_at": m["created_at"],
    }


@router.post(
    "/documents",
    status_code=201,
    dependencies=[Depends(rate_limit("health_upload", 10, 60))],
)
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = None,
    user: dict = Depends(current_user),
):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(400, "Formato nao aceito. Use PDF, JPG ou PNG.")

    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(400, f"Arquivo excede o limite de {MAX_FILE_SIZE // (1024*1024)} MB.")

    if not validate_file_signature(data, file.content_type):
        raise HTTPException(400, "Assinatura do arquivo nao corresponde ao tipo declarado.")

    page_count = None
    if file.content_type == "application/pdf":
        page_count = count_pdf_pages(data)
        if page_count > MAX_PAGES:
            raise HTTPException(400, f"PDF excede o limite de {MAX_PAGES} paginas.")

    user_id = str(user["_id"])
    file_doc = await create_file(
        owner_user_id=user_id,
        data=data,
        content_type=file.content_type,
        original_name=file.filename,
    )

    health_doc = await create_health_document(
        user_id=user_id,
        file_id=file_doc["_id"],
        content_type=file.content_type,
        original_name=file.filename,
        page_count=page_count,
        title=title,
    )

    from app.workers.health_tasks import process_health_document
    process_health_document.delay(health_doc["_id"], user_id)

    return _doc_to_out(health_doc)


@router.get("/documents")
async def list_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user: dict = Depends(current_user),
):
    docs = await get_user_documents(str(user["_id"]), skip, limit)
    return [_doc_to_out(d) for d in docs]


@router.get("/documents/{doc_id}")
async def get_document(doc_id: str, user: dict = Depends(current_user)):
    doc = await get_user_document(doc_id, str(user["_id"]))
    if not doc:
        raise HTTPException(404, "Documento nao encontrado")
    return _doc_to_out(doc)


@router.get("/documents/{doc_id}/markers")
async def list_markers(doc_id: str, user: dict = Depends(current_user)):
    doc = await get_user_document(doc_id, str(user["_id"]))
    if not doc:
        raise HTTPException(404, "Documento nao encontrado")
    markers = await get_document_markers(doc_id, str(user["_id"]))
    return [_marker_to_out(m) for m in markers]


@router.patch("/markers/{marker_id}")
async def update_marker(
    marker_id: str,
    body: MarkerCorrection,
    user: dict = Depends(current_user),
):
    corrections = body.model_dump(exclude_none=True)
    if not corrections:
        raise HTTPException(400, "Nenhuma correcao informada")
    updated = await correct_marker(marker_id, str(user["_id"]), corrections)
    if not updated:
        raise HTTPException(404, "Marcador nao encontrado")
    return _marker_to_out(updated)


@router.patch("/markers/{marker_id}/context")
async def set_marker_context(
    marker_id: str,
    enabled: bool = True,
    user: dict = Depends(current_user),
):
    updated = await toggle_marker_context(marker_id, str(user["_id"]), enabled)
    if not updated:
        raise HTTPException(404, "Marcador nao encontrado")
    return _marker_to_out(updated)


@router.delete("/documents/{doc_id}", status_code=204)
async def remove_document(doc_id: str, user: dict = Depends(current_user)):
    deleted = await delete_health_document(doc_id, str(user["_id"]))
    if not deleted:
        raise HTTPException(404, "Documento nao encontrado")
    return None


@router.get("/trends/{marker_name}")
async def marker_trends(
    marker_name: str,
    limit: int = Query(50, ge=1, le=200),
    user: dict = Depends(current_user),
):
    points = await get_marker_trends(str(user["_id"]), marker_name, limit)
    return [
        {
            "date": p.get("date"),
            "value": p.get("value"),
            "unit": p.get("unit"),
            "document_id": p.get("document_id"),
            "flag": p.get("flag"),
        }
        for p in points
    ]
