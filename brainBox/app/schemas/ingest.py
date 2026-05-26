from pydantic import BaseModel, Field
from typing import Optional

class IngestPayload(BaseModel):
    tenant_id: str = Field(..., description="Tenant ID for multi-tenancy")
    source_type: str = Field(..., description="Type of data source (logs, codebase, etc)")
    content: str = Field(..., description="Content to ingest")
    file_path: Optional[str] = Field(None, description="File path for the content")
    metadata: Optional[dict] = Field(None, description="Additional metadata")

class IngestResponse(BaseModel):
    status: str
    task_id: str
    message: str

class IngestionStatus(BaseModel):
    task_id: str
    status: str
    error_message: Optional[str] = None
