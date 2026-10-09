"""Realtime plumbing: an in-process pub/sub broker for live staff-dashboard events (SSE) and a
sync-iterator -> async-generator bridge used by the streaming chat endpoint.

Broker
------
``publish(tenant_id, event, data, user_id=None, min_role=None)`` may be called from any thread
(request handlers running in the threadpool, BackgroundTasks, training jobs). The payload is
serialized immediately in the caller's thread (so ORM objects are never touched later) and
delivered on the app's event loop with ``loop.call_soon_threadsafe``. Each connected dashboard
(``GET /api/staff/events``) owns a bounded queue; when it is full new events for that client
are dropped (logged), so a slow consumer never blocks publishers or other clients.

Routing: subscribers of ``tenant_id`` receive the event, filtered by ``user_id`` (only that staff
user, e.g. notifications) and ``min_role`` (e.g. staff/keys events need admin+). ``staff`` and
``keys`` events are also delivered to platform admins connected from other tenants (the
"platform" events of the contract); their payloads carry ``tenant_id``.

Scaling: the broker is per process. With a single uvicorn worker (today's deployment) every
event reaches every dashboard. With several workers (or Celery workers publishing), a dashboard
only sees events produced in the worker it is connected to - a Redis pub/sub fan-out would be
needed then (not implemented; see README "Live staff events").

The ``overview`` event ({questions_today, unanswered_today, open_gaps}) is recomputed for
tenants marked dirty (chat messages, chat events, gaps) at most every REALTIME_OVERVIEW_SECONDS
and only pushed when the counts changed.
"""
import asyncio
import json
import threading
import time
from datetime import datetime, time as dtime, timezone
from typing import Any, AsyncIterator, Callable, Dict, Iterable, Iterator, Optional, Set

from fastapi.encoders import jsonable_encoder

from app.config import settings
from app.utils.logging import logger

PLATFORM_EVENTS = ("staff", "keys")
OVERVIEW_EVENTS = ("conversation", "gap")


