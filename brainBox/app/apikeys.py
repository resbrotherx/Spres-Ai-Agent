"""API key storage: create / import / list / revoke / resolve.

Shared by the admin API (app/api/admin.py), the CLI (app/cli.py) and the request auth
dependency (app/dependencies.py). Only the SHA-256 hash of a key is stored; the raw key is
returned once, at creation.
"""
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.db.models import APIKey
from app.utils.hashing import create_hash

KEY_TYPES = ("publishable", "secret")
KEY_PREFIXES = {"publishable": "pk_live_", "secret": "sk_live_"}
MIN_IMPORTED_KEY_LENGTH = 24
LAST_USED_RESOLUTION = timedelta(minutes=1)


class KeyRequestError(ValueError):
    """Invalid key-management request (bad type, too-short imported key, ...)."""


class DuplicateKeyError(KeyRequestError):
    """The (imported) key already exists."""


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is not None and dt.tzinfo is None:  # SQLite returns naive datetimes; we store UTC
        return dt.replace(tzinfo=timezone.utc)
    return dt


def generate_key(key_type: str) -> str:
    return KEY_PREFIXES[key_type] + secrets.token_urlsafe(32)


def key_type_from_prefix(raw: str) -> Optional[str]:
    for key_type, prefix in KEY_PREFIXES.items():
        if raw.startswith(prefix[:3]):  # pk_ / sk_ (also matches *_test_ style keys)
            return key_type
    return None


def display_prefix(raw: str) -> str:
    """Short, non-secret identifier shown in listings."""
    if key_type_from_prefix(raw):
        return raw[:12]  # e.g. "sk_live_Ab3x" - 4 random chars out of 43
    return raw[:6]  # imported legacy key: reveal less of it


def effective_key_type(record: APIKey) -> str:
    """Keys created before key types existed have NULL: least privilege (publishable)."""
    return record.key_type if record.key_type in KEY_TYPES else "publishable"


def create_key(
    db: Session,
    tenant_id: str,
    key_type: str,
    name: Optional[str] = None,
    expires_at: Optional[datetime] = None,
    raw_key: Optional[str] = None,
) -> Tuple[APIKey, str]:
    """Create (or import, when ``raw_key`` is given) a key. Returns (record, raw_key)."""
    tenant_id = (tenant_id or "").strip()
    if not tenant_id:
        raise KeyRequestError("tenant_id is required")
    if key_type not in KEY_TYPES:
        raise KeyRequestError(f"key_type must be one of: {', '.join(KEY_TYPES)}")

    if raw_key is not None:
        raw_key = raw_key.strip()
        if len(raw_key) < MIN_IMPORTED_KEY_LENGTH or any(c.isspace() for c in raw_key):
            raise KeyRequestError(f"Imported keys must be at least {MIN_IMPORTED_KEY_LENGTH} characters, without spaces")
        implied = key_type_from_prefix(raw_key)
        if implied and implied != key_type:
            raise KeyRequestError(f"The key's prefix marks it as a {implied} key, but key_type is {key_type}")
    else:
        raw_key = generate_key(key_type)

    key_hash = create_hash(raw_key)
    if db.query(APIKey.id).filter(APIKey.key_hash == key_hash).first():
        raise DuplicateKeyError("This key already exists")

    record = APIKey(
        user_id=0,
        tenant_id=tenant_id,
        key_hash=key_hash,
        name=(name or "").strip() or f"{key_type} key for {tenant_id}",
        key_type=key_type,
        key_prefix=display_prefix(raw_key),
        is_active=True,
        expires_at=_aware(expires_at),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record, raw_key


def list_keys(db: Session, tenant_id: Optional[str] = None) -> List[APIKey]:
    q = db.query(APIKey)
    if tenant_id:
        q = q.filter(APIKey.tenant_id == tenant_id)
    return q.order_by(APIKey.created_at.desc(), APIKey.id.desc()).all()


def revoke_key(db: Session, key_id: int) -> Optional[APIKey]:
    record = db.query(APIKey).filter(APIKey.id == key_id).first()
    if record is None:
        return None
    record.is_active = False
    db.commit()
    db.refresh(record)
    return record


def roll_key(db: Session, key_id: int, tenant_id: Optional[str] = None) -> Optional[Tuple[APIKey, str, APIKey]]:
    """Replace an active key: create a new key (same tenant, type, name and a still-future expiry),
    then revoke the old one. Returns (new_record, new_raw_key, old_record), or None when the key
    doesn't exist (or belongs to another tenant when ``tenant_id`` is given).
    Raises KeyRequestError when the key is already revoked."""
    q = db.query(APIKey).filter(APIKey.id == key_id)
    if tenant_id is not None:
        q = q.filter(APIKey.tenant_id == tenant_id)
    old = q.first()
    if old is None:
        return None
    if not old.is_active:
        raise KeyRequestError("This key is already revoked; create a new key instead")
    expires = _aware(old.expires_at)
    if expires is not None and expires <= _utcnow():
        expires = None
    record, raw = create_key(db, old.tenant_id, effective_key_type(old), old.name, expires)
    old.is_active = False
    db.commit()
    db.refresh(old)
    return record, raw, old


def resolve_key(db: Session, raw_key: Optional[str]) -> Optional[APIKey]:
    """Return the active, unexpired key record for ``raw_key`` (and bump last_used at most once
    a minute), or None."""
    if not raw_key:
        return None
    record = db.query(APIKey).filter(APIKey.key_hash == create_hash(raw_key)).first()
    if record is None or not record.is_active:
        return None
    now = _utcnow()
    expires = _aware(record.expires_at)
    if expires is not None and expires <= now:
        return None
    last = _aware(record.last_used)
    if last is None or now - last >= LAST_USED_RESOLUTION:
        try:
            record.last_used = now
            db.commit()
        except Exception:
            db.rollback()
    return record


def key_to_dict(record: APIKey) -> Dict[str, Any]:
    now = _utcnow()
    expires = _aware(record.expires_at)
    return {
        "id": record.id,
        "tenant_id": record.tenant_id,
        "name": record.name,
        "key_type": effective_key_type(record),
        "key_prefix": record.key_prefix,
        "is_active": bool(record.is_active),
        "expired": bool(expires is not None and expires <= now),
        "created_at": record.created_at,
        "expires_at": record.expires_at,
        "last_used": record.last_used,
    }
