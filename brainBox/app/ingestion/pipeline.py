from sqlalchemy.orm import Session
import json
from app.chunkers.logs import chunk_logs
from app.chunkers.code import chunk_code
from app.chunkers.json import chunk_json
from app.chunkers.csv import chunk_csv
from app.chunkers.text import chunk_text

from app.db.session import SessionLocal
from app.db.models import Document, ProcessingTask

from app.utils.hashing import create_hash
from app.ingestion.store import store_documents
from app.utils.logging import logger

def get_chunker(source_type: str):
    chunkers = {
        "codebase": chunk_code,
        "logs": chunk_logs,
        "nginx_logs": chunk_logs,
        "docker_logs": chunk_logs,
        "postgres_logs": chunk_logs,
        "json": chunk_json,
        "csv": chunk_csv,
        "text": chunk_text,
        "txt": chunk_text,
        "md": chunk_text,
        "document": chunk_text,
    }
    return chunkers.get(source_type, chunk_logs)

def process_document(payload: dict):
    db = SessionLocal()
    task_id = payload.get("task_id")
    tenant_id = payload.get("tenant_id")

    try:
        source_type = payload.get("source_type", "logs")
        content = payload.get("content", "")
        file_path = payload.get("file_path")

        logger.info(f"Starting document processing - Task: {task_id}, Tenant: {tenant_id}, Type: {source_type}")

        if task_id:
            task = db.query(ProcessingTask).filter(
                ProcessingTask.task_id == task_id
            ).first()
            if task:
                task.status = "processing"
                db.commit()
            else:
                logger.error(f"Task {task_id} not found in database")

        chunker = get_chunker(source_type)
        chunks = [c for c in chunker(content) if c and c.strip()]

        logger.info(f"Processing {len(chunks)} chunks for {source_type}")

        # content_hash is globally UNIQUE while dedupe is per tenant: when the same text
        # already exists for *another* tenant, use a tenant-scoped hash instead so the
        # insert can't collide (existing rows keep their plain sha256 hashes).
        plain_hashes = [create_hash(c) for c in chunks]
        owners = {}
        unique_hashes = list(set(plain_hashes))
        for i in range(0, len(unique_hashes), 500):
            for h, t in db.query(Document.content_hash, Document.tenant_id).filter(
                Document.content_hash.in_(unique_hashes[i:i + 500])
            ):
                owners[h] = t

        rows = []
        duplicates = 0
        for chunk, h in zip(chunks, plain_hashes):
            owner = owners.get(h)
            if owner == tenant_id:
                duplicates += 1
                continue
            if owner is not None:
                h = create_hash(f"{tenant_id}:{chunk}")
            rows.append({
                "tenant_id": tenant_id,
                "source_type": source_type,
                "file_path": file_path,
                "content": chunk,
                "content_hash": h,
                "metadata": payload.get("metadata") or {},
                "audience": payload.get("audience"),
            })

        documents_added, skipped, embedding_errors = store_documents(db, rows)
        duplicates += skipped
        logger.info(
            f"Added {documents_added} documents, {duplicates} duplicates skipped, "
            f"{embedding_errors} errors"
        )

        if task_id:
            task = db.query(ProcessingTask).filter(
                ProcessingTask.task_id == task_id
            ).first()
            if task:
                if embedding_errors and not documents_added:
                    task.status = "failed"
                    task.error_message = f"All {embedding_errors} chunks failed to embed/insert"
                else:
                    task.status = "completed"
                    task.error_message = None if embedding_errors == 0 else f"{embedding_errors} embedding errors"
                db.commit()
                logger.info(f"Task {task_id} marked as {task.status}")

        logger.info(f"Successfully added {documents_added} documents to database")
        return {"status": "completed", "documents_added": documents_added, "duplicates": duplicates, "errors": embedding_errors}

    except Exception as e:
        logger.error(f"Error in process_document: {str(e)}", exc_info=True)
        try:
            db.rollback()  # a failed flush leaves the session unusable until rolled back
        except Exception:
            pass
        if task_id:
            try:
                task = db.query(ProcessingTask).filter(
                    ProcessingTask.task_id == task_id
                ).first()
                if task:
                    task.status = "failed"
                    task.error_message = str(e)
                    db.commit()
                    logger.info(f"Task {task_id} marked as failed")
            except Exception as task_error:
                logger.error(f"Error updating task status: {str(task_error)}")
        raise
    finally:
        try:
            db.close()
        except Exception as e:
            logger.error(f"Error closing database session: {str(e)}")
