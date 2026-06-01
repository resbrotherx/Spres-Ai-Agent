from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from uuid import uuid4
from datetime import datetime, timedelta

from app.db.session import get_db
from app.db.models import ChatSession, ChatMessage as ChatMessageModel
from app.schemas.chat import (
    ChatPayload, ChatResponse, ChatSessionCreate, ChatSessionResponse,
    ChatMessageDetail, ChatSessionDetail, SessionsGroupedByDate
)
from app.agents.graph import graph
from app.utils.logging import logger
from app.redis_cache.cache import get_cache, set_cache, cache_key

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatPayload,
    db: Session = Depends(get_db)
):
    try:
        question = payload.question
        tenant_id = payload.tenant_id

        cache_k = cache_key(tenant_id, "chat", question[:50])
        cached_response = get_cache(cache_k)

        if cached_response:
            logger.info(f"Cache hit for question: {question[:50]}")
            return ChatResponse(
                response=cached_response.get("response"),
                reasoning="Retrieved from cache",
                search_results=cached_response.get("search_results")
            )

        logger.info(f"Processing chat question: {question}")

        result = graph.invoke({
            "question": question,
            "tenant_id": tenant_id,
            "context": [],
            "response": None,
            "search_results": [],
            "reasoning": None
        })

        response_data = {
            "response": result.get("response", "No response generated"),
            "search_results": result.get("search_results", []),
            "reasoning": result.get("reasoning")
        }

        set_cache(cache_k, response_data, ttl=3600)

        if payload.session_id:
            message = ChatMessageModel(
                session_id=payload.session_id,
                tenant_id=tenant_id,
                role="assistant",
                content=result.get("response", ""),
                context="\n".join(result.get("context", []))
            )
            db.add(message)
            db.commit()

        return ChatResponse(**response_data)

    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/chat/session", response_model=ChatSessionResponse)
async def create_chat_session(
    payload: ChatSessionCreate,
    db: Session = Depends(get_db)
):
    try:
        session_id = str(uuid4())

        session = ChatSession(
            tenant_id=payload.tenant_id,
            session_id=session_id,
            title=payload.title or f"Chat {session_id[:8]}"
        )
        db.add(session)
        db.commit()

        return ChatSessionResponse(
            session_id=session_id,
            title=session.title,
            created_at=session.created_at.isoformat()
        )

    except Exception as e:
        logger.error(f"Error creating chat session: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/sessions", response_model=SessionsGroupedByDate)
async def list_sessions(
    tenant_id: str = Query(..., description="Tenant ID"),
    db: Session = Depends(get_db)
):
    try:
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_start = today_start - timedelta(days=1)
        week_start = today_start - timedelta(days=7)

        sessions = db.query(ChatSession).filter(
            ChatSession.tenant_id == tenant_id
        ).order_by(ChatSession.created_at.desc()).all()

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
                created_at=session.created_at.isoformat()
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

    except Exception as e:
        logger.error(f"Error listing sessions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/session/{session_id}/messages", response_model=ChatSessionDetail)
async def get_session_messages(
    session_id: str,
    db: Session = Depends(get_db)
):
    try:
        session = db.query(ChatSession).filter(
            ChatSession.session_id == session_id
        ).first()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )

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
            created_at=session.created_at.isoformat()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting session messages: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
