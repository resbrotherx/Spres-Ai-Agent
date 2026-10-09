"""Staff dashboard reports: knowledge gaps, overview analytics, conversations.

Analytics sources:
  questions     = user chat_messages created in the range (exact, includes history)
  unanswered    = chat_events with answered = false in the range (one per gap question asked,
                  cached gap answers included; recorded from the staff-dashboard release on)
  top_questions = chat_events grouped by normalized question
  by_role       = user messages joined to their session's user_role (NULL -> "public")
"""
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, case, exists, func, or_
from sqlalchemy.orm import Session

from app import gaps as gaps_mod
from app import staff as staff_mod
from app.db.models import (
    ChatEvent, ChatFeedback, ChatMessage, ChatSession, Document, KnowledgeGap, TrainingSource, User,
)
from app.db.session import get_db
from app.dependencies import AuthContext, require_staff
from app.permissions import validate_audience
from app.training import service as training_service
from app.utils.logging import logger

router = APIRouter()


def _page(page: int, page_size: int):
    return max(page, 1), min(max(page_size, 1), 100)


def _like(q: str) -> str:
    escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


# ---------------------------------------------------------------------------
# knowledge gaps
# ---------------------------------------------------------------------------

class GapPatch(BaseModel):
    status: Optional[str] = None
    resolution_note: Optional[str] = Field(None, max_length=4000)


class GapAnswer(BaseModel):
    answer: str = Field(..., min_length=1, max_length=20000)
    audience: Optional[str] = "public"
    also_resolve_similar: Optional[bool] = False


def _get_gap(db: Session, auth: AuthContext, gap_id: int) -> KnowledgeGap:
    gap = db.query(KnowledgeGap).filter(KnowledgeGap.id == gap_id, KnowledgeGap.tenant_id == auth.tenant_id).first()
    if gap is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge gap not found")
    return gap


def _resolve(gap: KnowledgeGap, auth: AuthContext, note: Optional[str] = None) -> None:
    gap.status = "resolved"
    gap.resolved_at = staff_mod.utcnow()
    gap.resolved_by_id = auth.staff_user_id
    gap.resolved_by_name = auth.staff_name
    if note is not None:
        gap.resolution_note = note


@router.get("/reports/gaps")
def list_gaps(
    status_: str = Query("open", alias="status"),
    reason: Optional[str] = Query(None),
    q: Optional[str] = Query(None, max_length=200),
    page: int = Query(1),
    page_size: int = Query(20),
    auth: AuthContext = Depends(require_staff("viewer")),
    db: Session = Depends(get_db),
):
    page, page_size = _page(page, page_size)
    base = db.query(KnowledgeGap).filter(KnowledgeGap.tenant_id == auth.tenant_id)
    if reason:
        if reason not in gaps_mod.GAP_REASONS:
            raise HTTPException(status_code=422, detail=f"reason must be one of: {', '.join(gaps_mod.GAP_REASONS)}")
        base = base.filter(KnowledgeGap.reason == reason)
    if q and q.strip():
        base = base.filter(KnowledgeGap.question.ilike(_like(q.strip()), escape="\\"))

    counts = {s: 0 for s in gaps_mod.GAP_STATUSES}
    for st, n in base.with_entities(KnowledgeGap.status, func.count(KnowledgeGap.id)).group_by(KnowledgeGap.status):
        if st in counts:
            counts[st] = n

    if status_ != "all":
        if status_ not in gaps_mod.GAP_STATUSES:
            raise HTTPException(status_code=422, detail="status must be open, resolved, dismissed or all")
        base = base.filter(KnowledgeGap.status == status_)
    total = base.count()
    items = base.order_by(KnowledgeGap.last_seen_at.desc(), KnowledgeGap.id.desc()) \
        .offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [gaps_mod.gap_to_dict(g) for g in items], "total": total, "page": page,
            "page_size": page_size, "counts": counts}


