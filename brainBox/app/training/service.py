"""Background jobs that train a tenant's knowledge base from training sources."""
import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import func

from app.db.models import Document, ProcessingTask, TrainingSource
from app.db.session import SessionLocal
from app.ingestion.store import store_documents
from app.permissions import legacy_doc_audience
from app.training.api_client import FetchError, fetch_all
from app.training.extractors import Extraction, ExtractionError, extract_file, extract_text_content
from app.training.records import normalize_records
from app.utils.hashing import create_hash
from app.utils.logging import logger

REDACTED = "••••"
_SENSITIVE_RE = re.compile(r"auth|token|key|secret|passw|cookie|session|signature|credential|bearer", re.I)


# ---------------------------------------------------------------------------
# config (de)serialisation & redaction
# ---------------------------------------------------------------------------

def load_config(source: TrainingSource) -> Dict[str, Any]:
    try:
        return json.loads(source.config) if source.config else {}
    except (TypeError, ValueError):
        return {}


def _redact_obj(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: (REDACTED if _SENSITIVE_RE.search(str(k)) and v not in (None, "") else _redact_obj(v))
                for k, v in obj.items()}
    if isinstance(obj, list):
        return [_redact_obj(v) for v in obj]
    return obj


def redact_config(cfg: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(cfg)
    if out.get("headers"):
        out["headers"] = {k: (REDACTED if _SENSITIVE_RE.search(k) and v else v)
                          for k, v in out["headers"].items()}
    if out.get("query"):
        out["query"] = {k: (REDACTED if _SENSITIVE_RE.search(k) and v else v)
                        for k, v in out["query"].items()}
    if out.get("body") is not None:
        out["body"] = _redact_obj(out["body"])
    return out


def source_to_dict(source: TrainingSource) -> Dict[str, Any]:
    cfg = None
    if source.kind == "api":
        cfg = redact_config(load_config(source))
    return {
        "source_id": source.source_id,
        "tenant_id": source.tenant_id,
        "name": source.name,
        "kind": source.kind,
        "source_type": source.source_type,
        "filename": source.filename,
        "url": source.url,
        # NULL = source created before audiences existed; its documents are treated as legacy too.
        "audience": source.audience or legacy_doc_audience(),
        "status": source.status,
        "documents_count": source.documents_count or 0,
        "records_count": source.records_count or 0,
        "last_task_id": source.last_task_id,
        "last_synced_at": source.last_synced_at,
        "error_message": source.error_message,
        "created_at": source.created_at,
        "updated_at": source.updated_at,
        "config": cfg,
    }


# ---------------------------------------------------------------------------
# job helpers
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _set_task(db, task_id: str, status: str, error: Optional[str] = None) -> None:
    task = db.query(ProcessingTask).filter(ProcessingTask.task_id == task_id).first()
    if task:
        task.status = status
        task.error_message = error


def _start(db, source_id: str, task_id: str) -> Optional[TrainingSource]:
    source = db.query(TrainingSource).filter(TrainingSource.source_id == source_id).first()
    if source is None:
        logger.error(f"Training source {source_id} not found")
        _set_task(db, task_id, "failed", "Training source not found")
        db.commit()
        return None
    source.status = "processing"
    source.error_message = None
    _set_task(db, task_id, "processing")
    db.commit()
    return source


def _finish(db, source_id: str, task_id: str, status: str, error: Optional[str],
            records_count: Optional[int] = None, synced: bool = True) -> None:
    try:
        db.rollback()
    except Exception:
        pass
    source = db.query(TrainingSource).filter(TrainingSource.source_id == source_id).first()
    if source is not None:
        source.status = status
        source.error_message = error
        source.documents_count = db.query(func.count(Document.id)).filter(
            Document.source_id == source_id).scalar() or 0
        if records_count is not None:
            source.records_count = records_count
        if synced:
            source.last_synced_at = _now()
        # The source may have been relabelled (PATCH) while this job ran: keep docs in step.
        db.query(Document).filter(Document.source_id == source_id).update(
            {Document.audience: source.audience}, synchronize_session=False)
    else:
        # source was deleted while this job ran: don't leave orphaned chunks behind
        db.query(Document).filter(Document.source_id == source_id).delete(synchronize_session=False)
    _set_task(db, task_id, status, error)
    db.commit()
    if source is not None:
        try:
            from app.redis_cache.cache import clear_tenant_cache
            clear_tenant_cache(source.tenant_id)  # cached chat answers may now be stale
        except Exception:
            pass
    if source is not None and status == "failed":
        _notify_failure(db, source, error)


def _notify_failure(db, source: TrainingSource, error: Optional[str]) -> None:
    """Tell the tenant's admins/owners that a training source failed. Never raises."""
    try:
        from app.notify.service import notify_staff
        reason = (error or "Unknown error")[:300]
        notify_staff(
            db, source.tenant_id, "training_failed",
            title=f"Training failed: {source.name}"[:200],
            body=reason,
            link="#/training",
            min_role="admin",
            email_lines=[f"Source: {source.name}", f"Error: {reason}"],
            cta_text="Open training",
        )
    except Exception as e:
        logger.error(f"Training failure notification failed: {e}")


def _rows(source: TrainingSource, chunks: List[Dict[str, Any]], doc_source_type: str,
          file_path: Optional[str]) -> List[Dict[str, Any]]:
    rows = []
    for c in chunks:
        key = c.get("key") or ""
        meta = dict(c.get("metadata") or {})
        meta["source_id"] = source.source_id
        meta["source_name"] = source.name
        if key:
            meta["record_key"] = key
        # scoped per tenant + source so the same text in two sources/tenants never collides,
        # while re-syncing unchanged content in the same source is a no-op.
        h = create_hash(f"{source.tenant_id}\x1f{source.source_id}\x1f{key}\x1f{c['text']}")
        rows.append({
            "tenant_id": source.tenant_id,
            "source_type": doc_source_type,
            "file_path": file_path,
            "content": c["text"],
            "content_hash": h,
            "metadata": meta,
            "source_id": source.source_id,
            "audience": source.audience,
        })
    return rows


def _summarize(ex_notes: List[str], skipped_records: int, errors: int) -> Optional[str]:
    notes = list(ex_notes)
    if skipped_records:
        notes.append(f"{skipped_records} record(s) skipped (no issue or response found)")
    if errors:
        notes.append(f"{errors} chunk(s) failed to embed/store")
    return "; ".join(notes) or None


def _ingest_extraction(db, source: TrainingSource, task_id: str, ex: Extraction,
                       doc_source_type: str, file_path: Optional[str]) -> None:
    source_id = source.source_id
    rows = _rows(source, ex.chunks, ex.document_source_type or doc_source_type, file_path)
    added, dupes, errors = store_documents(db, rows)
    logger.info(f"Training {source_id}: {added} added, {dupes} duplicates, {errors} errors")
    error = _summarize(ex.notes, ex.skipped_records, errors)
    status = "failed" if (errors and not added and not dupes) or not rows else "completed"
    if not rows and not error:
        error = "No content could be extracted"
    _finish(db, source_id, task_id, status, error, records_count=ex.records_count)


# ---------------------------------------------------------------------------
# jobs (run via FastAPI BackgroundTasks)
# ---------------------------------------------------------------------------

def run_file_training(source_id: str, task_id: str, data: bytes, filename: str, ext: str) -> None:
    db = SessionLocal()
    try:
        source = _start(db, source_id, task_id)
        if source is None:
            return
        ex = extract_file(data, filename, ext)
        _ingest_extraction(db, source, task_id, ex, ext, filename)
    except ExtractionError as e:
        _finish(db, source_id, task_id, "failed", str(e))
    except Exception as e:
        logger.error(f"File training failed for {source_id}: {e}", exc_info=True)
        _finish(db, source_id, task_id, "failed", f"Processing error: {e}")
    finally:
        db.close()


def run_text_training(source_id: str, task_id: str, content: str) -> None:
    db = SessionLocal()
    try:
        source = _start(db, source_id, task_id)
        if source is None:
            return
        ex = extract_text_content(content, source.name)
        _ingest_extraction(db, source, task_id, ex, "text", None)
    except ExtractionError as e:
        _finish(db, source_id, task_id, "failed", str(e))
    except Exception as e:
        logger.error(f"Text training failed for {source_id}: {e}", exc_info=True)
        _finish(db, source_id, task_id, "failed", f"Processing error: {e}")
    finally:
        db.close()


def build_api_chunks(cfg: Dict[str, Any], records: List[Any], url: str):
    items, skipped = normalize_records(records, cfg.get("source_type") or "support_tickets",
                                       cfg.get("mapping") or None)
    chunks = []
    for item in items:
        n = len(item["chunks"])
        for i, text in enumerate(item["chunks"]):
            meta = {k: v for k, v in item["metadata"].items() if v is not None}
            meta["url"] = url
            if n > 1:
                meta["part"] = i + 1
            chunks.append({"text": text, "metadata": meta, "key": item["key"]})
    return items, skipped, chunks


def run_api_sync(source_id: str, task_id: str) -> None:
    db = SessionLocal()
    try:
        source = _start(db, source_id, task_id)
        if source is None:
            return
        cfg = load_config(source)
        cfg["url"] = source.url
        try:
            _, records, _, pages = fetch_all(cfg)
        except FetchError as e:
            _finish(db, source_id, task_id, "failed", str(e), synced=False)
            return

        items, skipped, chunks = build_api_chunks(cfg, records, source.url)
        rows = _rows(source, chunks, source.source_type, source.url)
        added, dupes, errors = store_documents(db, rows)

        # Tickets whose content changed (e.g. a new response) get a new hash: drop the old version.
        removed = 0
        if not errors:
            fetched_keys = {i["key"] for i in items if i["key"]}
            new_hashes = {r["content_hash"] for r in rows}
            if fetched_keys:
                stale_ids = []
                for doc_id, h, meta in db.query(Document.id, Document.content_hash, Document.doc_metadata).filter(
                        Document.source_id == source_id):
                    if h in new_hashes:
                        continue
                    try:
                        key = (json.loads(meta) or {}).get("record_key") if meta else None
                    except ValueError:
                        key = None
                    if key and key in fetched_keys:
                        stale_ids.append(doc_id)
                for i in range(0, len(stale_ids), 500):
                    removed += db.query(Document).filter(Document.id.in_(stale_ids[i:i + 500])).delete(
                        synchronize_session=False)
                db.commit()

        logger.info(f"API sync {source_id}: {len(records)} records over {pages} page(s), "
                    f"{added} added, {dupes} unchanged, {removed} stale removed, {errors} errors")
        notes = [] if records else ["No records found in the API response"]
        error = _summarize(notes, skipped, errors)
        status = "failed" if errors and not added and not dupes else "completed"
        _finish(db, source_id, task_id, status, error, records_count=len(records))
    except Exception as e:
        logger.error(f"API sync failed for {source_id}: {e}", exc_info=True)
        _finish(db, source_id, task_id, "failed", f"Processing error: {e}", synced=False)
    finally:
        db.close()
