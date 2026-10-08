"""Key management, guarded by the X-Admin-Token header (env BRAINBOX_ADMIN_TOKEN)."""
from datetime import datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import apikeys
from app.db.session import get_db
from app.dependencies import require_admin_token
from app.utils.logging import logger

router = APIRouter(dependencies=[Depends(require_admin_token)])


class KeyCreate(BaseModel):
    tenant_id: str = Field(..., min_length=1)
    key_type: Literal["publishable", "secret"]
    name: Optional[str] = None
    expires_at: Optional[datetime] = None
    key: Optional[str] = Field(
        None,
        description="Import an existing raw key (>= 24 chars) instead of generating one, "
                    "so already-deployed sites keep working",
    )


class KeyOut(BaseModel):
    id: int
    tenant_id: str
    name: str
    key_type: str
    key_prefix: Optional[str] = None
    is_active: bool
    expired: bool = False
    created_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    last_used: Optional[datetime] = None


class KeyCreated(KeyOut):
    api_key: str = Field(..., description="The raw key. Shown only once - store it now.")


class KeyList(BaseModel):
    keys: List[KeyOut]


@router.post("/keys", response_model=KeyCreated, status_code=status.HTTP_201_CREATED)
def create_key(payload: KeyCreate, db: Session = Depends(get_db)):
    try:
        record, raw = apikeys.create_key(
            db, payload.tenant_id, payload.key_type, payload.name, payload.expires_at, payload.key
        )
    except apikeys.DuplicateKeyError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except apikeys.KeyRequestError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    logger.info(f"API key created: id={record.id} tenant={record.tenant_id} type={record.key_type} "
                f"imported={payload.key is not None}")
    return KeyCreated(**apikeys.key_to_dict(record), api_key=raw)


@router.get("/keys", response_model=KeyList)
def list_keys(tenant_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    return KeyList(keys=[KeyOut(**apikeys.key_to_dict(k)) for k in apikeys.list_keys(db, tenant_id)])


@router.delete("/keys/{key_id}", response_model=KeyOut)
def revoke_key(key_id: int, db: Session = Depends(get_db)):
    record = apikeys.revoke_key(db, key_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
    logger.info(f"API key revoked: id={record.id} tenant={record.tenant_id}")
    return KeyOut(**apikeys.key_to_dict(record))


# ---------------------------------------------------------------------------------------------
# Staff bootstrap (first owner of a tenant, or any staff user)
# ---------------------------------------------------------------------------------------------

class StaffCreate(BaseModel):
    tenant_id: str = Field(..., min_length=1)
    email: str = Field(..., max_length=254)
    full_name: Optional[str] = Field(None, max_length=120)
    role: str = "owner"
    password: Optional[str] = Field(None, max_length=256, description="Omit to get an invite link instead")


@router.post("/staff", status_code=status.HTTP_201_CREATED)
def create_staff(payload: StaffCreate, request: Request, db: Session = Depends(get_db)):
    from app import staff as staff_mod

    try:
        user, raw = staff_mod.create_staff(
            db, payload.tenant_id, payload.email, payload.role, payload.full_name, payload.password or None)
    except staff_mod.StaffError as e:
        raise HTTPException(status_code=e.status, detail=str(e))
    logger.info(f"Staff user created via admin API: id={user.id} tenant={user.tenant_id} role={user.role}")
    out = {"user": staff_mod.to_dict(user)}
    if raw:
        out["invite_url"] = staff_mod.dashboard_link(f"accept-invite?token={raw}", request.headers.get("origin"))
    return out
