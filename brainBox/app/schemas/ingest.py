from pydantic import BaseModel, Field
from typing import Literal, Optional

class IngestPayload(BaseModel):
    tenant_id: Optional[str] = Field(None, description="Tenant ID (optional: defaults to the API key's tenant)")
    source_type: str = Field(..., description="Type of data source (logs, codebase, etc)")
    content: str = Field(..., description="Content to ingest")
    content_hash: Optional[str] = Field(None, description="SHA256 hash for deduplication")
    file_path: Optional[str] = Field(None, description="File path for the content")
    metadata: Optional[dict] = Field(None, description="Additional metadata")
    audience: Optional[Literal["public", "customer", "vendor", "internal", "admin"]] = Field(
        None, description="Who may retrieve these chunks. Omitted = legacy (LEGACY_DOC_AUDIENCE)"
    )

class IngestResponse(BaseModel):
    status: str
    task_id: str
    message: str

class IngestionStatus(BaseModel):
    task_id: str
    status: str
    error_message: Optional[str] = None
