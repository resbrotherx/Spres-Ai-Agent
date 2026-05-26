from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.utils.logging import logger
import redis

router = APIRouter()

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "brainbox",
        "version": "1.0.0"
    }

@router.get("/health/db")
async def health_check_db(db: Session = Depends(get_db)):
    try:
        db.execute("SELECT 1")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}

@router.get("/health/cache")
async def health_check_cache():
    try:
        from app.redis_cache.cache import redis_client
        redis_client.ping()
        return {"status": "healthy", "cache": "connected"}
    except Exception as e:
        logger.error(f"Cache health check failed: {str(e)}")
        return {"status": "unhealthy", "cache": "disconnected", "error": str(e)}
