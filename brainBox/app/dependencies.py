from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthCredentials
from app.utils.security import decode_access_token
from app.utils.logging import logger

security = HTTPBearer()

async def verify_token(credentials: HTTPAuthCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    return payload

async def verify_api_key(api_key: str):
    from app.db.session import SessionLocal
    from app.db.models import APIKey
    from app.utils.hashing import create_hash

    db = SessionLocal()
    try:
        key_hash = create_hash(api_key)
        api_key_record = db.query(APIKey).filter(
            APIKey.key_hash == key_hash,
            APIKey.is_active == True
        ).first()

        if not api_key_record:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key"
            )

        return api_key_record.tenant_id
    finally:
        db.close()
