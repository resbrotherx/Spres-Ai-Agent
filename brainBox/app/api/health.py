from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text  # Added this import
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
        # Wrapped "SELECT 1" with text()
        db.execute(text("SELECT 1"))
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

@router.get("/health/vector")
async def health_check_vector(db: Session = Depends(get_db)):
    result = {
        "status": "healthy",
        "database": "connected",
        "pgvector": "unknown",
        "documents": 0,
        "embedding": "unknown",
        "embedding_dimension": None,
    }

    try:
        extension = db.execute(
            text("SELECT extversion FROM pg_extension WHERE extname = 'vector'")
        ).scalar()
        result["pgvector"] = "installed" if extension else "missing"
        result["pgvector_version"] = extension

        result["documents"] = db.execute(text("SELECT COUNT(*) FROM documents")).scalar() or 0

        from app.embeddings.generator import generate_embedding

        embedding = generate_embedding("health check")
        result["embedding"] = "working"
        result["embedding_dimension"] = len(embedding or [])
        return result
    except Exception as e:
        logger.error(f"Vector health check failed: {str(e)}")
        result["status"] = "unhealthy"
        result["error"] = str(e)
        return result
