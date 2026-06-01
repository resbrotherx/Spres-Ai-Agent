from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
import aiofiles
import os

from app.db.session import get_db
from app.utils.logging import logger

router = APIRouter()

UPLOAD_DIR = "/tmp/uploads"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/chat/upload/file")
async def upload_file(
    file: UploadFile = File(...),
    tenant_id: str = Form(...),
    session_id: str = Form(None),
    db: Session = Depends(get_db)
):
    try:
        if not file:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file provided"
            )

        if file.size and file.size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds {MAX_FILE_SIZE / 1024 / 1024}MB limit"
            )

        filename = f"{tenant_id}_{session_id or 'temp'}_{file.filename}"
        filepath = os.path.join(UPLOAD_DIR, filename)

        async with aiofiles.open(filepath, 'wb') as f:
            content = await file.read()
            await f.write(content)

        logger.info(f"File uploaded: {filename} ({len(content)} bytes)")

        return {
            "status": "success",
            "filename": file.filename,
            "size": len(content),
            "path": filepath,
            "message": "File uploaded successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/chat/upload/image")
async def upload_image(
    image: UploadFile = File(...),
    tenant_id: str = Form(...),
    session_id: str = Form(None),
    db: Session = Depends(get_db)
):
    try:
        if not image:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No image provided"
            )

        allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
        if image.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type not allowed. Allowed: {', '.join(allowed_types)}"
            )

        if image.size and image.size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds {MAX_FILE_SIZE / 1024 / 1024}MB limit"
            )

        filename = f"{tenant_id}_{session_id or 'temp'}_{image.filename}"
        filepath = os.path.join(UPLOAD_DIR, filename)

        async with aiofiles.open(filepath, 'wb') as f:
            content = await image.read()
            await f.write(content)

        logger.info(f"Image uploaded: {filename} ({len(content)} bytes)")

        return {
            "status": "success",
            "filename": image.filename,
            "size": len(content),
            "path": filepath,
            "url": f"/uploads/{filename}",
            "message": "Image uploaded successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading image: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
