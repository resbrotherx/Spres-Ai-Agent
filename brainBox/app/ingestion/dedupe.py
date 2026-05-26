from sqlalchemy.orm import Session
from app.db.models import Document

def is_duplicate(db: Session, content_hash: str, tenant_id: str = None) -> bool:
    query = db.query(Document).filter(
        Document.content_hash == content_hash
    )

    if tenant_id:
        query = query.filter(Document.tenant_id == tenant_id)

    existing = query.first()
    return existing is not None

def get_duplicate_count(db: Session, tenant_id: str = None) -> int:
    query = db.query(Document)

    if tenant_id:
        query = query.filter(Document.tenant_id == tenant_id)

    return query.count()
