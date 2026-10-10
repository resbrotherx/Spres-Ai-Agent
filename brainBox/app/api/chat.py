import hashlib
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool
from uuid import uuid4
from datetime import datetime, timedelta

from app import realtime
from app.agents.nodes import log_node as nodes
from app.config import settings as app_settings
from app.db.session import SessionLocal, get_db
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

# ---------------------------------------------------------------------------
# chat turn: shared by POST /api/chat and POST /api/chat/stream
# ---------------------------------------------------------------------------

@dataclass
class ChatTurn:
    """Everything resolved before answering (plain values: usable from any thread/DB session)."""
    question: str
    tenant_id: Optional[str]
    session_id: str
    title: Optional[str]
    user_id: Optional[str]
    user_name: Optional[str]
    session_role: Optional[str]
    # Role that drives retrieval permissions (and the cache key).
    retrieval_role: Optional[str]
    cache_k: str
    user_message_id: Optional[int] = None


def _publish_message(db: Session, turn: ChatTurn, role: str, message: ChatMessageModel) -> None:
    """Live "conversation" event for staff dashboards (cheap no-op without listeners)."""
    try:
        created_at = message.created_at if realtime.broker.has_subscribers(turn.tenant_id) else None
        realtime.publish_message(turn.tenant_id, turn.session_id, turn.title, turn.user_name,
                                 turn.session_role or turn.retrieval_role, role, message.content,
                                 message.id, created_at)
    except Exception as e:  # realtime must never break chat
        db.rollback()
        logger.warning(f"Publishing chat message event failed: {e}")


def prepare_turn(db: Session, payload: ChatPayload, auth: AuthContext) -> ChatTurn:
    """Auth/tenant/role, session resolution and the stored user message. Raises HTTPException."""
    question = payload.question
    tenant_id = auth.resolve_tenant(payload.tenant_id)
    user_id = _clean(payload.user_id)
    # Publishable key -> "public" whatever the client says; secret key -> trusted role.
    user_role = auth.effective_role(payload.user_role)

    # Unknown session_id -> create it (no orphan messages); foreign session -> 404.
    session = resolve_session(
        db,
        payload.session_id or str(uuid4()),
        tenant_id,
        user_id=user_id,
        user_name=payload.user_name,
        user_role=user_role,
        create=True,
        title=question[:60] or None,
    )

    # Role that drives retrieval permissions. With keys enforced it comes only from the key
    # (+ trusted secret-key role), never from what a session was stamped with earlier.
    retrieval_role = user_role if auth.enforced else (user_role or session.user_role)

    # Cache is per tenant + effective role + question: answers never cross tenants, and a
    # public user can never get an answer built from internal documents. The question part
    # is a SHA-256 of the whole normalized question - integrations prepend long shared
    # prefixes ("Context: Odoo record ... Question: ..."), so a prefix would collide.
    cache_k = cache_key(tenant_id, "chat", f"role={normalize_role(retrieval_role)}:{question_cache_id(question)}")

    turn = ChatTurn(
        question=question,
        tenant_id=tenant_id,
        session_id=session.session_id,
        title=session.title,
        user_id=user_id,
        user_name=_clean(payload.user_name) or session.user_name,
        session_role=session.user_role,
        retrieval_role=retrieval_role,
        cache_k=cache_k,
    )
    user_message = ChatMessageModel(session_id=turn.session_id, tenant_id=tenant_id, role="user", content=question)
    db.add(user_message)
    db.commit()
    turn.user_message_id = user_message.id
    _publish_message(db, turn, "user", user_message)
    return turn


def lookup_cache(turn: ChatTurn) -> Optional[Dict[str, Any]]:
    """A valid cached answer for this turn (invalid ones are deleted), else None."""
    cached_response = get_cache(turn.cache_k)
    if not cached_response:
        return None
    if not isinstance(cached_response, dict):
        cached_response = {"response": str(cached_response)}
    if is_invalid_cached_response(cached_response.get("response", "")):
        logger.warning(f"Ignoring invalid cached chat response for question: {turn.question[:50]}")
        delete_cache(turn.cache_k)
        return None
    return cached_response


def graph_state(turn: ChatTurn) -> Dict[str, Any]:
    return {
        "question": turn.question,
        "tenant_id": turn.tenant_id,
        "context": [],
        "response": None,
        "search_results": [],
        "reasoning": None,
        # log_node filters retrieval by the audiences this role may read.
        "user_id": turn.user_id,
        "user_role": turn.retrieval_role,
        "small_talk": None,
        "instant_reply": None,
    }


