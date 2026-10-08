from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


Audience = Literal["public", "customer", "vendor", "internal", "admin"]
AUDIENCE_DESCRIPTION = (
    "Who the AI may show this content to: public | customer | vendor | internal | admin. "
    "Defaults to internal."
)


class TicketMapping(BaseModel):
    id_field: Optional[str] = None
    question_field: Optional[str] = None
    answer_field: Optional[str] = None
    title_field: Optional[str] = None
    messages_field: Optional[str] = None
    extra_fields: Optional[List[str]] = None


class PaginationConfig(BaseModel):
    type: Literal["none", "page", "cursor"] = "none"
    page_param: Optional[str] = None
    cursor_path: Optional[str] = None
    cursor_param: Optional[str] = None
    max_pages: int = Field(10, ge=1, le=100)


def _clean_str_map(value: Any) -> Optional[Dict[str, str]]:
    if value is None:
        return None
    if not isinstance(value, dict):
        raise ValueError("must be an object of string values")
    return {str(k): "" if v is None else str(v) for k, v in value.items() if str(k).strip()}


class ApiSourceConfig(BaseModel):
    tenant_id: Optional[str] = Field(None, description="Defaults to the API key's tenant; must match it if sent")
    name: Optional[str] = Field(None, description="Display name (defaults to the URL host)")
    audience: Optional[Audience] = Field(None, description=AUDIENCE_DESCRIPTION)
    url: str = Field(..., min_length=1)
    method: Literal["GET", "POST"] = "GET"
    headers: Optional[Dict[str, str]] = None
    query: Optional[Dict[str, str]] = None
    body: Optional[Any] = None
    data_path: Optional[str] = None
    source_type: Literal["support_tickets", "api_generic"] = "support_tickets"
    mapping: Optional[TicketMapping] = None
    pagination: Optional[PaginationConfig] = None

    @field_validator("method", mode="before")
    @classmethod
    def _upper(cls, v):
        return v.upper() if isinstance(v, str) else v

    @field_validator("headers", "query", mode="before")
    @classmethod
    def _str_map(cls, v):
        return _clean_str_map(v)

    @field_validator("tenant_id")
    @classmethod
    def _blank_tenant(cls, v):
        return (v.strip() or None) if isinstance(v, str) else v

    @field_validator("audience", mode="before")
    @classmethod
    def _lower_audience(cls, v):
        return (v.strip().lower() or None) if isinstance(v, str) else v

    @field_validator("url")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be empty")
        return v

    @field_validator("url")
    @classmethod
    def _http_url(cls, v: str) -> str:
        if not (v.lower().startswith("http://") or v.lower().startswith("https://")):
            raise ValueError("url must start with http:// or https://")
        return v

    @field_validator("data_path")
    @classmethod
    def _blank_path(cls, v):
        return v.strip() or None if isinstance(v, str) else v


class TextTrainPayload(BaseModel):
    tenant_id: Optional[str] = Field(None, description="Defaults to the API key's tenant; must match it if sent")
    name: Optional[str] = None
    content: str = Field(..., min_length=1)
    audience: Optional[Audience] = Field(None, description=AUDIENCE_DESCRIPTION)

    @field_validator("content")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must not be empty")
        return v

    @field_validator("tenant_id")
    @classmethod
    def _blank_tenant(cls, v):
        return (v.strip() or None) if isinstance(v, str) else v

    @field_validator("audience", mode="before")
    @classmethod
    def _lower_audience(cls, v):
        return (v.strip().lower() or None) if isinstance(v, str) else v


class SourceUpdate(BaseModel):
    """PATCH /api/train/sources/{id}: relabel and/or rename. Relabelling updates every document."""
    audience: Optional[Audience] = None
    name: Optional[str] = None

    @field_validator("audience", mode="before")
    @classmethod
    def _lower_audience(cls, v):
        return (v.strip().lower() or None) if isinstance(v, str) else v

    @field_validator("name")
    @classmethod
    def _name(cls, v):
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("must not be empty")
        return v


class TrainingSourceOut(BaseModel):
    source_id: str
    tenant_id: str
    name: str
    kind: str
    source_type: str
    filename: Optional[str] = None
    url: Optional[str] = None
    audience: str = "internal"
    status: str
    documents_count: int = 0
    records_count: int = 0
    last_task_id: Optional[str] = None
    last_synced_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    config: Optional[Dict[str, Any]] = None


class TrainResponse(BaseModel):
    source: TrainingSourceOut
    task_id: str


class SourcesTotals(BaseModel):
    sources: int
    documents: int


class SourcesListResponse(BaseModel):
    sources: List[TrainingSourceOut]
    totals: SourcesTotals


class PreviewRecord(BaseModel):
    title: str
    text: str


class ApiTestResult(BaseModel):
    ok: bool
    status_code: Optional[int] = None
    records_found: int = 0
    preview: List[PreviewRecord] = []
    detected_fields: List[str] = []
    error: Optional[str] = None
    # additions
    data_path: Optional[str] = None
    records_skipped: int = 0


class DeleteSourceResponse(BaseModel):
    deleted: bool
    documents_deleted: int
