"""Roles, audiences and who may see what.

Every document carries an *audience* label; every chat request has an effective *role*.
Retrieval only returns documents whose audience is allowed for that role.

    role       -> audiences it may read
    admin      -> everything (no filter)
    internal   -> public, customer, vendor, internal
    customer   -> public, customer          (portal is an alias of customer)
    vendor     -> public, vendor
    public     -> public

Documents with a NULL audience (ingested before audiences existed) are treated as
``settings.LEGACY_DOC_AUDIENCE`` (default "public").
"""
from typing import List, Optional

from app.config import settings

AUDIENCES = ("public", "customer", "vendor", "internal", "admin")
ROLES = ("admin", "internal", "customer", "vendor", "public")
ROLE_ALIASES = {"portal": "customer"}

# Audience given to new training sources when the caller doesn't pick one (safest useful default).
DEFAULT_SOURCE_AUDIENCE = "internal"

_ROLE_AUDIENCES = {
    "admin": None,  # no filter
    "internal": ["public", "customer", "vendor", "internal"],
    "customer": ["public", "customer"],
    "vendor": ["public", "vendor"],
    "public": ["public"],
}


def normalize_role(role: Optional[str]) -> str:
    """Map a client-supplied role to a known role. Missing/unknown -> "public"."""
    value = (role or "").strip().lower()
    value = ROLE_ALIASES.get(value, value)
    return value if value in _ROLE_AUDIENCES else "public"


def allowed_audiences(role: Optional[str]) -> Optional[List[str]]:
    """Audiences the role may read, in canonical order; None means unrestricted (admin)."""
    allowed = _ROLE_AUDIENCES[normalize_role(role)]
    return None if allowed is None else list(allowed)


def validate_audience(value: Optional[str], default: Optional[str] = None) -> Optional[str]:
    """Normalise an audience label; raises ValueError for unknown values. Blank -> default."""
    if value is None or not str(value).strip():
        return default
    v = str(value).strip().lower()
    if v not in AUDIENCES:
        raise ValueError(f"audience must be one of: {', '.join(AUDIENCES)}")
    return v


def legacy_doc_audience() -> str:
    """Audience assumed for documents/sources whose audience is NULL."""
    try:
        return validate_audience(settings.LEGACY_DOC_AUDIENCE, "public")
    except ValueError:
        return "public"