@router.get("/reports/gaps/{gap_id}")
def get_gap(gap_id: int, auth: AuthContext = Depends(require_staff("viewer")), db: Session = Depends(get_db)):
    return gaps_mod.gap_to_dict(_get_gap(db, auth, gap_id))


@router.patch("/reports/gaps/{gap_id}")
def update_gap(gap_id: int, payload: GapPatch, auth: AuthContext = Depends(require_staff("trainer")),
               db: Session = Depends(get_db)):
    gap = _get_gap(db, auth, gap_id)
    if payload.resolution_note is not None:
        gap.resolution_note = payload.resolution_note.strip() or None
    action = "updated"
    if payload.status is not None and payload.status != gap.status:
        if payload.status not in gaps_mod.GAP_STATUSES:
            raise HTTPException(status_code=422, detail="status must be open, resolved or dismissed")
        if payload.status == "resolved":
            _resolve(gap, auth)
            action = "resolved"
        else:
            gap.status = payload.status
            if payload.status == "dismissed":
                action = "dismissed"
                gap.resolved_at = staff_mod.utcnow()
                gap.resolved_by_id = auth.staff_user_id
                gap.resolved_by_name = auth.staff_name
            else:  # reopened
                gap.resolved_at = None
                gap.resolved_by_id = None
                gap.resolved_by_name = None
    db.commit()
    db.refresh(gap)
    gaps_mod._publish_gap(gap, action)
    return gaps_mod.gap_to_dict(gap)


@router.post("/reports/gaps/{gap_id}/answer")
def answer_gap(gap_id: int, payload: GapAnswer, background_tasks: BackgroundTasks,
               auth: AuthContext = Depends(require_staff("trainer")), db: Session = Depends(get_db)):
    """Teach the bot the answer: creates a text training source and resolves the gap."""
    from app.api.train import _queue  # same task bookkeeping as /api/train/text

    gap = _get_gap(db, auth, gap_id)
    answer = payload.answer.strip()
    if not answer:
        raise HTTPException(status_code=422, detail="answer must not be empty")
    try:
        audience = validate_audience(payload.audience, "public")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    question = " ".join(gap.question.split())
    content = f"Question: {question}\nAnswer: {answer}"
    source = TrainingSource(
        source_id=str(uuid4()), tenant_id=auth.tenant_id, name=f"Answer: {question[:60]}", kind="text",
        source_type="text", audience=audience, status="queued", documents_count=0, records_count=0,
    )
    db.add(source)
    task_id = _queue(db, source)
    _resolve(gap, auth, gap.resolution_note or "Answered from the dashboard")
    gap.source_id = source.source_id
    similar: List[KnowledgeGap] = []
    if payload.also_resolve_similar:
        similar = gaps_mod.resolve_similar(db, gap)
        for other in similar:
            _resolve(other, auth, other.resolution_note or f"Resolved with gap #{gap.id}")
            other.source_id = source.source_id
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Answering gap {gap_id} failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database error")
    db.refresh(gap)
    db.refresh(source)
    gaps_mod._publish_gap(gap, "resolved")
    for other in similar:
        gaps_mod._publish_gap(other, "resolved")
    training_service.publish_status(source)
    background_tasks.add_task(training_service.run_text_training, source.source_id, task_id, content)
    return {
        "gap": gaps_mod.gap_to_dict(gap),
        "source": training_service.source_to_dict(source),
        "task_id": task_id,
        "resolved_similar": len(similar),  # additive
    }


# ---------------------------------------------------------------------------
# overview
# ---------------------------------------------------------------------------

def _day(value) -> str:
    return value.isoformat()[:10] if isinstance(value, (date, datetime)) else str(value)[:10]


