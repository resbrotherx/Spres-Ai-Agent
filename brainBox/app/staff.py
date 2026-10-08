"""Staff dashboard accounts: roles, passwords, JWTs, invite/reset tokens, login rate limiting.

Staff users are rows of ``users`` with ``tenant_id`` and ``role`` set (legacy /api/auth users
have them NULL and can never act as staff). Emails are unique globally, so one email address
is one staff account (in one tenant); ``username`` is set to the email.

Staff JWT (HS256, JWT_SECRET_KEY): ``{sub: email, user_id, tenant_id, role, typ: "staff", iat, exp}``.
The user row is re-loaded on every request, so deactivation / role changes / removal take effect
immediately (the role in the token is informational only).
"""
import re
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

import jwt
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import User
from app.utils.hashing import create_hash
from app.utils.security import hash_password, verify_password

STAFF_ROLES = ("owner", "admin", "trainer", "viewer")
ROLE_RANK = {"viewer": 1, "trainer": 2, "admin": 3, "owner": 4}
INVITE_TTL = timedelta(days=7)
RESET_TTL = timedelta(hours=1)
RESET_RESEND_AFTER = timedelta(minutes=2)  # forgot-password won't email the same user more often
UNUSABLE_PASSWORD = "!"  # bcrypt.checkpw fails on it -> never matches (pending invites)
MIN_PASSWORD = 8
MAX_PASSWORD_BYTES = 72  # bcrypt limit

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class StaffError(ValueError):
    """Invalid staff request; ``status`` is the HTTP status to return."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is not None and dt.tzinfo is None:  # SQLite returns naive datetimes; we store UTC
        return dt.replace(tzinfo=timezone.utc)
    return dt


def normalize_email(email: Optional[str]) -> str:
    return (email or "").strip().lower()


def validate_email(email: Optional[str]) -> str:
    value = normalize_email(email)
    if not value or len(value) > 254 or not _EMAIL_RE.match(value):
        raise StaffError("Enter a valid email address", 422)
    return value


def validate_role(role: Optional[str]) -> str:
    value = (role or "").strip().lower()
    if value not in STAFF_ROLES:
        raise StaffError(f"role must be one of: {', '.join(STAFF_ROLES)}", 422)
    return value


def validate_password(password: Optional[str]) -> str:
    password = password or ""
    if len(password) < MIN_PASSWORD:
        raise StaffError(f"Password must be at least {MIN_PASSWORD} characters", 422)
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise StaffError(f"Password must be at most {MAX_PASSWORD_BYTES} bytes", 422)
    return password


def rank(role: Optional[str]) -> int:
    return ROLE_RANK.get(role or "", 0)


def is_staff(user: Optional[User]) -> bool:
    return bool(user is not None and user.tenant_id and user.role in ROLE_RANK)


def jwt_secret_is_placeholder() -> bool:
    secret = settings.JWT_SECRET_KEY or ""
    return secret.strip() in settings.JWT_PLACEHOLDER_SECRETS or len(secret) < 16


def display_name(user: User) -> str:
    return (user.full_name or "").strip() or user.email


# ---------------------------------------------------------------------------
# tokens
# ---------------------------------------------------------------------------

def new_token() -> Tuple[str, str]:
    """(raw, sha256 hash). Only the hash is stored."""
    raw = secrets.token_urlsafe(32)
    return raw, create_hash(raw)


def create_staff_jwt(user: User) -> Tuple[str, int]:
    expires_in = int(settings.STAFF_JWT_HOURS * 3600)
    now = utcnow()
    payload = {
        "sub": user.email,
        "user_id": user.id,
        "tenant_id": user.tenant_id,
        "role": user.role,
        "typ": "staff",
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
    }
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token, expires_in


def looks_like_jwt(token: Optional[str]) -> bool:
    if not token or token.startswith(("pk_", "sk_")):
        return False
    parts = token.split(".")
    return len(parts) == 3 and all(parts) and token.startswith("eyJ")


def decode_staff_jwt(token: str) -> Optional[Dict[str, Any]]:
    try:
        claims = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        return None
    if claims.get("typ") != "staff" or not isinstance(claims.get("user_id"), int):
        return None
    return claims


def user_from_jwt(db: Session, token: str) -> Optional[User]:
    """Active staff user for a valid staff JWT (re-loaded from the DB), else None."""
    claims = decode_staff_jwt(token)
    if claims is None:
        return None
    user = db.query(User).filter(User.id == claims["user_id"]).first()
    if not is_staff(user) or not user.is_active or user.tenant_id != claims.get("tenant_id"):
        return None
    if normalize_email(user.email) != normalize_email(claims.get("sub")):
        return None
    return user


def login_response(db: Session, user: User) -> Dict[str, Any]:
    user.last_login_at = utcnow()
    db.commit()
    db.refresh(user)
    token, expires_in = create_staff_jwt(user)
    return {"access_token": token, "token_type": "bearer", "expires_in": expires_in, "user": to_dict(user)}


# ---------------------------------------------------------------------------
# serialization & queries
# ---------------------------------------------------------------------------

def to_dict(user: User) -> Dict[str, Any]:
    return {
        "id": user.id,
        "tenant_id": user.tenant_id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": bool(user.is_active),
        "notify_email": user.notify_email is not False,
        "notify_in_app": user.notify_in_app is not False,
        "last_login_at": user.last_login_at,
        "created_at": user.created_at,
        "invited": user.invite_token_hash is not None,
    }


def staff_query(db: Session, tenant_id: str):
    return db.query(User).filter(User.tenant_id == tenant_id, User.role.in_(STAFF_ROLES))


def get_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(func.lower(User.email) == normalize_email(email)).first()


def active_owner_count(db: Session, tenant_id: str, exclude_id: Optional[int] = None) -> int:
    q = staff_query(db, tenant_id).filter(User.role == "owner", User.is_active.is_(True),
                                          User.invite_token_hash.is_(None))
    if exclude_id is not None:
        q = q.filter(User.id != exclude_id)
    return q.count()


def create_staff(
    db: Session,
    tenant_id: str,
    email: str,
    role: str,
    full_name: Optional[str] = None,
    password: Optional[str] = None,
) -> Tuple[User, Optional[str]]:
    """Create a staff user. Without a password an invite token is generated: returns (user, raw_token)."""
    tenant_id = (tenant_id or "").strip()
    if not tenant_id:
        raise StaffError("tenant_id is required", 422)
    email = validate_email(email)
    role = validate_role(role)
    if password is not None:
        validate_password(password)
    existing = get_by_email(db, email)
    if existing is not None:
        if existing.tenant_id == tenant_id:
            raise StaffError("A staff member with this email already exists", 409)
        raise StaffError("This email is already registered", 409)
    user = User(
        username=email,
        email=email,
        hashed_password=hash_password(password) if password else UNUSABLE_PASSWORD,
        is_active=True,
        tenant_id=tenant_id,
        role=role,
        full_name=(full_name or "").strip() or None,
        notify_email=True,
        notify_in_app=True,
    )
    raw = None
    if not password:
        raw, digest = new_token()
        user.invite_token_hash = digest
        user.invite_expires_at = utcnow() + INVITE_TTL
    db.add(user)
    db.commit()
    db.refresh(user)
    return user, raw


def refresh_invite(db: Session, user: User) -> str:
    raw, digest = new_token()
    user.invite_token_hash = digest
    user.invite_expires_at = utcnow() + INVITE_TTL
    db.commit()
    return raw


def set_password(db: Session, user: User, password: str) -> None:
    user.hashed_password = hash_password(validate_password(password))
    user.reset_token_hash = None
    user.reset_expires_at = None
    db.commit()


def check_password(user: User, password: str) -> bool:
    if not user.hashed_password or user.hashed_password == UNUSABLE_PASSWORD:
        return False
    return verify_password(password or "", user.hashed_password)


def user_by_token(db: Session, raw: Optional[str], kind: str) -> Optional[User]:
    """Staff user holding an unexpired invite/reset token."""
    if not raw:
        return None
    digest = create_hash(raw.strip())
    if kind == "invite":
        user = db.query(User).filter(User.invite_token_hash == digest).first()
        expires = aware(user.invite_expires_at) if user else None
    else:
        user = db.query(User).filter(User.reset_token_hash == digest).first()
        expires = aware(user.reset_expires_at) if user else None
    if not is_staff(user) or expires is None or expires <= utcnow():
        return None
    return user


def dashboard_link(path_and_query: str, origin: Optional[str] = None) -> str:
    """``{DASHBOARD_URL or request Origin}/#/...``; relative ``#/...`` when neither is known."""
    base = settings.DASHBOARD_URL or (origin or "").strip().rstrip("/")
    if base and not re.match(r"^https?://[^\s/]+", base):
        base = ""
    return f"{base}/#/{path_and_query}" if base else f"#/{path_and_query}"


# ---------------------------------------------------------------------------
# login rate limiting (in-memory: per worker process; use 1 worker or put a proxy limit in front)
# ---------------------------------------------------------------------------

class LoginLimiter:
    def __init__(self):
        self._lock = threading.Lock()
        self._fails = defaultdict(deque)

    def _prune(self, key, now: float) -> deque:
        window = settings.LOGIN_WINDOW_MINUTES * 60
        q = self._fails[key]
        while q and now - q[0] > window:
            q.popleft()
        return q

    def blocked(self, key) -> bool:
        with self._lock:
            q = self._prune(key, time.monotonic())
            blocked = len(q) >= settings.LOGIN_MAX_FAILURES
            if not q:
                self._fails.pop(key, None)
            return blocked

    def fail(self, key) -> None:
        with self._lock:
            now = time.monotonic()
            self._prune(key, now).append(now)
            if len(self._fails) > 50000:  # bound memory under a credential-stuffing flood
                self._fails.clear()

    def reset(self, key=None) -> None:
        with self._lock:
            if key is None:
                self._fails.clear()
            else:
                self._fails.pop(key, None)


login_limiter = LoginLimiter()
