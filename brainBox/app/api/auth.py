from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import secrets

from app.db.session import get_db
from app.db.models import User, APIKey
from app.utils.security import create_access_token, hash_password, verify_password
from app.utils.hashing import create_hash
from app.utils.logging import logger

router = APIRouter()

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str

class APIKeyResponse(BaseModel):
    api_key: str
    tenant_id: str

@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    db: Session = Depends(get_db)
):
    try:
        user = db.query(User).filter(
            User.username == request.username
        ).first()

        if not user or not verify_password(request.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not active"
            )

        access_token = create_access_token({"sub": user.username, "user_id": user.id})

        return LoginResponse(
            access_token=access_token,
            token_type="bearer"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )

@router.post("/api-key", response_model=APIKeyResponse)
async def create_api_key(
    tenant_id: str,
    db: Session = Depends(get_db)
):
    try:
        api_key = secrets.token_urlsafe(32)
        key_hash = create_hash(api_key)

        api_key_record = APIKey(
            user_id=1,
            tenant_id=tenant_id,
            key_hash=key_hash,
            name=f"API Key for {tenant_id}"
        )

        db.add(api_key_record)
        db.commit()

        return APIKeyResponse(
            api_key=api_key,
            tenant_id=tenant_id
        )

    except Exception as e:
        logger.error(f"Error creating API key: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create API key"
        )
