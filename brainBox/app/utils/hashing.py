import hashlib


def create_hash(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed
