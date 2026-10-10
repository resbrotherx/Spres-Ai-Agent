"""Training API: teach a tenant's bot from files, free text and third-party APIs.

Handlers are plain ``def`` (run in FastAPI's threadpool) and hand heavy work
(extraction, embedding, API fetching) to BackgroundTasks.
"""
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlparse
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.db.models import Document, ProcessingTask, TrainingSource
from app.db.session import get_db
from app.dependencies import AuthContext, require_secret_key
from app.permissions import DEFAULT_SOURCE_AUDIENCE, validate_audience
from app.schemas.train import (
    ApiSourceConfig, ApiTestResult, DeleteSourceResponse, PreviewRecord, SourceUpdate,
    SourcesListResponse, TextTrainPayload, TrainingSourceOut, TrainResponse,
)
from app.training import service
from app.training.api_client import FetchError, fetch_first_page
from app.training.extractors import SUPPORTED_EXTENSIONS, docx_available
from app.training.records import detected_fields
from app.utils.logging import logger

# Training is server-side only: every route needs a secret key (publishable keys -> 403).
router = APIRouter(dependencies=[Depends(require_secret_key)])

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
STUCK_AFTER = timedelta(minutes=30)


def _audience(value: Optional[str]) -> str:
    try:
        return validate_audience(value, DEFAULT_SOURCE_AUDIENCE)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


def _clear_cache(tenant_id: str) -> None:
    try:
        from app.redis_cache.cache import clear_tenant_cache
        clear_tenant_cache(tenant_id)
    except Exception:
        pass


def _out(source: TrainingSource) -> TrainingSourceOut:
    return TrainingSourceOut(**service.source_to_dict(source))


def _queue(db: Session, source: TrainingSource) -> str:
    """Create a ProcessingTask (so /api/ingest/status/{task_id} works) and mark the source queued."""
    task_id = str(uuid4())
    db.add(ProcessingTask(
        tenant_id=source.tenant_id,
        task_id=task_id,
        status="queued",
        source_type=source.source_type,
        file_path=source.filename or source.url,
    ))
    source.status = "queued"
    source.error_message = None
    source.last_task_id = task_id
    return task_id


def _get_source(db: Session, source_id: str, tenant_id: str) -> TrainingSource:
    source = db.query(TrainingSource).filter(
        TrainingSource.source_id == source_id,
        TrainingSource.tenant_id == tenant_id,
    ).first()
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training source not found")
    return source


def _commit(db: Session) -> None:
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Training DB error: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error")


# ---------------------------------------------------------------------------
# files & text
# ---------------------------------------------------------------------------

@router.post("/train/file", response_model=TrainResponse, status_code=status.HTTP_202_ACCEPTED)
def train_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    tenant_id: Optional[str] = Form(None),
    name: Optional[str] = Form(None),
    audience: Optional[str] = Form(None),
    auth: AuthContext = Depends(require_secret_key),
    db: Session = Depends(get_db),
):
    tenant_id = auth.resolve_tenant(tenant_id)
    audience = _audience(audience)
    filename = os.path.basename((file.filename or "").replace("\\", "/")).strip()
    if not filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded file has no filename")
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in SUPPORTED_EXTENSIONS or (ext == "docx" and not docx_available()):
        allowed = sorted(e for e in SUPPORTED_EXTENSIONS if e != "docx" or docx_available())
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '.{ext}'. Allowed: {', '.join('.' + e for e in allowed)}",
        )
    if file.size is not None and file.size > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File exceeds the 25 MB limit")
    data = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File exceeds the 25 MB limit")
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded file is empty")

    source = TrainingSource(
        source_id=str(uuid4()),
        tenant_id=tenant_id,
        name=(name or "").strip() or filename,
        kind="file",
        source_type=ext,
        filename=filename,
        audience=audience,
        status="queued",
        documents_count=0,
        records_count=0,
    )
    db.add(source)
    task_id = _queue(db, source)
    _commit(db)
    db.refresh(source)
    service.publish_status(source)

    background_tasks.add_task(service.run_file_training, source.source_id, task_id, data, filename, ext)
    logger.info(f"Training file queued: {filename} ({len(data)} bytes) source={source.source_id} task={task_id}")
    return TrainResponse(source=_out(source), task_id=task_id)