def _finish_turn(db: Session, turn: ChatTurn, background_tasks: BackgroundTasks, *, response: str,
                 reasoning: Optional[str], search_results, context: str, cached: bool,
                 gap_reason: Optional[str], best: Optional[float], stored: Optional[str] = None) -> Dict[str, Any]:
    """Persist the assistant message, schedule chat_event + gap recording, publish the event."""
    assistant_message = ChatMessageModel(
        session_id=turn.session_id,
        tenant_id=turn.tenant_id,
        role="assistant",
        content=response if stored is None else stored,
        context=context,
    )
    db.add(assistant_message)
    db.commit()

    # A cached answer that was itself a gap answer still counts as unanswered (the existing
    # gap's occurrences go up; no new notification). Older cache entries without "gap_reason"
    # count as answered.
    background_tasks.add_task(
        gaps.record_chat_outcome, turn.tenant_id, turn.question, response, gap_reason, best,
        session_id=turn.session_id, message_id=assistant_message.id, user_id=turn.user_id,
        user_name=turn.user_name, user_role=turn.retrieval_role, cached=cached,
    )
    _publish_message(db, turn, "assistant", assistant_message)
    return {
        "response": response,
        "reasoning": reasoning,
        "search_results": search_results,
        "session_id": turn.session_id,
        "message_id": assistant_message.id,
        "user_message_id": turn.user_message_id,
    }


def finish_cached(db: Session, turn: ChatTurn, cached_response: Dict[str, Any],
                  background_tasks: BackgroundTasks) -> Dict[str, Any]:
    return _finish_turn(
        db, turn, background_tasks,
        response=cached_response.get("response", ""),
        reasoning="Retrieved from cache",
        search_results=cached_response.get("search_results"),
        context="",
        cached=True,
        gap_reason=cached_response.get("gap_reason"),
        best=cached_response.get("best_distance"),
    )


def finish_fresh(db: Session, turn: ChatTurn, background_tasks: BackgroundTasks, *, response: str,
                 reasoning: Optional[str], search_results, context: Optional[List[str]],
                 stored: Optional[str] = None) -> Dict[str, Any]:
    """Gap detection, answer cache, then ``_finish_turn``."""
    try:
        threshold = get_tenant_settings(db, turn.tenant_id)["gap_distance_threshold"]
    except Exception as e:  # settings lookup must never break chat
        logger.warning(f"Tenant settings unavailable, using default gap threshold: {e}")
        db.rollback()
        threshold = app_settings.GAP_DISTANCE_THRESHOLD
    gap_reason, best = gaps.detect_gap(response, search_results, reasoning, threshold)

    cache_data = {
        "response": response,
        "search_results": search_results,
        "reasoning": reasoning,
        "gap_reason": gap_reason,
        "best_distance": best,
    }
    # Small talk depends on the time of day ("good morning"), so it is never cached.
    if not is_invalid_cached_response(cache_data["response"]) and not nodes.is_small_talk_reasoning(reasoning):
        set_cache(turn.cache_k, cache_data, ttl=3600)

    return _finish_turn(
        db, turn, background_tasks,
        response=response, reasoning=reasoning, search_results=search_results,
        context="\n".join(context or []), cached=False, gap_reason=gap_reason, best=best, stored=stored,
    )


@router.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatPayload,
    background_tasks: BackgroundTasks,
    auth: AuthContext = Depends(require_api_key),
    db: Session = Depends(get_db)
):
    # Sync handler: FastAPI runs it in the threadpool, so a slow LLM never blocks the event loop
    # (live SSE streams keep flowing).
    try:
        turn = prepare_turn(db, payload, auth)

        cached_response = lookup_cache(turn)
        if cached_response:
            logger.info(f"Cache hit for question: {turn.question[:50]}")
            return ChatResponse(**finish_cached(db, turn, cached_response, background_tasks))

        logger.info(f"Processing chat question: {turn.question}")
        result = graph.invoke(graph_state(turn))

        return ChatResponse(**finish_fresh(
            db, turn, background_tasks,
            response=result.get("response", "No response generated"),
            reasoning=result.get("reasoning"),
            search_results=result.get("search_results", []),
            context=result.get("context", []),
            stored=result.get("response", ""),
        ))

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


# ---------------------------------------------------------------------------
# streaming chat (Server-Sent Events)
# ---------------------------------------------------------------------------

SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"}


