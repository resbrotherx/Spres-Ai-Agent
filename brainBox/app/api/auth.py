from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Annotated
import secrets

from app.db.session import get_db
from app.db.models import User, APIKey
from app.utils.security import create_access_token, hash_password, verify_password
from app.utils.hashing import create_hash
from app.utils.logging import logger

router = APIRouter()

class SignupRequest(BaseModel):
    username: str
    password: str
    email: str

class SignupResponse(BaseModel):
    user_id: int
    username: str
    email: str
    message: str

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str

class APIKeyResponse(BaseModel):
    api_key: str
    tenant_id: str

@router.post("/signup", response_model=SignupResponse)
async def signup(
    request: SignupRequest,
    db: Session = Depends(get_db)
):
    try:
        existing_user = db.query(User).filter(
            User.username == request.username
        ).first()

        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )

        hashed_password = hash_password(request.password)

        new_user = User(
            username=request.username,
            email=request.email,
            hashed_password=hashed_password,
            is_active=True
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return SignupResponse(
            user_id=new_user.id,
            username=new_user.username,
            email=new_user.email,
            message="User created successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Signup error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Signup failed"
        )

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
