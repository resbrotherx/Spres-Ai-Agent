"""GET /api/staff/events - live Server-Sent Events stream for the staff dashboard.

Auth: a staff JWT in ``Authorization: Bearer <jwt>`` or ``?token=<jwt>`` (for clients that can't
set headers). API keys are rejected (403). Events are scoped to the user's tenant (see
app/realtime.py for routing); ``: ping`` comments every SSE_PING_SECONDS keep proxies happy and
detect disconnected clients.
"""
import asyncio
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool

from app import realtime
from app import staff as staff_mod
from app.config import settings
from app.db.session import SessionLocal
from app.dependencies import INVALID_SESSION, STAFF_REQUIRED, extract_api_key
from app.utils.logging import logger

router = APIRouter()

SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"}


def _load_user(token: Optional[str]):
    """(user_id, tenant_id, role, is_platform_admin) of the staff JWT, else None."""
    db = SessionLocal()
    try:
        user = staff_mod.user_from_jwt(db, token) if staff_mod.looks_like_jwt(token) else None
        if user is None:
            return None
        return user.id, user.tenant_id, user.role, bool(user.is_platform_admin)
    finally:
        db.close()


def _authenticate(request: Request, token: Optional[str]):
    raw = extract_api_key(request) or ((token or "").strip() or None)
    if not raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=STAFF_REQUIRED,
                            headers={"WWW-Authenticate": "Bearer"})
    if not staff_mod.looks_like_jwt(raw):  # an API key (or garbage): this stream is staff-only
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=STAFF_REQUIRED)
    who = _load_user(raw)
    if who is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=INVALID_SESSION,
                            headers={"WWW-Authenticate": "Bearer"})
    return raw, who


@router.get("/staff/events", responses={200: {"content": {"text/event-stream": {}}}})
async def staff_events(request: Request, token: Optional[str] = Query(None, description="Staff JWT (alternative to the Authorization header)")):
    raw, (user_id, tenant_id, role, is_pa) = await run_in_threadpool(_authenticate, request, token)

    async def stream():
        sub = realtime.broker.subscribe(tenant_id, user_id, role, is_pa)
        logger.info(f"Realtime: staff user {user_id} connected (tenant {tenant_id}, "
                    f"{realtime.broker.subscriber_count(tenant_id)} live)")
        try:
            yield realtime.sse("hello", {"user_id": user_id, "tenant_id": tenant_id,
                                         "server_time": datetime.now(timezone.utc)})
            try:
                counts = await run_in_threadpool(realtime.overview_counts, tenant_id)
                realtime.broker.remember_overview(tenant_id, counts)
                yield realtime.sse("overview", counts)
            except Exception as e:
                logger.warning(f"Realtime initial overview failed: {e}")
            ping = max(settings.SSE_PING_SECONDS, 0.05)
            next_auth = time.monotonic() + settings.REALTIME_REAUTH_SECONDS
            while True:
                try:
                    frame = await asyncio.wait_for(sub.queue.get(), timeout=ping)
                except asyncio.TimeoutError:
                    frame = realtime.PING
                    if await request.is_disconnected():
                        break
                yield frame
                if time.monotonic() >= next_auth:  # deactivated / expired session -> end the stream
                    next_auth = time.monotonic() + settings.REALTIME_REAUTH_SECONDS
                    who = await run_in_threadpool(_load_user, raw)
                    if who is None or who[1] != tenant_id:
                        yield realtime.sse("error", {"detail": INVALID_SESSION, "status": 401})
                        break
                    sub.role = who[2]
        finally:
            realtime.broker.unsubscribe(sub)
            logger.info(f"Realtime: staff user {user_id} disconnected (tenant {tenant_id})")

    return StreamingResponse(stream(), media_type="text/event-stream", headers=SSE_HEADERS)