@router.post("/train/text", response_model=TrainResponse, status_code=status.HTTP_202_ACCEPTED)
def train_text(
    payload: TextTrainPayload,
    background_tasks: BackgroundTasks,
    auth: AuthContext = Depends(require_secret_key),
    db: Session = Depends(get_db),
):
    tenant_id = auth.resolve_tenant(payload.tenant_id)
    name = (payload.name or "").strip() or (" ".join(payload.content.split())[:60] or "Text snippet")
    source = TrainingSource(
        source_id=str(uuid4()),
        tenant_id=tenant_id,
        name=name,
        kind="text",
        source_type="text",
        audience=_audience(payload.audience),
        status="queued",
        documents_count=0,
        records_count=0,
    )
    db.add(source)
    task_id = _queue(db, source)
    _commit(db)
    db.refresh(source)
    service.publish_status(source)
    background_tasks.add_task(service.run_text_training, source.source_id, task_id, payload.content)
    return TrainResponse(source=_out(source), task_id=task_id)


# ---------------------------------------------------------------------------
# third-party APIs
# ---------------------------------------------------------------------------

def _config_dict(cfg: ApiSourceConfig) -> dict:
    return {
        "kind": "api",
        "method": cfg.method,
        "headers": cfg.headers or {},
        "query": cfg.query or {},
        "body": cfg.body,
        "data_path": cfg.data_path,
        "source_type": cfg.source_type,
        "mapping": cfg.mapping.model_dump(exclude_none=True) if cfg.mapping else None,
        "pagination": cfg.pagination.model_dump() if cfg.pagination else None,
    }


@router.post("/train/api-source/test", response_model=ApiTestResult)
def test_api_source(cfg: ApiSourceConfig, auth: AuthContext = Depends(require_secret_key)):
    auth.resolve_tenant(cfg.tenant_id)
    config = {**_config_dict(cfg), "url": cfg.url}
    try:
        status_code, records, path = fetch_first_page(config)
    except FetchError as e:
        return ApiTestResult(ok=False, status_code=e.status_code, error=str(e))
    except Exception as e:  # defensive: never 500 on a bad remote
        logger.error(f"API source test failed: {e}", exc_info=True)
        return ApiTestResult(ok=False, error=f"Unexpected error: {e}")

    items, skipped, _ = service.build_api_chunks(config, records, cfg.url)
    preview = [PreviewRecord(title=i["title"], text=i["text"]) for i in items[:5]]
    error = None
    if not records:
        error = "No records found in the response. Set data_path to the list of records."
    elif not items:
        error = ("Records were found but none had a recognizable issue/response. "
                 "Set mapping.question_field / mapping.answer_field.")
    return ApiTestResult(
        ok=bool(items),
        status_code=status_code,
        records_found=len(records),
        preview=preview,
        detected_fields=detected_fields(records),
        error=error,
        data_path=path,
        records_skipped=skipped,
    )


@router.post("/train/api-source", response_model=TrainResponse, status_code=status.HTTP_202_ACCEPTED)
def create_api_source(
    cfg: ApiSourceConfig,
    background_tasks: BackgroundTasks,
    auth: AuthContext = Depends(require_secret_key),
    db: Session = Depends(get_db),
):
    tenant_id = auth.resolve_tenant(cfg.tenant_id)
    name = (cfg.name or "").strip() or (urlparse(cfg.url).hostname or cfg.url)
    source = TrainingSource(
        source_id=str(uuid4()),
        tenant_id=tenant_id,
        name=name,
        kind="api",
        source_type=cfg.source_type,
        audience=_audience(cfg.audience),
        url=cfg.url,
        config=json.dumps(_config_dict(cfg), default=str),
        status="queued",
        documents_count=0,
        records_count=0,
    )
    db.add(source)
    task_id = _queue(db, source)
    _commit(db)
    db.refresh(source)
    service.publish_status(source)
    background_tasks.add_task(service.run_api_sync, source.source_id, task_id)
    return TrainResponse(source=_out(source), task_id=task_id)