@router.get("/reports/overview")
def overview(days: int = Query(30, ge=1, le=365), auth: AuthContext = Depends(require_staff("viewer")),
             db: Session = Depends(get_db)):
    tenant = auth.tenant_id
    today = staff_mod.utcnow().date()
    first_day = today - timedelta(days=days - 1)
    start = datetime.combine(first_day, time.min, tzinfo=timezone.utc)

    user_msgs = db.query(ChatMessage).filter(
        ChatMessage.tenant_id == tenant, ChatMessage.role == "user", ChatMessage.created_at >= start)
    questions = user_msgs.count()
    events = db.query(ChatEvent).filter(ChatEvent.tenant_id == tenant, ChatEvent.created_at >= start)
    unanswered = events.filter(ChatEvent.answered.is_(False)).count()
    answered = max(questions - unanswered, 0)
    conversations = db.query(func.count(ChatSession.id)).filter(
        ChatSession.tenant_id == tenant, ChatSession.created_at >= start).scalar() or 0

    daily_q = {_day(d): n for d, n in user_msgs.with_entities(
        func.date(ChatMessage.created_at), func.count(ChatMessage.id)).group_by(func.date(ChatMessage.created_at))}
    daily_u = {_day(d): n for d, n in events.filter(ChatEvent.answered.is_(False)).with_entities(
        func.date(ChatEvent.created_at), func.count(ChatEvent.id)).group_by(func.date(ChatEvent.created_at))}
    daily = []
    for i in range(days):
        d = (first_day + timedelta(days=i)).isoformat()
        daily.append({"date": d, "questions": daily_q.get(d, 0), "unanswered": daily_u.get(d, 0)})

    role_col = func.coalesce(ChatSession.user_role, "public")
    by_role_rows = db.query(role_col, func.count(ChatMessage.id)).select_from(ChatMessage).outerjoin(
        ChatSession, ChatSession.session_id == ChatMessage.session_id).filter(
        ChatMessage.tenant_id == tenant, ChatMessage.role == "user", ChatMessage.created_at >= start,
    ).group_by(role_col).order_by(func.count(ChatMessage.id).desc()).all()

    top_rows = events.filter(ChatEvent.question_norm.isnot(None), ChatEvent.question_norm != "").with_entities(
        ChatEvent.question_norm, func.max(ChatEvent.question), func.count(ChatEvent.id),
    ).group_by(ChatEvent.question_norm).order_by(func.count(ChatEvent.id).desc()).limit(10).all()

    recent = db.query(KnowledgeGap).filter(KnowledgeGap.tenant_id == tenant, KnowledgeGap.status == "open") \
        .order_by(KnowledgeGap.last_seen_at.desc(), KnowledgeGap.id.desc()).limit(5).all()

    by_status = {"completed": 0, "processing": 0, "queued": 0, "failed": 0}
    for st, n in db.query(TrainingSource.status, func.count(TrainingSource.id)).filter(
            TrainingSource.tenant_id == tenant).group_by(TrainingSource.status):
        if st in by_status:
            by_status[st] = n

    return {
        "range": {"from": first_day.isoformat(), "to": today.isoformat(), "days": days},
        "totals": {
            "conversations": conversations,
            "questions": questions,
            "answered": answered,
            "unanswered": unanswered,
            "answer_rate": round(answered / questions, 4) if questions else 0.0,
            "gaps_open": db.query(func.count(KnowledgeGap.id)).filter(
                KnowledgeGap.tenant_id == tenant, KnowledgeGap.status == "open").scalar() or 0,
            "sources": db.query(func.count(TrainingSource.id)).filter(TrainingSource.tenant_id == tenant).scalar() or 0,
            "documents": db.query(func.count(Document.id)).filter(Document.tenant_id == tenant).scalar() or 0,
            "staff": staff_mod.staff_query(db, tenant).filter(User.is_active.is_(True)).count(),
        },
        "daily": daily,
        "by_role": [{"role": r, "questions": n} for r, n in by_role_rows],
        "top_questions": [{"question": q or norm, "count": n} for norm, q, n in top_rows],
        "recent_gaps": [gaps_mod.gap_to_dict(g) for g in recent],
        "sources_by_status": by_status,
    }


# ---------------------------------------------------------------------------
# conversations
# ---------------------------------------------------------------------------

