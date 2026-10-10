"""Staff "Messages" page: the knowledge base with its audience labels, and every chat message.

    GET    /api/knowledge/documents            list knowledge chunks (filter by audience/origin/source, search)
    GET    /api/knowledge/documents/{id}       one chunk, full text
    PATCH  /api/knowledge/documents/{id}       set who may see it (trainer+)
    POST   /api/knowledge/documents/bulk       set the audience of many chunks (trainer+)
    GET    /api/knowledge/label                status of the automatic labelling job
    POST   /api/knowledge/label                (re)label chunks automatically (admin+)
    POST   /api/knowledge/label/reset          undo every automatic label (admin+)
    GET    /api/knowledge/messages             every chat message with the sender's role
"""
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app import knowledge as kb
from app.db.models import ChatMessage, ChatSession, Document, TrainingSource
from app.db.session import get_db
from app.dependencies import AuthContext, require_staff
from app.permissions import AUDIENCES, legacy_doc_audience, validate_audience

router = APIRouter()

PREVIEW_CHARS = 280


def _page(page: int, page_size: int):
    return max(page, 1), min(max(page_size, 1), 100)


def _like(q: str) -> str:
    escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _origin(doc: Document) -> Optional[str]:
    if doc.audience_origin:
        return doc.audience_origin
    if doc.audience is not None:
        return kb.ORIGIN_SOURCE if doc.source_id else kb.ORIGIN_STAFF
    return None


def _doc_dict(doc: Document, source_name: Optional[str], full: bool = False) -> dict:
    text = doc.content or ""
    return {
        "id": doc.id,
        "content": text if full else " ".join(text.split())[:PREVIEW_CHARS],
        "length": len(text),
        "source_type": doc.source_type,
        "source_id": doc.source_id,
        "source_name": source_name or doc.file_path or doc.source_type,
        "file_path": doc.file_path,
        "audience": doc.audience,
        # what retrieval actually uses (NULL = legacy default)
        "effective_audience": doc.audience or legacy_doc_audience(),
        "origin": _origin(doc),
        "reason": doc.audience_reason,
        "created_at": doc.created_at,
    }


@router.get("/knowledge/documents")
def list_documents(
    audience: Optional[str] = Query(None, max_length=20, description="public|customer|vendor|internal|admin|unlabelled"),
    origin: Optional[str] = Query(None, max_length=20, description="auto|staff|source"),
    source_id: Optional[str] = Query(None, max_length=80),
    q: Optional[str] = Query(None, max_length=200),
    page: int = Query(1),
    page_size: int = Query(25),
    auth: AuthContext = Depends(require_staff("viewer")),
    db: Session = Depends(get_db),
):
    page, page_size = _page(page, page_size)
    tenant = auth.tenant_id
    base = db.query(Document).filter(Document.tenant_id == tenant)

    counts = {a: 0 for a in AUDIENCES}
    counts["unlabelled"] = 0
    for aud, n in db.query(Document.audience, func.count(Document.id)).filter(
            Document.tenant_id == tenant).group_by(Document.audience).all():
        counts[aud if aud in counts else "unlabelled"] += n
    origin_counts = {o or "none": n for o, n in db.query(Document.audience_origin, func.count(Document.id)).filter(
        Document.tenant_id == tenant).group_by(Document.audience_origin).all()}

    query = base
    if audience:
        a = audience.strip().lower()
        if a == "unlabelled":
            query = query.filter(Document.audience.is_(None))
        elif a in AUDIENCES:
            query = query.filter(Document.audience == a)
        else:
            raise HTTPException(status_code=422, detail="Unknown audience filter")
    if origin:
        query = query.filter(Document.audience_origin == origin.strip().lower())
    if source_id:
        query = query.filter(Document.source_id == source_id)
    if q and q.strip():
        like = _like(q.strip())
        query = query.filter(or_(Document.content.ilike(like, escape="\\"),
                                 Document.file_path.ilike(like, escape="\\")))
    total = query.count()
    docs = query.order_by(Document.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    names = {}
    sids = {d.source_id for d in docs if d.source_id}
    if sids:
        names = dict(db.query(TrainingSource.source_id, TrainingSource.name).filter(
            TrainingSource.tenant_id == tenant, TrainingSource.source_id.in_(sids)).all())
    return {
        "items": [_doc_dict(d, names.get(d.source_id)) for d in docs],
        "total": total, "page": page, "page_size": page_size,
        "counts": counts, "origin_counts": origin_counts,
        "legacy_audience": legacy_doc_audience(),
        "job": kb.job_status(tenant),
    }


def _get_doc(db: Session, tenant: str, doc_id: int) -> Document:
    doc = db.query(Document).filter(Document.id == doc_id, Document.tenant_id == tenant).first()
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge entry not found")
    return doc


@router.get("/knowledge/documents/{doc_id}")
def get_document(doc_id: int, auth: AuthContext = Depends(require_staff("viewer")), db: Session = Depends(get_db)):
    doc = _get_doc(db, auth.tenant_id, doc_id)
    name = None
    if doc.source_id:
        name = db.query(TrainingSource.name).filter(TrainingSource.source_id == doc.source_id).scalar()
    return _doc_dict(doc, name, full=True)


class AudiencePatch(BaseModel):
    audience: str = Field(..., description="public | customer | vendor | internal | admin")

    @field_validator("audience")
    @classmethod
    def _valid(cls, v: str) -> str:
        return validate_audience(v)


class BulkAudience(AudiencePatch):
    ids: List[int] = Field(..., min_length=1, max_length=500)


@router.patch("/knowledge/documents/{doc_id}")
def update_document(doc_id: int, payload: AudiencePatch, auth: AuthContext = Depends(require_staff("trainer")),
                    db: Session = Depends(get_db)):
    _get_doc(db, auth.tenant_id, doc_id)
    kb.set_audience(db, auth.tenant_id, [doc_id], payload.audience)
    return get_document(doc_id, auth, db)


@router.post("/knowledge/documents/bulk")
def bulk_update(payload: BulkAudience, auth: AuthContext = Depends(require_staff("trainer")),
                db: Session = Depends(get_db)):
    updated = kb.set_audience(db, auth.tenant_id, payload.ids, payload.audience)
    return {"ok": True, "updated": updated}


class LabelRequest(BaseModel):
    scope: Literal["unlabelled", "auto"] = Field(
        "unlabelled", description="unlabelled = only chunks without a label; auto = also redo automatic labels")
    use_ai: bool = Field(True, description="Ask the local model about chunks the rules can't settle")


@router.get("/knowledge/label")
def label_status(auth: AuthContext = Depends(require_staff("viewer")), db: Session = Depends(get_db)):
    return {"job": kb.job_status(auth.tenant_id),
            "pending": kb.count_pending(db, auth.tenant_id, "unlabelled")}


@router.post("/knowledge/label", status_code=status.HTTP_202_ACCEPTED)
def start_labelling(payload: LabelRequest, auth: AuthContext = Depends(require_staff("admin"))):
    job = kb.start_job(auth.tenant_id, payload.scope, payload.use_ai, started_by=auth.staff_email)
    return {"job": job}


@router.post("/knowledge/label/reset")
def reset_labels(auth: AuthContext = Depends(require_staff("admin")), db: Session = Depends(get_db)):
    if kb.job_status(auth.tenant_id).get("state") == "running":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Labelling is running; wait for it to finish")
    return {"ok": True, "reset": kb.reset_auto_labels(db, auth.tenant_id)}


@router.get("/knowledge/messages")
def list_messages(
    role: Optional[str] = Query(None, max_length=20, description="Sender role: admin|internal|customer|vendor|public"),
    sender: Optional[Literal["user", "assistant"]] = Query(None),
    q: Optional[str] = Query(None, max_length=200),
    page: int = Query(1),
    page_size: int = Query(30),
    auth: AuthContext = Depends(require_staff("viewer")),
    db: Session = Depends(get_db),
):
    """Every chat message, newest first, with the role of the person in that conversation."""
    page, page_size = _page(page, page_size)
    tenant = auth.tenant_id
    query = db.query(ChatMessage, ChatSession).outerjoin(
        ChatSession, ChatSession.session_id == ChatMessage.session_id).filter(ChatMessage.tenant_id == tenant)
    role_counts = {}
    for r, n in db.query(ChatSession.user_role, func.count(ChatMessage.id)).select_from(ChatMessage).outerjoin(
            ChatSession, ChatSession.session_id == ChatMessage.session_id).filter(
            ChatMessage.tenant_id == tenant).group_by(ChatSession.user_role).all():
        key = (r or "public").lower()
        key = "customer" if key == "portal" else key
        role_counts[key] = role_counts.get(key, 0) + n
    if role:
        r = role.strip().lower()
        if r == "public":
            query = query.filter(or_(ChatSession.user_role.is_(None), ChatSession.user_role == "public"))
        elif r == "customer":
            query = query.filter(ChatSession.user_role.in_(["customer", "portal"]))
        else:
            query = query.filter(ChatSession.user_role == r)
    if sender:
        query = query.filter(ChatMessage.role == sender)
    if q and q.strip():
        like = _like(q.strip())
        query = query.filter(or_(ChatMessage.content.ilike(like, escape="\\"),
                                 ChatSession.user_name.ilike(like, escape="\\")))
    total = query.count()
    rows = query.order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc()).offset(
        (page - 1) * page_size).limit(page_size).all()
    items = []
    for m, s in rows:
        user_role = (s.user_role if s else None)
        items.append({
            "id": m.id,
            "session_id": m.session_id,
            "sender": m.role,
            "content": m.content,
            "created_at": m.created_at,
            "conversation_title": s.title if s else None,
            "user_name": s.user_name if s else None,
            "user_id": s.external_user_id if s else None,
            "user_role": user_role,
            "role_recorded": user_role is not None,
        })
    return {"items": items, "total": total, "page": page, "page_size": page_size, "role_counts": role_counts}
