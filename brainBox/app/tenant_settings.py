"""Per-tenant settings (gap detection, notifications, chat-widget appearance).

Stored in ``tenant_settings`` (one row per tenant, created on first write). Missing rows / NULL
columns fall back to the defaults below, so reading never requires a row.
"""
import copy
import json
import re
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import TenantSettings
from app.notify.email import smtp_configured

DEFAULT_WIDGET: Dict[str, Any] = {
    "theme": {"primary": "#b93fff", "panel": "#fff8ff", "ink": "#08080a"},
    "branding": {"botName": "Brainbox", "title": None, "subtitle": None, "logoUrl": None},
    "launcher": {"type": "button", "text": "Chat"},
    "welcomeMessages": ["Hi! How can I help you today?"],
    "quickActions": [],
    "placeholder": "Type message...",
}

_WIDGET_OBJECTS = {
    "theme": {"primary": 64, "panel": 64, "ink": 64},
    "branding": {"botName": 80, "title": 120, "subtitle": 240, "logoUrl": 2048},
    "launcher": {"type": 20, "text": 60},
}
_WIDGET_LISTS = {"welcomeMessages": (10, 500), "quickActions": (12, 120)}
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class SettingsError(ValueError):
    pass


def _row(db: Session, tenant_id: str) -> Optional[TenantSettings]:
    return db.query(TenantSettings).filter(TenantSettings.tenant_id == tenant_id).first()


def _widget_from_row(row: Optional[TenantSettings]) -> Dict[str, Any]:
    widget = copy.deepcopy(DEFAULT_WIDGET)
    if row is not None and row.widget:
        try:
            stored = json.loads(row.widget)
        except ValueError:
            stored = {}
        if isinstance(stored, dict):
            _merge_widget(widget, stored)
    return widget


def _merge_widget(target: Dict[str, Any], patch: Dict[str, Any]) -> None:
    for key, value in patch.items():
        if key in _WIDGET_OBJECTS and isinstance(value, dict):
            target.setdefault(key, {}).update(value)
        elif key in _WIDGET_LISTS or key == "placeholder":
            target[key] = value


def get_settings(db: Session, tenant_id: str) -> Dict[str, Any]:
    """Effective TenantSettings dict (defaults applied)."""
    row = _row(db, tenant_id)

    def pick(attr: str, default):
        value = getattr(row, attr, None) if row is not None else None
        return default if value is None else value

    return {
        "tenant_id": tenant_id,
        "display_name": pick("display_name", tenant_id),
        "support_email": pick("support_email", None),
        "gap_distance_threshold": float(pick("gap_distance_threshold", settings.GAP_DISTANCE_THRESHOLD)),
        "notify_on_gap": bool(pick("notify_on_gap", True)),
        "notify_on_feedback": bool(pick("notify_on_feedback", True)),
        "email_max_per_hour": int(pick("email_max_per_hour", settings.EMAIL_MAX_PER_HOUR)),
        "smtp_configured": smtp_configured(),
        "widget": _widget_from_row(row),
    }


def get_widget(db: Session, tenant_id: str) -> Dict[str, Any]:
    return _widget_from_row(_row(db, tenant_id))


# ---------------------------------------------------------------------------
# validation + partial update
# ---------------------------------------------------------------------------

def _str(value: Any, field: str, max_len: int, nullable: bool = True) -> Optional[str]:
    if value is None:
        if nullable:
            return None
        raise SettingsError(f"{field} must not be empty")
    if not isinstance(value, str):
        raise SettingsError(f"{field} must be a string")
    value = value.strip()
    if len(value) > max_len:
        raise SettingsError(f"{field} must be at most {max_len} characters")
    return value


def _validate_widget_patch(patch: Any) -> Dict[str, Any]:
    if not isinstance(patch, dict):
        raise SettingsError("widget must be an object")
    clean: Dict[str, Any] = {}
    for key, value in patch.items():
        if key in _WIDGET_OBJECTS:
            if not isinstance(value, dict):
                raise SettingsError(f"widget.{key} must be an object")
            sub = {}
            for k, v in value.items():
                if k not in _WIDGET_OBJECTS[key]:
                    continue  # ignore unknown keys
                v = _str(v, f"widget.{key}.{k}", _WIDGET_OBJECTS[key][k])
                if key == "branding" and k == "logoUrl" and v:
                    if not re.match(r"^(https?://|data:image/|/)", v):
                        raise SettingsError("widget.branding.logoUrl must be an http(s) URL")
                if key in ("theme", "launcher") and not v:
                    raise SettingsError(f"widget.{key}.{k} must not be empty")
                sub[k] = v if v != "" else None
            clean[key] = sub
        elif key in _WIDGET_LISTS:
            max_items, max_len = _WIDGET_LISTS[key]
            if not isinstance(value, list):
                raise SettingsError(f"widget.{key} must be a list of strings")
            if len(value) > max_items:
                raise SettingsError(f"widget.{key} can have at most {max_items} items")
            items = [_str(v, f"widget.{key}[]", max_len, nullable=False) for v in value]
            clean[key] = [v for v in items if v]
        elif key == "placeholder":
            clean[key] = _str(value, "widget.placeholder", 200) or DEFAULT_WIDGET["placeholder"]
        # unknown keys are ignored
    return clean


def update_settings(db: Session, tenant_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
    """Partial merge of ``patch`` into the tenant's settings. Read-only keys are ignored."""
    if not isinstance(patch, dict):
        raise SettingsError("Body must be an object")
    row = _row(db, tenant_id)
    if row is None:
        row = TenantSettings(tenant_id=tenant_id)
        db.add(row)

    if "display_name" in patch:
        row.display_name = _str(patch["display_name"], "display_name", 120) or None
    if "support_email" in patch:
        email = _str(patch["support_email"], "support_email", 254)
        if email and not _EMAIL_RE.match(email):
            raise SettingsError("support_email must be a valid email address")
        row.support_email = email or None
    if "gap_distance_threshold" in patch:
        v = patch["gap_distance_threshold"]
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not 0 <= float(v) <= 2:
            raise SettingsError("gap_distance_threshold must be a number between 0 and 2")
        row.gap_distance_threshold = float(v)
    for flag in ("notify_on_gap", "notify_on_feedback"):
        if flag in patch:
            if not isinstance(patch[flag], bool):
                raise SettingsError(f"{flag} must be true or false")
            setattr(row, flag, patch[flag])
    if "email_max_per_hour" in patch:
        v = patch["email_max_per_hour"]
        if isinstance(v, bool) or not isinstance(v, int) or not 0 <= v <= 1000:
            raise SettingsError("email_max_per_hour must be an integer between 0 and 1000")
        row.email_max_per_hour = v
    if "widget" in patch and patch["widget"] is not None:
        widget = _widget_from_row(row)
        _merge_widget(widget, _validate_widget_patch(patch["widget"]))
        encoded = json.dumps(widget)
        if len(encoded) > 32 * 1024:
            raise SettingsError("widget settings are too large")
        row.widget = encoded
    db.commit()
    return get_settings(db, tenant_id)
