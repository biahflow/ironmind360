import io
import json
import logging
import re
import uuid
from typing import Any, Optional

from app.adapters.storage import S3StorageProvider
from app.database import db
from app.models.health import (
    AlertLevel,
    DocumentStatus,
    MarkerFlag,
    MarkerStatus,
)
from app.security import now_utc


logger = logging.getLogger("ironmind.health")
storage = S3StorageProvider()

MAX_FILE_SIZE = 20 * 1024 * 1024
MAX_PAGES = 30

ALLOWED_CONTENT_TYPES = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
}

PDF_MAGIC = b"%PDF"
JPEG_MAGIC = b"\xff\xd8\xff"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def validate_file_signature(data: bytes, declared_type: str) -> bool:
    if declared_type == "application/pdf":
        return data[:4] == PDF_MAGIC
    if declared_type == "image/jpeg":
        return data[:3] == JPEG_MAGIC
    if declared_type == "image/png":
        return data[:8] == PNG_MAGIC
    return False


def count_pdf_pages(data: bytes) -> int:
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(data))
        return len(reader.pages)
    except Exception:
        return 0


def extract_pdf_text(data: bytes) -> str:
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(data))
        texts = []
        for page in reader.pages:
            text = page.extract_text() or ""
            texts.append(text)
        return "\n\n".join(texts)
    except Exception:
        return ""


def extract_pdf_text_pdfplumber(data: bytes) -> str:
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            texts = []
            for page in pdf.pages:
                text = page.extract_text() or ""
                texts.append(text)
            return "\n\n".join(texts)
    except Exception:
        return ""


def sanitize_extracted_text(text: str) -> str:
    """Remove potential prompt injection patterns from extracted text."""
    dangerous_patterns = [
        r"(?i)ignore\s+(previous|all|above)\s+(instructions?|prompts?)",
        r"(?i)you\s+are\s+now\s+",
        r"(?i)system\s*:\s*",
        r"(?i)assistant\s*:\s*",
        r"(?i)<\s*/?system\s*>",
    ]
    sanitized = text
    for pattern in dangerous_patterns:
        sanitized = re.sub(pattern, "[REDACTED]", sanitized)
    return sanitized


def classify_marker_flag(
    value: Optional[float],
    ref_low: Optional[float],
    ref_high: Optional[float],
) -> MarkerFlag:
    if value is None:
        return MarkerFlag.normal
    if ref_low is not None and ref_high is not None:
        range_size = ref_high - ref_low
        if range_size > 0:
            if value < ref_low - range_size * 0.5:
                return MarkerFlag.critico_baixo
            if value > ref_high + range_size * 0.5:
                return MarkerFlag.critico_alto
        if value < ref_low:
            return MarkerFlag.baixo
        if value > ref_high:
            return MarkerFlag.alto
    elif ref_low is not None:
        if value < ref_low:
            return MarkerFlag.baixo
    elif ref_high is not None:
        if value > ref_high:
            return MarkerFlag.alto
    return MarkerFlag.normal


def generate_alert(
    marker_name: str,
    flag: MarkerFlag,
    value: Optional[float],
    unit: Optional[str],
    ref_text: Optional[str],
) -> tuple[Optional[AlertLevel], Optional[str]]:
    if flag == MarkerFlag.normal:
        return None, None

    if value is not None and unit:
        val_str = f"{value} {unit}"
    elif value is not None:
        val_str = str(value)
    else:
        val_str = "N/A"
    ref_str = f" (ref: {ref_text})" if ref_text else ""

    if flag in (MarkerFlag.critico_baixo, MarkerFlag.critico_alto):
        level = AlertLevel.prioritario
        text = f"{marker_name}: {val_str} significativamente fora da referencia{ref_str}. Procure avaliacao medica."
    elif flag in (MarkerFlag.baixo, MarkerFlag.alto):
        level = AlertLevel.atencao
        direction = "abaixo" if flag == MarkerFlag.baixo else "acima"
        text = f"{marker_name}: {val_str} {direction} da referencia{ref_str}."
    else:
        return None, None
    return level, text


EXTRACTION_SYSTEM_PROMPT = (  # noqa: E501
    "Voce e um extrator de dados de exames medicos. "
    "Extraia SOMENTE os dados presentes no documento.\n"
    "NAO invente valores. NAO interprete resultados. NAO faca diagnosticos.\n\n"
    "Responda SOMENTE com JSON valido no formato:\n"
    '{\n'
    '  "doc_type": "tipo do exame (hemograma, bioquimico, hormonal, etc)",\n'
    '  "doc_issuer": "laboratorio ou clinica emissora",\n'
    '  "doc_date": "data do exame em formato YYYY-MM-DD se possivel",\n'
    '  "markers": [\n'
    '    {\n'
    '      "name": "nome do marcador",\n'
    '      "value": 0.0,\n'
    '      "value_text": "valor como texto se nao numerico",\n'
    '      "unit": "unidade",\n'
    '      "reference_low": 0.0,\n'
    '      "reference_high": 0.0,\n'
    '      "reference_text": "texto da referencia original",\n'
    '      "page": 1,\n'
    '      "category": "categoria (hematologia, bioquimica, hormonal, etc)"\n'
    '    }\n'
    '  ]\n'
    '}\n\n'
    "Regras:\n"
    "- Use a faixa de referencia EXATAMENTE como impressa no documento.\n"
    "- Se o valor nao for numerico, coloque em value_text e deixe value como null.\n"
    "- Se a referencia nao for clara, coloque em reference_text e "
    "deixe reference_low/high como null.\n"
    "- NAO adicione marcadores que nao existam no documento.\n"
    "- NAO modifique valores ou unidades.\n"
)


def build_extraction_prompt(text: str) -> str:
    truncated = text[:12000]
    return f"Extraia os marcadores do seguinte texto de exame medico:\n\n{truncated}"


def validate_extraction(raw: dict) -> tuple[dict, list[dict]]:
    """Second validation pass. Returns (metadata, valid_markers)."""
    markers = raw.get("markers", [])
    validated = []
    for m in markers:
        name = m.get("name", "").strip()
        if not name:
            continue
        value = m.get("value")
        if value is not None:
            try:
                value = float(value)
            except (TypeError, ValueError):
                value = None
        ref_low = m.get("reference_low")
        if ref_low is not None:
            try:
                ref_low = float(ref_low)
            except (TypeError, ValueError):
                ref_low = None
        ref_high = m.get("reference_high")
        if ref_high is not None:
            try:
                ref_high = float(ref_high)
            except (TypeError, ValueError):
                ref_high = None

        has_ambiguity = (
            (value is None and not m.get("value_text"))
            or (ref_low is None and ref_high is None and not m.get("reference_text"))
        )
        flag = classify_marker_flag(value, ref_low, ref_high)
        status = MarkerStatus.needs_review if has_ambiguity else MarkerStatus.validated
        alert_level, alert_text = generate_alert(
            name, flag, value, m.get("unit"), m.get("reference_text")
        )

        validated.append({
            "name": name,
            "value": value,
            "value_text": m.get("value_text"),
            "unit": m.get("unit"),
            "reference_low": ref_low,
            "reference_high": ref_high,
            "reference_text": m.get("reference_text"),
            "flag": flag.value,
            "page": m.get("page"),
            "category": m.get("category"),
            "status": status.value,
            "alert_level": alert_level.value if alert_level else None,
            "alert_text": alert_text,
            "context_enabled": status == MarkerStatus.validated,
        })

    metadata = {
        "doc_type": raw.get("doc_type"),
        "doc_issuer": raw.get("doc_issuer"),
        "doc_date": raw.get("doc_date"),
    }
    return metadata, validated


async def create_health_document(
    *, user_id: str, file_id: str, content_type: str,
    original_name: Optional[str], page_count: Optional[int],
    title: Optional[str],
) -> dict:
    doc_id = str(uuid.uuid4())
    document: dict[str, Any] = {
        "_id": doc_id,
        "user_id": user_id,
        "file_id": file_id,
        "content_type": content_type,
        "original_name": original_name,
        "page_count": page_count,
        "title": title or original_name,
        "status": DocumentStatus.uploaded.value,
        "error": None,
        "doc_type": None,
        "doc_issuer": None,
        "doc_date": None,
        "marker_count": 0,
        "alerts": [],
        "created_at": now_utc(),
        "processed_at": None,
        "deleted_at": None,
    }
    await db.health_documents.insert_one(document)
    return document


async def get_user_documents(user_id: str, skip: int = 0, limit: int = 50) -> list[dict]:
    cursor = db.health_documents.find(
        {"user_id": user_id, "deleted_at": None}
    ).sort("created_at", -1).skip(skip).limit(limit)
    return await cursor.to_list()


async def get_user_document(doc_id: str, user_id: str) -> Optional[dict]:
    return await db.health_documents.find_one(
        {"_id": doc_id, "user_id": user_id, "deleted_at": None}
    )


