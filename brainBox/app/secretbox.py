"""Reversible encryption for secrets admins may need to see again (API keys).

API keys are authenticated by their SHA-256 hash; this encrypted copy exists only so an admin
can reveal, copy and share a key later from the staff dashboard. Fernet (AES-128-CBC + HMAC)
with a key derived from KEY_ENCRYPTION_SECRET (falls back to JWT_SECRET_KEY). If that secret
changes, older copies can no longer be decrypted — those keys must be rolled to be shown again.
"""
import base64
import hashlib
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings


def _fernet() -> Fernet:
    secret = (settings.KEY_ENCRYPTION_SECRET or settings.JWT_SECRET_KEY or "").encode()
    key = base64.urlsafe_b64encode(hashlib.sha256(b"brainbox-key-box:" + secret).digest())
    return Fernet(key)


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(token: Optional[str]) -> Optional[str]:
    """The plain value, or None when there is no copy or it can't be decrypted any more."""
    if not token:
        return None
    try:
        return _fernet().decrypt(token.encode()).decode()
    except (InvalidToken, ValueError):
        return None
