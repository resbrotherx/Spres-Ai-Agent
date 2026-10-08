import hashlib
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from uuid import uuid4
from datetime import datetime, timedelta

from app.db.session import get_db
from app.db.models import ChatFeedback, ChatSession, ChatMessage as ChatMessageModel
from app.schemas.chat import (
    ChatPayload, ChatResponse, ChatSessionCreate, ChatSessionResponse,
    ChatMessageDetail, ChatSessionDetail, ChatSessionsListRequest, SessionsGroupedByDate,
    FeedbackPayload,
)
from app import gaps
from app.tenant_settings import get_settings as get_tenant_settings
from app.agents.graph import graph
from app.dependencies import AuthContext, require_api_key
from app.permissions import normalize_role
from app.utils.logging import logger
from app.redis_cache.cache import get_cache, set_cache, delete_cache, cache_key

router = APIRouter()

def _clean(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value or None


def _session_not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")


def resolve_session(
    db: Session,
    session_id: str,
    tenant_id: Optional[str],
    user_id: Optional[str] = None,
    user_name: Optional[str] = None,
    user_role: Optional[str] = None,
    create: bool = False,
    title: Optional[str] = None,
) -> ChatSession:
    """Load a chat session the caller may access, optionally creating it.

    - Session of another tenant (when tenant_id is given) -> 404.
    - Session stamped with an external user -> only that same user_id may access it (404
      otherwise, so existence isn't leaked). Unstamped (legacy/tenant-wide) sessions stay
      accessible to everyone in the tenant.
    - Missing session -> created (stamped with tenant/user) when `create`, else 404.
    """
    user_id, user_name, user_role = _clean(user_id), _clean(user_name), _clean(user_role)
    session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()

    if session is None:
        if not create or not tenant_id:
            raise _session_not_found()
        session = ChatSession(
            tenant_id=tenant_id,
            session_id=session_id,
            title=title or f"Chat {session_id[:8]}",
            external_user_id=user_id,
            user_name=user_name,
            user_role=user_role,
        )
        db.add(session)
        db.flush()
        return session

    if tenant_id and session.tenant_id != tenant_id:
        raise _session_not_found()
    if session.external_user_id and session.external_user_id != user_id:
        raise _session_not_found()

    # Keep the owner's display name / role current.
    if user_id and session.external_user_id == user_id:
        if user_name and session.user_name != user_name:
            session.user_name = user_name
        if user_role and session.user_role != user_role:
            session.user_role = user_role
    return session


def question_cache_id(question: str) -> str:
    """Stable id of a question for the answer cache: whitespace-collapsed, lowercased, hashed."""
    normalized = " ".join((question or "").split()).lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def is_invalid_cached_response(response: str) -> bool:
    value = (response or "").strip().lower()
    return (
        not value
        or value.startswith("error:")
        or "temporary failure in name resolution" in value
        or "ai model service is currently unavailable" in value
    )

@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatPayload,
    background_tasks: BackgroundTasks,
    auth: AuthContext = Depends(require_api_key),
    db: Session = Depends(get_db)
):
    try:
        question = payload.question
        tenant_id = auth.resolve_tenant(payload.tenant_id)
        session_id = payload.session_id
        user_id = _clean(payload.user_id)
        # Publishable key -> "public" whatever the client says; secret key -> trusted role.
        user_role = auth.effective_role(payload.user_role)

        # Unknown session_id -> create it (no orphan messages); foreign session -> 404.
        session = resolve_session(
            db,
            session_id or str(uuid4()),
            tenant_id,
            user_id=user_id,
            user_name=payload.user_name,
            user_role=user_role,
            create=True,
            title=question[:60] or None,
        )
        session_id = session.session_id

        # Role that drives retrieval permissions. With keys enforced it comes only from the key
        # (+ trusted secret-key role), never from what a session was stamped with earlier.
        retrieval_role = user_role if auth.enforced else (user_role or session.user_role)

        # Cache is per tenant + effective role + question: answers never cross tenants, and a
        # public user can never get an answer built from internal documents. The question part
        # is a SHA-256 of the whole normalized question - integrations prepend long shared
        # prefixes ("Context: Odoo record ... Question: ..."), so a prefix would collide.
        cache_k = cache_key(tenant_id, "chat", f"role={normalize_role(retrieval_role)}:{question_cache_id(question)}")
        cached_response = get_cache(cache_k)

        if cached_response:
            cached_text = (
                cached_response.get("response", "")
                if isinstance(cached_response, dict)
                else str(cached_response)
            )
            if is_invalid_cached_response(cached_text):
                logger.warning(f"Ignoring invalid cached chat response for question: {question[:50]}")
                delete_cache(cache_k)
                cached_response = None

        if cached_response:
            logger.info(f"Cache hit for question: {question[:50]}")
            user_message = ChatMessageModel(
                session_id=session_id,
                tenant_id=tenant_id,
                role="user",
                content=question
            )
            assistant_message = ChatMessageModel(
                session_id=session_id,
                tenant_id=tenant_id,
                role="assistant",
                content=cached_response.get("response", ""),
                context=""
            )
            db.add(user_message)
            db.add(assistant_message)
            db.commit()

            # A cached answer that was itself a gap answer still counts as unanswered (the
            # existing gap's occurrences go up; no new notification). Older cache entries
            # without "gap_reason" count as answered.
            background_tasks.add_task(
                gaps.record_chat_outcome, tenant_id, question, cached_response.get("response", ""),
                cached_response.get("gap_reason"), cached_response.get("best_distance"),
                session_id=session_id, message_id=assistant_message.id, user_id=user_id,
                user_name=_clean(payload.user_name) or session.user_name,
                user_role=retrieval_role, cached=True,
            )

            return ChatResponse(
                response=cached_response.get("response", ""),
                reasoning="Retrieved from cache",
                search_results=cached_response.get("search_results"),
                session_id=session_id,
                message_id=assistant_message.id,
                user_message_id=user_message.id,
            )

        logger.info(f"Processing chat question: {question}")

        result = graph.invoke({
            "question": question,
            "tenant_id": tenant_id,
            "context": [],
            "response": None,
            "search_results": [],
            "reasoning": None,
            # log_node filters retrieval by the audiences this role may read.
            "user_id": user_id,
            "user_role": retrieval_role,
        })

        try:
            threshold = get_tenant_settings(db, tenant_id)["gap_distance_threshold"]
        except Exception as e:  # settings lookup must never break chat
            logger.warning(f"Tenant settings unavailable, using default gap threshold: {e}")
            db.rollback()
            from app.config import settings as app_settings
            threshold = app_settings.GAP_DISTANCE_THRESHOLD
        gap_reason, best = gaps.detect_gap(
            result.get("response"), result.get("search_results"), result.get("reasoning"), threshold)

        cache_data = {
            "response": result.get("response", "No response generated"),
            "search_results": result.get("search_results", []),
            "reasoning": result.get("reasoning"),
            "gap_reason": gap_reason,
            "best_distance": best,
        }
        response_data = {
            "response": cache_data["response"],
            "search_results": cache_data["search_results"],
            "reasoning": cache_data["reasoning"],
            "session_id": session_id
        }

        if not is_invalid_cached_response(cache_data["response"]):
            set_cache(cache_k, cache_data, ttl=3600)

        if session_id:
            user_message = ChatMessageModel(
                session_id=session_id,
                tenant_id=tenant_id,
                role="user",
                content=question
            )
            assistant_message = ChatMessageModel(
                session_id=session_id,
                tenant_id=tenant_id,
                role="assistant",
                content=result.get("response", ""),
                context="\n".join(result.get("context", []))
            )
            db.add(user_message)
            db.add(assistant_message)
            db.commit()
            response_data["message_id"] = assistant_message.id
            response_data["user_message_id"] = user_message.id

        background_tasks.add_task(
            gaps.record_chat_outcome, tenant_id, question, cache_data["response"], gap_reason, best,
            session_id=session_id, message_id=response_data.get("message_id"), user_id=user_id,
            user_name=_clean(payload.user_name) or session.user_name,
            user_role=retrieval_role, cached=False,
        )

        return ChatResponse(**response_data)

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/chat/session", response_model=ChatSessionResponse)
async def create_chat_session(
    payload: ChatSessionCreate,
    auth: AuthContext = Depends(require_api_key),
    db: Session = Depends(get_db)
):
    tenant_id = auth.resolve_tenant(payload.tenant_id)
    try:
        session_id = str(uuid4())

        session = ChatSession(
            tenant_id=tenant_id,
            session_id=session_id,
            title=payload.title or f"Chat {session_id[:8]}",
            external_user_id=_clean(payload.user_id),
            user_name=_clean(payload.user_name),
            user_role=auth.effective_role(payload.user_role),
        )
        db.add(session)
        db.commit()

        return ChatSessionResponse(
            session_id=session_id,
            title=session.title,
            created_at=session.created_at.isoformat(),
            user_id=session.external_user_id,
        )

    except Exception as e:
        logger.error(f"Error creating chat session: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

def get_sessions_grouped_by_date(
    tenant_id: str, db: Session, user_id: Optional[str] = None
) -> SessionsGroupedByDate:
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    week_start = today_start - timedelta(days=7)

    query = db.query(ChatSession).filter(ChatSession.tenant_id == tenant_id)
    user_id = _clean(user_id)
    if user_id:
        # Per-user history; without user_id the whole tenant is listed (legacy behaviour).
        query = query.filter(ChatSession.external_user_id == user_id)
    sessions = query.order_by(ChatSession.created_at.desc()).all()

    grouped = {
        "today": [],
        "yesterday": [],
        "this_week": [],
        "older": []
    }

    for session in sessions:
        session_response = ChatSessionResponse(
            session_id=session.session_id,
            title=session.title,
            created_at=session.created_at.isoformat(),
            user_id=session.external_user_id,
        )

        created = session.created_at.replace(tzinfo=None)

        if created >= today_start:
            grouped["today"].append(session_response)
        elif created >= yesterday_start:
            grouped["yesterday"].append(session_response)
        elif created >= week_start:
            grouped["this_week"].append(session_response)
        else:
            grouped["older"].append(session_response)

    return SessionsGroupedByDate(**grouped)

@router.post("/chat/sessions", response_model=SessionsGroupedByDate)
@router.post("/sessions", response_model=SessionsGroupedByDate, include_in_schema=False)
async def list_chat_sessions(
    payload: ChatSessionsListRequest,
    auth: AuthContext = Depends(require_api_key),
    db: Session = Depends(get_db)
):
    tenant_id = auth.resolve_tenant(payload.tenant_id)
    try:
        return get_sessions_grouped_by_date(tenant_id, db, payload.user_id)

    except Exception as e:
        logger.error(f"Error listing sessions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/chat/sessions", response_model=SessionsGroupedByDate, include_in_schema=False)
@router.get("/sessions", response_model=SessionsGroupedByDate, include_in_schema=False)
async def list_sessions_legacy(
    tenant_id: Optional[str] = Query(None, description="Tenant ID (defaults to the API key's tenant)"),
    user_id: Optional[str] = Query(None, description="External user id; limits to that user's sessions"),
    auth: AuthContext = Depends(require_api_key),
    db: Session = Depends(get_db)
):
    tenant_id = auth.resolve_tenant(tenant_id)
    try:
        return get_sessions_grouped_by_date(tenant_id, db, user_id)

    except Exception as e:
        logger.error(f"Error listing sessions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/chat/session/{session_id}/messages", response_model=ChatSessionDetail)
@router.get("/session/{session_id}/messages", response_model=ChatSessionDetail, include_in_schema=False)
async def get_session_messages(
    session_id: str,
    tenant_id: Optional[str] = Query(None, description="Tenant ID (404 if the session belongs to another tenant)"),
    user_id: Optional[str] = Query(None, description="External user id (required to read a user-owned session)"),
    auth: AuthContext = Depends(require_api_key),
    db: Session = Depends(get_db)
):
    # With keys enforced this is always the key's tenant; legacy mode keeps tenant optional.
    tenant_id = auth.resolve_tenant(tenant_id, required=False)
    try:
        session = resolve_session(db, session_id, tenant_id, user_id=user_id)

        messages = db.query(ChatMessageModel).filter(
            ChatMessageModel.session_id == session_id
        ).order_by(ChatMessageModel.created_at.asc()).all()

        message_details = []
        for msg in messages:
            user_initials = None
            if msg.role == "user":
                user_initials = "U"
            else:
                user_initials = "A"

            message_details.append(ChatMessageDetail(
                id=msg.id,
                role=msg.role,
                content=msg.content,
                created_at=msg.created_at.isoformat(),
                user_initials=user_initials,
                metadata={
                    "context_used": msg.context is not None and len(msg.context) > 0
                }
            ))

        return ChatSessionDetail(
            session_id=session.session_id,
            title=session.title,
            messages=message_details,
            created_at=session.created_at.isoformat(),
            user_id=session.external_user_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting session messages: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/chat/feedback")
def chat_feedback(
    payload: FeedbackPayload,
    background_tasks: BackgroundTasks,
    auth: AuthContext = Depends(require_api_key),
    db: Session = Depends(get_db),
):
    """Thumbs up/down on an assistant answer (publishable keys OK). 'down' creates or bumps a
    negative_feedback knowledge gap and notifies staff. Re-rating the same message updates it."""
    tenant_id = auth.resolve_tenant(payload.tenant_id)
    session = db.query(ChatSession).filter(ChatSession.session_id == payload.session_id).first()
    user_id = _clean(payload.user_id)
    if session is None or session.tenant_id != tenant_id or (
            user_id and session.external_user_id and session.external_user_id != user_id):
        raise _session_not_found()

    msgs = db.query(ChatMessageModel).filter(ChatMessageModel.session_id == session.session_id)
    if payload.message_id is not None:
        target = msgs.filter(ChatMessageModel.id == payload.message_id).first()
        if target is not None and target.role == "user":
            # feedback sent with the user's message id: rate the answer that followed it
            target = msgs.filter(ChatMessageModel.id > target.id, ChatMessageModel.role == "assistant") \
                .order_by(ChatMessageModel.id.asc()).first()
    else:
        target = msgs.filter(ChatMessageModel.role == "assistant").order_by(ChatMessageModel.id.desc()).first()
    if target is None or target.role != "assistant":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    question_msg = msgs.filter(ChatMessageModel.id < target.id, ChatMessageModel.role == "user") \
        .order_by(ChatMessageModel.id.desc()).first()
    comment = (payload.comment or "").strip()[:2000] or None

    fb = db.query(ChatFeedback).filter(ChatFeedback.message_id == target.id).first()
    was_down = fb is not None and fb.rating == "down"
    if fb is None:
        fb = ChatFeedback(tenant_id=tenant_id, session_id=session.session_id, message_id=target.id,
                          rating=payload.rating, comment=comment)
        db.add(fb)
    else:
        fb.rating = payload.rating
        if comment:
            fb.comment = comment
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Saving feedback failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not save feedback")

    if payload.rating == "down" and not was_down and question_msg is not None:
        background_tasks.add_task(
            gaps.record_feedback_gap, tenant_id, question_msg.content, target.content, fb.id, comment,
            session.session_id, session.external_user_id, session.user_name, session.user_role,
        )
    return {"ok": True}