async def get_document_markers(doc_id: str, user_id: str) -> list[dict]:
    doc = await get_user_document(doc_id, user_id)
    if not doc:
        return []
    cursor = db.health_markers.find(
        {"document_id": doc_id, "user_id": user_id, "deleted_at": None}
    ).sort("page", 1)
    return await cursor.to_list()


async def correct_marker(
    marker_id: str, user_id: str, corrections: dict
) -> Optional[dict]:
    marker = await db.health_markers.find_one(
        {"_id": marker_id, "user_id": user_id, "deleted_at": None}
    )
    if not marker:
        return None
    update: dict = {}
    for field in ("value", "value_text", "unit", "reference_low", "reference_high",
                  "reference_text", "flag"):
        if field in corrections and corrections[field] is not None:
            update[field] = corrections[field]
    if "value" in update or "reference_low" in update or "reference_high" in update:
        val = update.get("value", marker.get("value"))
        rl = update.get("reference_low", marker.get("reference_low"))
        rh = update.get("reference_high", marker.get("reference_high"))
        new_flag = classify_marker_flag(val, rl, rh)
        update["flag"] = new_flag.value
        ref_text = update.get("reference_text", marker.get("reference_text"))
        alert_level, alert_text = generate_alert(
            marker["name"], new_flag, val, update.get("unit", marker.get("unit")), ref_text
        )
        update["alert_level"] = alert_level.value if alert_level else None
        update["alert_text"] = alert_text

    update["status"] = MarkerStatus.corrected.value
    update["context_enabled"] = True
    update["corrected_by"] = user_id
    update["corrected_at"] = now_utc()

    await db.health_markers.update_one(
        {"_id": marker_id}, {"$set": update}
    )
    return await db.health_markers.find_one({"_id": marker_id})


async def toggle_marker_context(
    marker_id: str, user_id: str, enabled: bool
) -> Optional[dict]:
    result = await db.health_markers.update_one(
        {"_id": marker_id, "user_id": user_id, "deleted_at": None},
        {"$set": {"context_enabled": enabled}},
    )
    if result.modified_count == 0:
        return None
    return await db.health_markers.find_one({"_id": marker_id})


async def delete_health_document(doc_id: str, user_id: str) -> bool:
    doc = await get_user_document(doc_id, user_id)
    if not doc:
        return False
    now = now_utc()
    await db.health_documents.update_one(
        {"_id": doc_id}, {"$set": {"status": DocumentStatus.deleted.value, "deleted_at": now}}
    )
    await db.health_markers.update_many(
        {"document_id": doc_id, "user_id": user_id},
        {"$set": {"deleted_at": now}},
    )
    from app.services.files import delete_file, owned_file
    try:
        file_doc = await owned_file(doc["file_id"], user_id)
        await delete_file(file_doc)
    except Exception:
        logger.warning("Falha ao excluir arquivo do storage: %s", doc["file_id"])
    return True


async def get_marker_trends(
    user_id: str, marker_name: str, limit: int = 50
) -> list[dict]:
    date_fallback: dict[str, Any] = {
        "$ifNull": [
            "$doc.doc_date",
            {"$dateToString": {"format": "%Y-%m-%d", "date": "$doc.created_at"}},
        ]
    }
    pipeline: list[dict[str, Any]] = [
        {"$match": {
            "user_id": user_id,
            "name": {"$regex": f"^{re.escape(marker_name)}$", "$options": "i"},
            "deleted_at": None,
            "context_enabled": True,
            "value": {"$ne": None},
        }},
        {"$lookup": {
            "from": "health_documents",
            "localField": "document_id",
            "foreignField": "_id",
            "as": "doc",
        }},
        {"$unwind": "$doc"},
        {"$match": {"doc.deleted_at": None}},
        {"$sort": {"doc.doc_date": 1, "doc.created_at": 1}},
        {"$limit": limit},
        {"$project": {
            "date": date_fallback,
            "value": 1,
            "unit": 1,
            "document_id": 1,
            "flag": 1,
        }},
    ]
    cursor = await db.health_markers.aggregate(pipeline)  # type: ignore[arg-type]
    return await cursor.to_list()