@router.post("/train/sources/{source_id}/sync", response_model=TrainResponse, status_code=status.HTTP_202_ACCEPTED)
def sync_source(
    source_id: str,
    background_tasks: BackgroundTasks,
    tenant_id: Optional[str] = Query(None),
    auth: AuthContext = Depends(require_secret_key),
    db: Session = Depends(get_db),
):
    tenant_id = auth.resolve_tenant(tenant_id)
    source = _get_source(db, source_id, tenant_id)
    if source.kind != "api":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only API sources can be synced")
    if source.status in ("queued", "processing"):
        updated = source.updated_at or source.created_at
        if updated is not None and updated.tzinfo is None:
            updated = updated.replace(tzinfo=timezone.utc)
        if updated is None or datetime.now(timezone.utc) - updated < STUCK_AFTER:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This source is already syncing")
    task_id = _queue(db, source)
    _commit(db)
    db.refresh(source)
    service.publish_status(source)
    background_tasks.add_task(service.run_api_sync, source.source_id, task_id)
    return TrainResponse(source=_out(source), task_id=task_id)


# ---------------------------------------------------------------------------
# listing & deletion
# ---------------------------------------------------------------------------

@router.get("/train/sources", response_model=SourcesListResponse)
def list_sources(
    tenant_id: Optional[str] = Query(None),
    auth: AuthContext = Depends(require_secret_key),
    db: Session = Depends(get_db),
):
    tenant_id = auth.resolve_tenant(tenant_id)
    sources = db.query(TrainingSource).filter(TrainingSource.tenant_id == tenant_id).order_by(
        TrainingSource.created_at.desc(), TrainingSource.id.desc()).all()
    return SourcesListResponse(
        sources=[_out(s) for s in sources],
        totals={"sources": len(sources), "documents": sum(s.documents_count or 0 for s in sources)},
    )


@router.get("/train/sources/{source_id}", response_model=TrainingSourceOut)
def get_source(
    source_id: str,
    tenant_id: Optional[str] = Query(None),
    auth: AuthContext = Depends(require_secret_key),
    db: Session = Depends(get_db),
):
    return _out(_get_source(db, source_id, auth.resolve_tenant(tenant_id)))


@router.patch("/train/sources/{source_id}", response_model=TrainingSourceOut)
def update_source(
    source_id: str,
    payload: SourceUpdate,
    tenant_id: Optional[str] = Query(None),
    auth: AuthContext = Depends(require_secret_key),
    db: Session = Depends(get_db),
):
    """Rename and/or relabel a source. A new audience is applied to all of its documents at once."""
    tenant_id = auth.resolve_tenant(tenant_id)
    source = _get_source(db, source_id, tenant_id)
    relabelled = 0
    if payload.name is not None:
        source.name = payload.name
    if payload.audience is not None:
        source.audience = payload.audience
        relabelled = db.query(Document).filter(
            Document.source_id == source.source_id,
            Document.tenant_id == tenant_id,
        ).update({Document.audience: payload.audience, Document.audience_origin: "source",
                  Document.audience_reason: None}, synchronize_session=False)
    _commit(db)
    db.refresh(source)
    if payload.audience is not None:
        _clear_cache(tenant_id)  # cached answers may have been built from now-hidden documents
        logger.info(f"Training source {source_id} relabelled to {payload.audience} ({relabelled} documents)")
    return _out(source)


@router.delete("/train/sources/{source_id}", response_model=DeleteSourceResponse)
def delete_source(
    source_id: str,
    tenant_id: Optional[str] = Query(None),
    auth: AuthContext = Depends(require_secret_key),
    db: Session = Depends(get_db),
):
    tenant_id = auth.resolve_tenant(tenant_id)
    source = _get_source(db, source_id, tenant_id)
    try:
        deleted_docs = db.query(Document).filter(
            Document.source_id == source.source_id,
            Document.tenant_id == tenant_id,
        ).delete(synchronize_session=False)
        db.delete(source)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete training source {source_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete source")
    _clear_cache(tenant_id)
    return DeleteSourceResponse(deleted=True, documents_deleted=deleted_docs)
