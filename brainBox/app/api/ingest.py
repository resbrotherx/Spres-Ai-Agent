from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import uuid4

from app.db.session import get_db
from app.db.models import ProcessingTask
from app.schemas.ingest import IngestPayload, IngestResponse, IngestionStatus
from app.celery_app.tasks import process_ingestion_task
from app.utils.logging import logger

router = APIRouter()

@router.post("/ingest", response_model=IngestResponse)
async def ingest(
    payload: IngestPayload,
    db: Session = Depends(get_db)
):
    try:
        task_id = str(uuid4())

        task = ProcessingTask(
            tenant_id=payload.tenant_id,
            task_id=task_id,
            status="queued",
            source_type=payload.source_type,
            file_path=payload.file_path
        )
        db.add(task)
        db.commit()

        ingest_payload = {
            "task_id": task_id,
            "tenant_id": payload.tenant_id,
            "source_type": payload.source_type,
            "content": payload.content,
            "file_path": payload.file_path,
            "metadata": payload.metadata
        }

        process_ingestion_task.delay(ingest_payload)

        logger.info(f"Ingestion queued: {task_id}")

        return IngestResponse(
            status="queued",
            task_id=task_id,
            message="Ingestion task queued for processing"
        )

    except Exception as e:
        logger.error(f"Error in ingest endpoint: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/ingest/status/{task_id}", response_model=IngestionStatus)
async def get_ingestion_status(
    task_id: str,
    db: Session = Depends(get_db)
):
    task = db.query(ProcessingTask).filter(
        ProcessingTask.task_id == task_id
    ).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    return IngestionStatus(
        task_id=task.task_id,
        status=task.status,
        error_message=task.error_message
    )