async def process_document_extraction(doc_id: str, user_id: str) -> None:
    """Called by Celery task to process document."""
    doc = await db.health_documents.find_one({"_id": doc_id, "user_id": user_id})
    if not doc or doc.get("deleted_at"):
        return

    await db.health_documents.update_one(
        {"_id": doc_id},
        {"$set": {"status": DocumentStatus.extracting.value}},
    )

    file_doc = await db.files.find_one({"_id": doc["file_id"], "deleted_at": None})
    if not file_doc:
        await db.health_documents.update_one(
            {"_id": doc_id},
            {"$set": {"status": DocumentStatus.failed.value, "error": "Arquivo nao encontrado"}},
        )
        return

    try:
        data, _ = await storage.get(file_doc["storage_key"])
    except Exception:
        await db.health_documents.update_one(
            {"_id": doc_id},
            {"$set": {"status": DocumentStatus.failed.value, "error": "Falha ao ler arquivo"}},
        )
        return

    text = ""
    if doc["content_type"] == "application/pdf":
        text = extract_pdf_text(data)
        if len(text.strip()) < 50:
            text = extract_pdf_text_pdfplumber(data)
    else:
        pass

    text = sanitize_extracted_text(text)

    await db.health_documents.update_one(
        {"_id": doc_id},
        {"$set": {"status": DocumentStatus.validating.value}},
    )

    if len(text.strip()) < 20:
        try:
            from app.adapters.ai import complete_image, complete_text
            from app.config import settings
            if doc["content_type"] == "application/pdf":
                ocr_hint = "(Documento PDF sem texto extraivel. Analise a imagem.)"
                raw_response = await complete_text(
                    session_id=f"health-ocr-{doc_id}",
                    system=EXTRACTION_SYSTEM_PROMPT,
                    prompt=build_extraction_prompt(ocr_hint),
                    provider=settings.vision_provider,
                    model=settings.vision_model,
                )
            else:
                raw_response = await complete_image(
                    system=EXTRACTION_SYSTEM_PROMPT,
                    prompt="Extraia os marcadores deste exame medico.",
                    image_bytes=data,
                    provider=settings.vision_provider,
                    model=settings.vision_model,
                    media_type=doc["content_type"],
                )
        except Exception as e:
            await db.health_documents.update_one(
                {"_id": doc_id},
                {"$set": {
                    "status": DocumentStatus.failed.value,
                    "error": f"Falha na extracao: {str(e)[:200]}",
                }},
            )
            return
    else:
        try:
            from app.adapters.ai import complete_text
            raw_response = await complete_text(
                session_id=f"health-{doc_id}",
                system=EXTRACTION_SYSTEM_PROMPT,
                prompt=build_extraction_prompt(text),
                provider="anthropic",
                model="claude-sonnet-5",
            )
        except Exception as e:
            await db.health_documents.update_one(
                {"_id": doc_id},
                {"$set": {
                    "status": DocumentStatus.failed.value,
                    "error": f"Falha na extracao: {str(e)[:200]}",
                }},
            )
            return

    try:
        if raw_response.startswith("```"):
            raw_response = raw_response.split("```", 2)[1].removeprefix("json").strip()
        parsed = json.loads(raw_response)
    except json.JSONDecodeError:
        start, end = raw_response.find("{"), raw_response.rfind("}")
        if start < 0 or end <= start:
            await db.health_documents.update_one(
                {"_id": doc_id},
                {"$set": {
                    "status": DocumentStatus.failed.value,
                    "error": "Resposta da IA nao e JSON valido",
                }},
            )
            return
        try:
            parsed = json.loads(raw_response[start:end + 1])
        except json.JSONDecodeError:
            await db.health_documents.update_one(
                {"_id": doc_id},
                {"$set": {
                    "status": DocumentStatus.failed.value,
                    "error": "Resposta da IA nao e JSON valido",
                }},
            )
            return

    metadata, validated_markers = validate_extraction(parsed)

    now = now_utc()
    alerts = []
    has_review = False
    for marker_data in validated_markers:
        marker_id = str(uuid.uuid4())
        marker_doc = {
            "_id": marker_id,
            "document_id": doc_id,
            "user_id": user_id,
            **marker_data,
            "created_at": now,
            "deleted_at": None,
        }
        await db.health_markers.insert_one(marker_doc)
        if marker_data.get("alert_level"):
            alerts.append({
                "level": marker_data["alert_level"],
                "text": marker_data["alert_text"],
                "marker_id": marker_id,
            })
        if marker_data["status"] == MarkerStatus.needs_review.value:
            has_review = True

    final_status = (
        DocumentStatus.needs_review.value if has_review
        else DocumentStatus.ready.value
    )

    await db.health_documents.update_one(
        {"_id": doc_id},
        {"$set": {
            "status": final_status,
            "doc_type": metadata.get("doc_type"),
            "doc_issuer": metadata.get("doc_issuer"),
            "doc_date": metadata.get("doc_date"),
            "marker_count": len(validated_markers),
            "alerts": alerts,
            "processed_at": now,
        }},
    )