def sse(event: str, data: Any) -> str:
    """One SSE frame: ``event: <name>\\ndata: <one-line JSON>\\n\\n``."""
    payload = json.dumps(jsonable_encoder(data), separators=(",", ":"), ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n"


PING = ": ping\n\n"


def _rank(role: Optional[str]) -> int:
    from app import staff as staff_mod
    return staff_mod.rank(role)


class Subscriber:
    def __init__(self, tenant_id: str, user_id: int, role: Optional[str], is_platform_admin: bool,
                 maxsize: int):
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.role = role
        self.is_platform_admin = is_platform_admin
        self.queue: "asyncio.Queue[str]" = asyncio.Queue(maxsize=maxsize)
        self.dropped = 0

    def offer(self, frame: str) -> None:
        try:
            self.queue.put_nowait(frame)
        except asyncio.QueueFull:
            self.dropped += 1
            if self.dropped == 1 or self.dropped % 100 == 0:
                logger.warning(f"Realtime: slow consumer (user {self.user_id}, tenant {self.tenant_id}); "
                               f"{self.dropped} event(s) dropped")


class Broker:
    def __init__(self) -> None:
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._subs: Dict[str, Set[Subscriber]] = {}
        self._platform: Set[Subscriber] = set()
        self._dirty: Set[str] = set()
        self._overview_sent: Dict[str, Any] = {}  # tenant -> (monotonic time, counts)
        self._task: Optional[asyncio.Task] = None

    # -- lifecycle -------------------------------------------------------------------------
    def start(self) -> None:
        """Capture the running loop (call from the app lifespan) and start the overview task."""
        self._loop = asyncio.get_running_loop()
        self._task = self._loop.create_task(self._overview_loop())

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
        self._task = None
        self._loop = None
        self._subs.clear()
        self._platform.clear()

    # -- subscriptions (event-loop thread only) --------------------------------------------
    def subscribe(self, tenant_id: str, user_id: int, role: Optional[str], is_platform_admin: bool) -> Subscriber:
        sub = Subscriber(tenant_id, user_id, role, is_platform_admin, max(settings.REALTIME_QUEUE_SIZE, 1))
        self._subs.setdefault(tenant_id, set()).add(sub)
        if is_platform_admin:
            self._platform.add(sub)
        return sub

    def unsubscribe(self, sub: Subscriber) -> None:
        subs = self._subs.get(sub.tenant_id)
        if subs is not None:
            subs.discard(sub)
            if not subs:
                self._subs.pop(sub.tenant_id, None)
                self._overview_sent.pop(sub.tenant_id, None)
                self._dirty.discard(sub.tenant_id)
        self._platform.discard(sub)

    def subscriber_count(self, tenant_id: Optional[str] = None) -> int:
        if tenant_id is None:
            return sum(len(s) for s in self._subs.values())
        return len(self._subs.get(tenant_id, ()))

    def has_subscribers(self, tenant_id: Optional[str], platform: bool = False) -> bool:
        if self._loop is None:
            return False
        return bool(self._subs.get(tenant_id)) or (platform and bool(self._platform))

    # -- publishing (any thread) -----------------------------------------------------------
    def publish(self, tenant_id: Optional[str], event: str, data: Any, user_id: Optional[int] = None,
                min_role: Optional[str] = None) -> None:
        """Never raises."""
        try:
            platform = event in PLATFORM_EVENTS
            if event in OVERVIEW_EVENTS and tenant_id:
                self.touch_overview(tenant_id)
            if not tenant_id or not self.has_subscribers(tenant_id, platform):
                return
            frame = sse(event, data)
            min_rank = _rank(min_role) if min_role else None
            self._call(self._deliver, tenant_id, frame, user_id, min_rank, platform)
        except Exception as e:
            logger.warning(f"Realtime publish of {event!r} failed: {e}")

    def touch_overview(self, tenant_id: Optional[str]) -> None:
        if tenant_id and self._loop is not None:
            self._call(self._dirty.add, tenant_id)

    def _call(self, fn: Callable, *args) -> None:
        loop = self._loop
        if loop is None or loop.is_closed():
            return
        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None
        if running is loop:
            fn(*args)
        else:
            try:
                loop.call_soon_threadsafe(fn, *args)
            except RuntimeError:  # loop closed meanwhile (shutdown)
                pass

    def _deliver(self, tenant_id: str, frame: str, user_id: Optional[int], min_rank: Optional[int],
                 platform: bool) -> None:
        targets = list(self._subs.get(tenant_id, ()))
        if platform:
            targets += [s for s in self._platform if s.tenant_id != tenant_id]
        for sub in targets:
            if user_id is not None and sub.user_id != user_id:
                continue
            if min_rank is not None and not sub.is_platform_admin and _rank(sub.role) < min_rank:
                continue
            sub.offer(frame)

    # -- overview counts -------------------------------------------------------------------
    async def _overview_loop(self) -> None:
        loop = asyncio.get_running_loop()
        while True:
            await asyncio.sleep(min(2.0, max(settings.REALTIME_OVERVIEW_SECONDS / 2, 0.2)))
            now = time.monotonic()
            for tenant_id in list(self._dirty):
                if not self._subs.get(tenant_id):
                    self._dirty.discard(tenant_id)
                    continue
                last = self._overview_sent.get(tenant_id)
                if last is not None and now - last[0] < settings.REALTIME_OVERVIEW_SECONDS:
                    continue
                self._dirty.discard(tenant_id)
                try:
                    counts = await loop.run_in_executor(None, overview_counts, tenant_id)
                except Exception as e:
                    logger.warning(f"Realtime overview for {tenant_id} failed: {e}")
                    continue
                if last is not None and last[1] == counts:
                    continue
                self._overview_sent[tenant_id] = (time.monotonic(), counts)
                self._deliver(tenant_id, sse("overview", counts), None, None, False)

    def remember_overview(self, tenant_id: str, counts: Dict[str, int]) -> None:
        """The counts a new subscriber was just sent (don't re-push identical ones)."""
        if tenant_id not in self._overview_sent:
            self._overview_sent[tenant_id] = (time.monotonic(), counts)


def overview_counts(tenant_id: str) -> Dict[str, int]:
    """Today's (UTC) questions / unanswered questions and the open gaps of a tenant. Same
    definitions as GET /api/reports/overview."""
    from sqlalchemy import func
    from app.db.models import ChatEvent, ChatMessage, KnowledgeGap
    from app.db.session import SessionLocal

    start = datetime.combine(datetime.now(timezone.utc).date(), dtime.min, tzinfo=timezone.utc)
    db = SessionLocal()
    try:
        questions = db.query(func.count(ChatMessage.id)).filter(
            ChatMessage.tenant_id == tenant_id, ChatMessage.role == "user",
            ChatMessage.created_at >= start).scalar() or 0
        unanswered = db.query(func.count(ChatEvent.id)).filter(
            ChatEvent.tenant_id == tenant_id, ChatEvent.answered.is_(False),
            ChatEvent.created_at >= start).scalar() or 0
        open_gaps = db.query(func.count(KnowledgeGap.id)).filter(
            KnowledgeGap.tenant_id == tenant_id, KnowledgeGap.status == "open").scalar() or 0
        return {"questions_today": int(questions), "unanswered_today": int(unanswered), "open_gaps": int(open_gaps)}
    finally:
        db.close()


broker = Broker()


def publish(tenant_id: Optional[str], event: str, data: Any, user_id: Optional[int] = None,
            min_role: Optional[str] = None) -> None:
    broker.publish(tenant_id, event, data, user_id=user_id, min_role=min_role)


# ---------------------------------------------------------------------------
# typed publish helpers (payload shapes of the realtime contract)
# ---------------------------------------------------------------------------

def publish_message(tenant_id: str, session_id: str, title: Optional[str], user_name: Optional[str],
                    user_role: Optional[str], role: str, content: Optional[str], message_id: Optional[int],
                    created_at: Any = None) -> None:
    if not broker.has_subscribers(tenant_id):
        broker.touch_overview(tenant_id)
        return
    publish(tenant_id, "conversation", {
        "action": "message",
        "session_id": session_id,
        "title": title,
        "user_name": user_name,
        "user_role": user_role,
        "role": role,
        "preview": " ".join((content or "").split())[:140],
        "created_at": created_at or datetime.now(timezone.utc),
        "message_id": message_id,  # additive
    })


def publish_gap(gap, action: str) -> None:
    if not broker.has_subscribers(gap.tenant_id):
        broker.touch_overview(gap.tenant_id)
        return
    from app.gaps import gap_to_dict
    publish(gap.tenant_id, "gap", {"action": action, "gap": gap_to_dict(gap)})


def publish_training(source) -> None:
    if not broker.has_subscribers(source.tenant_id):
        return
    from app.training.service import source_to_dict
    publish(source.tenant_id, "training", {"action": "status", "source": source_to_dict(source)})


def publish_staff(user, action: str, tenant_id: Optional[str] = None) -> None:
    from app import staff as staff_mod
    tenant_id = tenant_id or user.tenant_id
    if not broker.has_subscribers(tenant_id, platform=True):
        return
    data = staff_mod.to_dict(user) if not isinstance(user, dict) else user
    publish(tenant_id, "staff", {"action": action, "user": data}, min_role="admin")


def key_public_dict(record) -> Dict[str, Any]:
    """An API key as GET /api/keys lists it (plus tenant_id) - never the raw key or its hash."""
    from app import apikeys
    d = apikeys.key_to_dict(record)
    return {k: d[k] for k in ("id", "tenant_id", "name", "key_type", "key_prefix", "is_active", "created_at",
                              "last_used", "expires_at", "expired")}


def publish_key(record, action: str) -> None:
    if not broker.has_subscribers(record.tenant_id, platform=True):
        return
    publish(record.tenant_id, "keys", {"action": action, "key": key_public_dict(record)}, min_role="admin")


# ---------------------------------------------------------------------------
# sync iterator -> async generator bridge
# ---------------------------------------------------------------------------

HEARTBEAT = object()


async def iterate_in_thread(make_iter: Callable[[], Iterable[Any]],
                            heartbeat: Optional[float] = None) -> AsyncIterator[Any]:
    """Run a blocking iterator in a worker thread and yield its items on the event loop.

    Exceptions raised by the iterator are re-raised here. With ``heartbeat`` seconds, the
    ``HEARTBEAT`` sentinel is yielded whenever no item arrived for that long (SSE pings).
    When the consumer stops early (client disconnect / cancellation) the worker is told to
    stop and the iterator is closed at its next item (closing e.g. the HTTP stream to Ollama).
    """
    loop = asyncio.get_running_loop()
    queue: "asyncio.Queue" = asyncio.Queue()
    stop = threading.Event()

    def put(kind, value=None):
        try:
            loop.call_soon_threadsafe(queue.put_nowait, (kind, value))
        except RuntimeError:  # loop closed
            pass

    def worker():
        try:
            it: Iterator = iter(make_iter())
            try:
                for item in it:
                    if stop.is_set():
                        break
                    put("item", item)
            finally:
                close = getattr(it, "close", None)
                if close is not None:
                    close()
        except BaseException as e:  # noqa: BLE001 - re-raised in the consumer
            put("error", e)
        else:
            put("done")

    loop.run_in_executor(None, worker)
    try:
        while True:
            try:
                if heartbeat:
                    kind, value = await asyncio.wait_for(queue.get(), timeout=heartbeat)
                else:
                    kind, value = await queue.get()
            except asyncio.TimeoutError:
                yield HEARTBEAT
                continue
            if kind == "item":
                yield value
            elif kind == "error":
                raise value
            else:
                return
    finally:
        stop.set()
