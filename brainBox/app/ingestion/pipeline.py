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
        chunks = chunker(content)

        logger.info(f"Processing {len(chunks)} chunks for {source_type}")

        documents_added = 0
        embedding_errors = 0

        for i, chunk in enumerate(chunks):
            try:
                content_hash = create_hash(chunk)

                if is_duplicate(db, content_hash, tenant_id):
                    logger.debug(f"Duplicate chunk {i+1}/{len(chunks)}, skipping")
                    continue

                try:
                    logger.debug(f"Generating embedding for chunk {i+1}/{len(chunks)}")
                    embedding = generate_embedding(chunk)

                    if embedding is None:
                        logger.error(f"Embedding generation returned None for chunk {i+1}")
                        embedding_errors += 1
                        continue

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

                    if documents_added % 5 == 0:
                        db.commit()
                        logger.info(f"Committed {documents_added} documents so far")

                except Exception as e:
                    logger.error(f"Error processing chunk {i+1}: {str(e)}", exc_info=True)
                    embedding_errors += 1
                    continue
            except Exception as e:
                logger.error(f"Error in chunk loop iteration {i+1}: {str(e)}", exc_info=True)
                continue

        db.commit()
        logger.info(f"Final commit: Added {documents_added} documents, {embedding_errors} embedding errors")

        if task_id:
            task = db.query(ProcessingTask).filter(
                ProcessingTask.task_id == task_id
            ).first()
            if task:
                task.status = "completed"
                task.error_message = None if embedding_errors == 0 else f"{embedding_errors} embedding errors"
                db.commit()
                logger.info(f"Task {task_id} marked as completed")

        logger.info(f"Successfully added {documents_added} documents to database")
        return {"status": "completed", "documents_added": documents_added, "errors": embedding_errors}

    except Exception as e:
        logger.error(f"Error in process_document: {str(e)}", exc_info=True)
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
