"""Request authentication: API keys (publishable / secret) and the admin token.

Usage in routers::

    auth: AuthContext = Depends(require_api_key)      # chat endpoints (publishable or secret)
    auth: AuthContext = Depends(require_secret_key)   # ingest / training / diagnostics
    _: None = Depends(require_admin_token)            # /api/admin/*
    auth: AuthContext = Depends(require_staff("admin"))  # staff-only dashboard endpoints

Staff JWTs (``Authorization: Bearer <jwt>``, see app/staff.py) are accepted wherever a secret key
is: the tenant comes from the staff user, and on secret-key endpoints write methods need the
trainer role or higher. Staff-only endpoints reject API keys (403 "Staff login required").

Keys are read from ``X-API-Key: <key>`` or ``Authorization: Bearer <key>``. The tenant comes
from the key; a request that also names a different tenant_id gets 403. With
``REQUIRE_API_KEY=false`` nothing is checked and tenant/role come from the request (legacy).
"""
import hmac
from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.apikeys import effective_key_type, resolve_key
from app.config import settings
from app.db.session import get_db
from app.permissions import normalize_role
from app import staff as staff_mod

INVALID_KEY = "Invalid or missing API key"
SECRET_REQUIRED = (
    "This endpoint requires a secret API key (sk_...). "
    "Publishable keys (pk_...) can only use chat endpoints."
)
TENANT_MISMATCH = "tenant_id does not match API key"
STAFF_REQUIRED = "Staff login required"
INVALID_SESSION = "Invalid or expired session. Please log in again."


def role_forbidden(role: Optional[str]) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Your role ({role}) can't do this")


def _clean(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = str(value).strip()
    return value or None


@dataclass(frozen=True)
class AuthContext:
    enforced: bool
    tenant_id: Optional[str] = None
    key_type: Optional[str] = None  # publishable | secret | staff (None when not enforced)
    key_id: Optional[int] = None
    # Staff JWT callers (key_type == "staff")
    staff_user_id: Optional[int] = None
    staff_role: Optional[str] = None
    staff_email: Optional[str] = None
    staff_name: Optional[str] = None

    @property
    def is_staff(self) -> bool:
        return self.key_type == "staff"

    @property
    def is_secret(self) -> bool:
        """Secret-level trust: a secret API key or a logged-in staff user."""
        return self.key_type in ("secret", "staff")

    def has_role(self, minimum: str) -> bool:
        return self.is_staff and staff_mod.rank(self.staff_role) >= staff_mod.rank(minimum)

    def resolve_tenant(self, requested: Optional[str], required: bool = True) -> Optional[str]:
        """The tenant this request acts on.

        Enforced: always the key's tenant; a differing ``requested`` -> 403.
        Not enforced (legacy): the requested tenant; missing -> 400 when ``required``.
        """
        requested = _clean(requested)
        if self.enforced:
            if requested is not None and requested != self.tenant_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=TENANT_MISMATCH)
            return self.tenant_id
        if requested is None and required:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="tenant_id is required")
        return requested

    def effective_role(self, requested: Optional[str]) -> Optional[str]:
        """Role used for retrieval permissions.

        Publishable key -> always "public" (browser-supplied roles can't be trusted).
        Secret key      -> the requested role, normalised (missing/unknown -> "public").
        Not enforced    -> the requested value as-is (legacy; normalised at retrieval).
        """
        if not self.enforced:
            return _clean(requested)
        if not self.is_secret:
            return "public"
        return normalize_role(requested)


def extract_api_key(request: Request) -> Optional[str]:
    key = _clean(request.headers.get("x-api-key"))
    if key:
        return key
    authorization = request.headers.get("authorization") or ""
    scheme, _, value = authorization.partition(" ")
    if scheme.lower() == "bearer":
        return _clean(value)
    return None


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=INVALID_KEY,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _staff_context(user) -> AuthContext:
    return AuthContext(
        enforced=True,
        tenant_id=user.tenant_id,
        key_type="staff",
        staff_user_id=user.id,
        staff_role=user.role,
        staff_email=user.email,
        staff_name=staff_mod.display_name(user),
    )


def require_api_key(request: Request, db: Session = Depends(get_db)) -> AuthContext:
    """Any valid key (publishable or secret) or a staff JWT."""
    raw = extract_api_key(request)
    if staff_mod.looks_like_jwt(raw):
        user = staff_mod.user_from_jwt(db, raw)
        if user is not None:
            return _staff_context(user)
        if settings.REQUIRE_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=INVALID_SESSION,
                headers={"WWW-Authenticate": "Bearer"},
            )
    if not settings.REQUIRE_API_KEY:
        return AuthContext(enforced=False)
    record = resolve_key(db, raw)
    if record is None:
        raise _unauthorized()
    return AuthContext(
        enforced=True,
        tenant_id=record.tenant_id,
        key_type=effective_key_type(record),
        key_id=record.id,
    )


def require_secret_key(request: Request, auth: AuthContext = Depends(require_api_key)) -> AuthContext:
    """A valid secret key (server-side only) or a staff JWT. Staff need trainer+ to write
    (viewers may only read: GET/HEAD)."""
    if auth.enforced and not auth.is_secret:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=SECRET_REQUIRED)
    if auth.is_staff and request.method not in ("GET", "HEAD", "OPTIONS") and not auth.has_role("trainer"):
        raise role_forbidden(auth.staff_role)
    return auth


def require_staff(minimum: str = "viewer"):
    """Dependency factory: a staff JWT whose user has at least ``minimum`` role.
    No credentials / bad JWT -> 401; API keys -> 403 "Staff login required"; low role -> 403."""
    if minimum not in staff_mod.ROLE_RANK:
        raise ValueError(f"unknown staff role {minimum!r}")

    def dependency(auth: AuthContext = Depends(require_api_key)) -> AuthContext:
        if not auth.is_staff:
            if auth.enforced:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=STAFF_REQUIRED)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=STAFF_REQUIRED,
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not auth.has_role(minimum):
            raise role_forbidden(auth.staff_role)
        return auth

    dependency.__name__ = f"require_staff_{minimum}"
    return dependency


def require_admin_token(x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token")) -> None:
    """Guards key management. Independent of REQUIRE_API_KEY."""
    expected = settings.BRAINBOX_ADMIN_TOKEN
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin API disabled: set BRAINBOX_ADMIN_TOKEN on the server",
        )
    given = (x_admin_token or "").strip()
    if not given or not hmac.compare_digest(given.encode(), expected.encode()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing admin token")
