from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class DocumentStatus(str, Enum):
    uploaded = "uploaded"
    extracting = "extracting"
    validating = "validating"
    needs_review = "needs_review"
    ready = "ready"
    failed = "failed"
    deleted = "deleted"


class AlertLevel(str, Enum):
    informativo = "informativo"
    atencao = "atencao"
    prioritario = "prioritario"


class MarkerFlag(str, Enum):
    normal = "normal"
    baixo = "baixo"
    alto = "alto"
    critico_baixo = "critico_baixo"
    critico_alto = "critico_alto"


class MarkerStatus(str, Enum):
    validated = "validated"
    needs_review = "needs_review"
    disabled = "disabled"
    corrected = "corrected"


class HealthDocumentUpload(BaseModel):
    title: Optional[str] = None


class ExtractedMarker(BaseModel):
    name: str
    value: Optional[float] = None
    value_text: Optional[str] = None
    unit: Optional[str] = None
    reference_low: Optional[float] = None
    reference_high: Optional[float] = None
    reference_text: Optional[str] = None
    flag: MarkerFlag = MarkerFlag.normal
    page: Optional[int] = None
    category: Optional[str] = None


class MarkerCorrection(BaseModel):
    value: Optional[float] = None
    value_text: Optional[str] = None
    unit: Optional[str] = None
    reference_low: Optional[float] = None
    reference_high: Optional[float] = None
    reference_text: Optional[str] = None
    flag: Optional[MarkerFlag] = None


class HealthDocumentOut(BaseModel):
    id: str
    title: Optional[str] = None
    file_id: str
    content_type: str
    original_name: Optional[str] = None
    page_count: Optional[int] = None
    status: DocumentStatus
    error: Optional[str] = None
    doc_type: Optional[str] = None
    doc_issuer: Optional[str] = None
    doc_date: Optional[str] = None
    marker_count: int = 0
    alerts: list[dict] = Field(default_factory=list)
    created_at: datetime
    processed_at: Optional[datetime] = None


class MarkerOut(BaseModel):
    id: str
    document_id: str
    name: str
    value: Optional[float] = None
    value_text: Optional[str] = None
    unit: Optional[str] = None
    reference_low: Optional[float] = None
    reference_high: Optional[float] = None
    reference_text: Optional[str] = None
    flag: MarkerFlag
    page: Optional[int] = None
    category: Optional[str] = None
    status: MarkerStatus
    alert_level: Optional[AlertLevel] = None
    alert_text: Optional[str] = None
    context_enabled: bool = True
    corrected_by: Optional[str] = None
    corrected_at: Optional[datetime] = None
    created_at: datetime


class TrendPoint(BaseModel):
    date: str
    value: float
    unit: str
    document_id: str
    flag: MarkerFlag
