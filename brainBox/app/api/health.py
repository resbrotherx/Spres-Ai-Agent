from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import text  # Added this import
from app.db.session import get_db
from app.apikeys import effective_key_type, resolve_key
from app.dependencies import INVALID_KEY, extract_api_key, require_secret_key
from app.staff import looks_like_jwt, user_from_jwt
from app.utils.logging import logger
import redis

router = APIRouter()

@router.get("/health")
def health_check(request: Request, db: Session = Depends(get_db)):
    """Public liveness check. When an API key (X-API-Key / Authorization: Bearer) or a staff JWT
    is sent it is validated too - 401 if invalid, else ``key: {valid, key_type, tenant_id}`` -
    so integrations can offer a "Test connection" button. Independent of REQUIRE_API_KEY."""
    body = {
        "status": "healthy",
        "service": "brainbox",
        "version": "1.0.0"
    }
    raw = extract_api_key(request)
    if raw is None and not (request.headers.get("authorization") or "").strip():
        return body
    key_info = None
    if raw and looks_like_jwt(raw):
        user = user_from_jwt(db, raw)
        if user is not None:
            key_info = {"valid": True, "key_type": "staff", "tenant_id": user.tenant_id}
    elif raw:
        record = resolve_key(db, raw)
        if record is not None:
            key_info = {"valid": True, "key_type": effective_key_type(record), "tenant_id": record.tenant_id}
    if key_info is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=INVALID_KEY,
                            headers={"WWW-Authenticate": "Bearer"})
    body["key"] = key_info
    return body

@router.get("/health/db", dependencies=[Depends(require_secret_key)])
async def health_check_db(db: Session = Depends(get_db)):
    try:
        # Wrapped "SELECT 1" with text()
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}

@router.get("/health/cache", dependencies=[Depends(require_secret_key)])
async def health_check_cache():
    try:
        from app.redis_cache.cache import redis_client
        redis_client.ping()
        return {"status": "healthy", "cache": "connected"}
    except Exception as e:
        logger.error(f"Cache health check failed: {str(e)}")
        return {"status": "unhealthy", "cache": "disconnected", "error": str(e)}

@router.get("/health/vector", dependencies=[Depends(require_secret_key)])
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