def _with_db(fn, *args, **kwargs):
    """Run ``fn(db, ...)`` with a fresh DB session (streams outlive the request's session)."""
    db = SessionLocal()
    try:
        return fn(db, *args, **kwargs)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _answer_events(turn: ChatTurn):
    """Blocking generator (runs in a worker thread): retrieval, then the streamed answer.
    Yields ("state", state), then ("token", t)... and one ("end"|"fallback"|"instant", text,
    reasoning); raises LLMStreamError when the LLM breaks off mid-answer."""
    state = nodes.router_node(graph_state(turn))
    state = nodes.log_node(state)  # audience-filtered retrieval, same as the graph
    yield ("state", state)
    if state.get("instant_reply"):
        yield ("instant", state["instant_reply"], nodes.SMALL_TALK_REASONING)
        return
    prompt = nodes.build_prompt(state)
    if prompt is None:
        yield ("instant", nodes.no_context_response(), nodes.NO_CONTEXT_REASONING)
        return
    for event in nodes.stream_answer(prompt):
        if event[0] == "end" and state.get("small_talk"):
            event = ("end", event[1], nodes.SMALL_TALK_REASONING)
        yield event


async def _stream_turn(turn: ChatTurn, background_tasks: BackgroundTasks):
    yield realtime.sse("meta", {"session_id": turn.session_id, "user_message_id": turn.user_message_id})
    try:
        cached_response = await run_in_threadpool(lookup_cache, turn)
        if cached_response:
            logger.info(f"Cache hit for question (stream): {turn.question[:50]}")
            data = await run_in_threadpool(_with_db, finish_cached, turn, cached_response, background_tasks)
            yield realtime.sse("token", {"t": data["response"]})
            yield realtime.sse("done", {**data, "cached": True})
            return

        logger.info(f"Processing chat question (stream): {turn.question}")
        state: Dict[str, Any] = {}
        outcome = None
        try:
            async for item in realtime.iterate_in_thread(lambda: _answer_events(turn),
                                                         heartbeat=app_settings.SSE_PING_SECONDS):
                if item is realtime.HEARTBEAT:
                    yield realtime.PING
                elif item[0] == "state":
                    state = item[1]
                elif item[0] == "token":
                    yield realtime.sse("token", {"t": item[1]})
                else:
                    outcome = item
        except nodes.LLMStreamError:
            # Same as /api/chat when the LLM is unavailable: the fallback text is stored (and
            # recorded as an llm_unavailable gap), but the stream reports an error.
            data = await run_in_threadpool(
                _with_db, finish_fresh, turn, background_tasks,
                response=nodes.LLM_FALLBACK_RESPONSE, reasoning=nodes.LLM_FALLBACK_REASONING,
                search_results=state.get("search_results", []), context=state.get("context", []))
            yield realtime.sse("error", {
                "detail": data["response"], "status": status.HTTP_503_SERVICE_UNAVAILABLE,
                # additive: the stored fallback message
                "session_id": data["session_id"], "message_id": data["message_id"],
                "user_message_id": data["user_message_id"],
            })
            return

        if outcome is None:
            raise RuntimeError("The answer stream ended without a result")
        kind, text, reasoning = outcome
        if kind != "end":  # no-context answer / LLM fallback: the whole text at once
            yield realtime.sse("token", {"t": text})
        data = await run_in_threadpool(
            _with_db, finish_fresh, turn, background_tasks,
            response=text, reasoning=reasoning,
            search_results=state.get("search_results", []), context=state.get("context", []))
        yield realtime.sse("done", {**data, "cached": False})
    except Exception as e:
        logger.error(f"Error in chat stream: {e}", exc_info=True)
        yield realtime.sse("error", {"detail": str(e), "status": status.HTTP_500_INTERNAL_SERVER_ERROR})


@router.post("/chat/stream", responses={200: {"content": {"text/event-stream": {}}}})
async def chat_stream(
    payload: ChatPayload,
    auth: AuthContext = Depends(require_api_key),
    db: Session = Depends(get_db),
):
    """Like POST /api/chat, streamed as Server-Sent Events: ``meta`` -> ``token``* -> ``done``
    (or ``error``). Auth/validation/session errors are plain HTTP errors before the stream."""
    try:
        turn = await run_in_threadpool(prepare_turn, db, payload, auth)
    except HTTPException:
        await run_in_threadpool(db.rollback)
        raise
    except Exception as e:
        await run_in_threadpool(db.rollback)
        logger.error(f"Error in chat stream endpoint: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    background_tasks = BackgroundTasks()  # gap recording etc. run after the stream ends
    return StreamingResponse(_stream_turn(turn, background_tasks), media_type="text/event-stream",
                             headers=SSE_HEADERS, background=background_tasks)

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
