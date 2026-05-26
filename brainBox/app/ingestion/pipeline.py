from sqlalchemy.orm import Session
from app.chunkers.logs import chunk_logs
from app.chunkers.code import chunk_code
from app.chunkers.json import chunk_json
from app.chunkers.csv import chunk_csv

from app.embeddings.generator import generate_embedding

from app.db.session import SessionLocal
from app.db.models import Document, ProcessingTask

from app.utils.hashing import create_hash
from app.ingestion.dedupe import is_duplicate
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

        if task_id:
            task = db.query(ProcessingTask).filter(
                ProcessingTask.task_id == task_id
            ).first()
            if task:
                task.status = "processing"
                db.commit()

        chunker = get_chunker(source_type)
        chunks = chunker(content)

        logger.info(f"Processing {len(chunks)} chunks for {source_type}")

        documents_added = 0
        for chunk in chunks:
            content_hash = create_hash(chunk)

            if is_duplicate(db, content_hash, tenant_id):
                logger.debug(f"Duplicate chunk found, skipping")
                continue

            try:
                embedding = generate_embedding(chunk)

                document = Document(
                    tenant_id=tenant_id,
                    source_type=source_type,
                    file_path=file_path,
                    content=chunk,
                    content_hash=content_hash,
                    embedding=embedding,
                    metadata=payload.get("metadata")
                )

                db.add(document)
                documents_added += 1
            except Exception as e:
                logger.error(f"Error processing chunk: {str(e)}")
                continue

        db.commit()

        if task_id:
            task = db.query(ProcessingTask).filter(
                ProcessingTask.task_id == task_id
            ).first()
            if task:
                task.status = "completed"
                db.commit()

        logger.info(f"Added {documents_added} documents to database")

    except Exception as e:
        logger.error(f"Error in process_document: {str(e)}")
        if task_id:
            task = db.query(ProcessingTask).filter(
                ProcessingTask.task_id == task_id
            ).first()
            if task:
                task.status = "failed"
                task.error_message = str(e)
                db.commit()
        raise
    finally:
        db.close()
