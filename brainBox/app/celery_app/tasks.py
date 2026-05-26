from app.celery_app.celery import celery_app
from app.ingestion.pipeline import process_document
from app.utils.logging import logger

@celery_app.task(bind=True)
def process_ingestion_task(self, payload: dict):
    try:
        logger.info(f"Processing ingestion task: {payload}")
        process_document(payload)
        return {"status": "completed", "task_id": self.request.id}
    except Exception as e:
        logger.error(f"Error processing ingestion: {str(e)}")
        raise

@celery_app.task
def health_check():
    return {"status": "celery_worker_healthy"}