@router.get("/reports/conversations")
def list_conversations(
    q: Optional[str] = Query(None, max_length=200),
    user_role: Optional[str] = Query(None, max_length=40),
    page: int = Query(1),
    page_size: int = Query(20),
    auth: AuthContext = Depends(require_staff("viewer")),
    db: Session = Depends(get_db),
):
    page, page_size = _page(page, page_size)
    tenant = auth.tenant_id
    stats = db.query(
        ChatMessage.session_id.label("sid"),
        func.count(ChatMessage.id).label("n"),
        func.max(ChatMessage.created_at).label("last_at"),
    ).filter(ChatMessage.tenant_id == tenant).group_by(ChatMessage.session_id).subquery()

    has_gap = or_(
        exists().where(and_(ChatEvent.session_id == ChatSession.session_id, ChatEvent.tenant_id == tenant,
                            ChatEvent.answered.is_(False))),
        exists().where(and_(KnowledgeGap.session_id == ChatSession.session_id, KnowledgeGap.tenant_id == tenant)),
    )
    query = db.query(ChatSession, stats.c.n, stats.c.last_at, has_gap).outerjoin(
        stats, stats.c.sid == ChatSession.session_id).filter(ChatSession.tenant_id == tenant)
    if user_role and user_role.strip():
        role = user_role.strip().lower()
        if role == "public":
            query = query.filter(or_(ChatSession.user_role == "public", ChatSession.user_role.is_(None)))
        else:
            query = query.filter(ChatSession.user_role == role)
    if q and q.strip():
        like = _like(q.strip())
        query = query.filter(or_(
            ChatSession.title.ilike(like, escape="\\"),
            ChatSession.user_name.ilike(like, escape="\\"),
            ChatSession.external_user_id.ilike(like, escape="\\"),
            ChatSession.session_id == q.strip(),
            exists().where(and_(ChatMessage.session_id == ChatSession.session_id, ChatMessage.tenant_id == tenant,
                                ChatMessage.content.ilike(like, escape="\\"))),
        ))
    total = query.count()
    order_at = func.coalesce(stats.c.last_at, ChatSession.created_at)
    rows = query.order_by(order_at.desc(), ChatSession.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    items = [{
        "session_id": s.session_id,
        "title": s.title,
        "user_id": s.external_user_id,
        "user_name": s.user_name,
        "user_role": s.user_role,
        "message_count": n or 0,
        "created_at": s.created_at,
        "last_message_at": last_at,
        "has_gap": bool(gap),
    } for s, n, last_at, gap in rows]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/reports/conversations/{session_id}")
def get_conversation(session_id: str, auth: AuthContext = Depends(require_staff("viewer")),
                     db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.session_id == session_id,
                                           ChatSession.tenant_id == auth.tenant_id).first()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id,
                                            ChatMessage.tenant_id == auth.tenant_id) \
        .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc()).all()
    ids = [m.id for m in messages if m.role == "assistant"]
    gap_by_msg: Dict[int, str] = {}
    rating_by_msg: Dict[int, str] = {}
    if ids:
        for mid, reason in db.query(ChatEvent.message_id, ChatEvent.gap_reason).filter(
                ChatEvent.message_id.in_(ids), ChatEvent.answered.is_(False)):
            gap_by_msg[mid] = reason
        for mid, rating in db.query(ChatFeedback.message_id, ChatFeedback.rating).filter(ChatFeedback.message_id.in_(ids)):
            rating_by_msg[mid] = rating
    return {
        "session_id": session.session_id,
        "title": session.title,
        "user_id": session.external_user_id,
        "user_name": session.user_name,
        "user_role": session.user_role,
        "created_at": session.created_at,
        "messages": [{
            "id": m.id, "role": m.role, "content": m.content, "created_at": m.created_at,
            # additive: gap reason of an unanswered reply, end-user rating ('up' | 'down')
            "gap_reason": gap_by_msg.get(m.id), "feedback": rating_by_msg.get(m.id),
        } for m in messages],
    }
