"""Staff dashboard: notifications, tenant settings, widget config and API key management."""
from datetime import datetime
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import apikeys
from app import tenant_settings
from app.db.models import APIKey, Notification
from app.db.session import get_db
from app.dependencies import AuthContext, require_api_key, require_staff
from app.notify.service import notification_to_dict
from app.utils.logging import logger

router = APIRouter()


# ---------------------------------------------------------------------------
# notifications (each staff user sees their own)
# ---------------------------------------------------------------------------

def _mine(db: Session, auth: AuthContext):
    return db.query(Notification).filter(Notification.user_id == auth.staff_user_id,
                                         Notification.tenant_id == auth.tenant_id)


@router.get("/notifications")
def list_notifications(unread_only: bool = Query(False), limit: int = Query(30, ge=1, le=100),
                       auth: AuthContext = Depends(require_staff("viewer")), db: Session = Depends(get_db)):
    q = _mine(db, auth)
    unread = q.filter(Notification.read.is_(False)).count()
    if unread_only:
        q = q.filter(Notification.read.is_(False))
    items = q.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit).all()
    return {"items": [notification_to_dict(n) for n in items], "unread_count": unread}


@router.post("/notifications/read-all")
def read_all(auth: AuthContext = Depends(require_staff("viewer")), db: Session = Depends(get_db)):
    updated = _mine(db, auth).filter(Notification.read.is_(False)).update(
        {Notification.read: True}, synchronize_session=False)
    db.commit()
    return {"ok": True, "updated": updated}


@router.post("/notifications/{notification_id}/read")
def read_one(notification_id: int, auth: AuthContext = Depends(require_staff("viewer")),
             db: Session = Depends(get_db)):
    n = _mine(db, auth).filter(Notification.id == notification_id).first()
    if n is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    n.read = True
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# tenant settings
# ---------------------------------------------------------------------------

@router.get("/settings")
def get_settings(auth: AuthContext = Depends(require_staff("viewer")), db: Session = Depends(get_db)):
    return tenant_settings.get_settings(db, auth.tenant_id)


@router.put("/settings")
def put_settings(patch: Dict[str, Any] = Body(...), auth: AuthContext = Depends(require_staff("admin")),
                 db: Session = Depends(get_db)):
    try:
        result = tenant_settings.update_settings(db, auth.tenant_id, patch)
    except tenant_settings.SettingsError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    logger.info(f"Tenant settings updated: tenant={auth.tenant_id} by={auth.staff_user_id} keys={sorted(patch)}")
    return result


@router.get("/widget-config")
def widget_config(tenant_id: Optional[str] = Query(None), auth: AuthContext = Depends(require_api_key),
                  db: Session = Depends(get_db)):
    """Public widget appearance for the key's tenant (publishable keys OK)."""
    tenant = auth.resolve_tenant(tenant_id)
    return {"widget": tenant_settings.get_widget(db, tenant)}


# ---------------------------------------------------------------------------
# API keys (admin+, tenant from the JWT)
# ---------------------------------------------------------------------------

class KeyCreatePayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    key_type: Literal["publishable", "secret"]
    expires_at: Optional[datetime] = None


def _key_out(record: APIKey) -> Dict[str, Any]:
    d = apikeys.key_to_dict(record)
    return {k: d[k] for k in ("id", "name", "key_type", "key_prefix", "is_active", "created_at",
                              "last_used", "expires_at", "expired")}


@router.get("/keys")
def list_keys(auth: AuthContext = Depends(require_staff("admin")), db: Session = Depends(get_db)):
    return {"keys": [_key_out(k) for k in apikeys.list_keys(db, auth.tenant_id)]}


@router.post("/keys", status_code=status.HTTP_201_CREATED)
def create_key(payload: KeyCreatePayload, auth: AuthContext = Depends(require_staff("admin")),
               db: Session = Depends(get_db)):
    try:
        record, raw = apikeys.create_key(db, auth.tenant_id, payload.key_type, payload.name, payload.expires_at)
    except apikeys.KeyRequestError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    logger.info(f"API key created from dashboard: id={record.id} tenant={record.tenant_id} "
                f"type={record.key_type} by={auth.staff_user_id}")
    return {"key": _key_out(record), "raw_key": raw}


@router.delete("/keys/{key_id}")
def revoke_key(key_id: int, auth: AuthContext = Depends(require_staff("admin")), db: Session = Depends(get_db)):
    owned = db.query(APIKey.id).filter(APIKey.id == key_id, APIKey.tenant_id == auth.tenant_id).first()
    if owned is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
    apikeys.revoke_key(db, key_id)
    logger.info(f"API key revoked from dashboard: id={key_id} tenant={auth.tenant_id} by={auth.staff_user_id}")
    return {"revoked": True}


@router.post("/keys/{key_id}/roll")
def roll_key(key_id: int, auth: AuthContext = Depends(require_staff("admin")), db: Session = Depends(get_db)):
    """Replace a key: a new key (same name/type) is created and the old one revoked at once.
    The new raw key is returned only in this response."""
    try:
        result = apikeys.roll_key(db, key_id, tenant_id=auth.tenant_id)
    except apikeys.KeyRequestError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
    record, raw, old = result
    logger.info(f"API key rolled from dashboard: old={old.id} new={record.id} tenant={auth.tenant_id} "
                f"by={auth.staff_user_id}")
    return {"key": _key_out(record), "raw_key": raw, "revoked_id": old.id}
