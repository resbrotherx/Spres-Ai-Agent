"""Knowledge gaps: detect questions the bot couldn't answer, group them, notify staff.

Detection (``detect_gap``) runs synchronously in /api/chat on the graph result (cheap, no I/O);
recording (``record_chat_outcome`` / ``record_feedback``) runs in a BackgroundTask with its own
DB session so the chat response isn't delayed.

Reasons, in priority order:
  llm_unavailable   the LLM fallback text was returned
  no_context        retrieval returned no documents for the user's audiences
  llm_unknown       the answer says it doesn't know (prompt asks for UNKNOWN_ANSWER_PREFIX)
  low_confidence    best cosine distance > tenant gap_distance_threshold
  negative_feedback a thumbs-down from POST /api/chat/feedback

Grouping: per tenant by normalized question (lowercase, punctuation stripped, whitespace
collapsed). A repeat bumps ``occurrences`` / ``last_seen_at`` and keeps the status, except that
negative feedback re-opens a resolved gap. Notifications go out only for a gap's first
occurrence and for every negative feedback.
"""
import re
import unicodedata
from typing import Any, Dict, List, Optional, Sequence, Tuple

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import ChatEvent, KnowledgeGap
from app.utils.hashing import create_hash
from app.utils.logging import logger

GAP_REASONS = ("no_context", "low_confidence", "llm_unknown", "llm_unavailable", "negative_feedback")
GAP_STATUSES = ("open", "resolved", "dismissed")

# The answer-generation prompt asks the model to start "don't know" answers with this phrase.
UNKNOWN_ANSWER_PREFIX = "I don't have that information yet"
_UNKNOWN_PATTERNS = [
    r"\bi (?:do not|don't|dont) have (?:that|this|any|enough|the|specific|relevant)? ?(?:information|info|details|data)\b",
    r"\bi (?:do not|don't|dont) have information\b",
    r"\bi (?:could not|couldn't|cannot|can't|was unable to|am unable to|am not able to) find\b",
    r"\b(?:i'm|i am) (?:not sure|unable to (?:answer|find|help))\b",
    r"\bi (?:do not|don't|dont) know\b",
    r"\b(?:no|not any) (?:relevant )?information (?:about|on|regarding|in the knowledge base)\b",
    r"\b(?:is|was) not (?:found |mentioned |covered |available )?in the (?:knowledge base|context|provided context)\b",
    r"\bthe (?:knowledge base|context|provided context) (?:does not|doesn't) (?:contain|include|mention|cover)\b",
    r"\bnot (?:able|enough information) to answer\b",
]
_UNKNOWN_RE = re.compile("|".join(_UNKNOWN_PATTERNS), re.I)
_UNAVAILABLE_MARKERS = ("ai model service is currently unavailable",)
_STOPWORDS = frozenset(
    "a an the is are was were be been to of in on for and or how do does did i my me you your we our it "
    "this that what when where why which who can could would should will with from at by about please".split()
)


def normalize_question(text: Optional[str]) -> str:
    value = unicodedata.normalize("NFKC", text or "").lower()
    value = re.sub(r"[^\w\s]", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value[:1000]


def question_hash(norm: str) -> str:
    return create_hash(norm)


def answer_says_unknown(answer: Optional[str]) -> bool:
    if not answer:
        return False
    head = answer.replace("’", "'").replace("‘", "'").strip()[:300]
    if head.lower().startswith(UNKNOWN_ANSWER_PREFIX.lower()):
        return True
    return bool(_UNKNOWN_RE.search(head))


def best_distance(search_results: Optional[Sequence[Dict[str, Any]]]) -> Optional[float]:
    distances = []
    for r in search_results or []:
        try:
            distances.append(float(r.get("distance")))
        except (TypeError, ValueError, AttributeError):
            continue
    return min(distances) if distances else None


def detect_gap(
    answer: Optional[str],
    search_results: Optional[Sequence[Dict[str, Any]]],
    reasoning: Optional[str],
    threshold: float,
) -> Tuple[Optional[str], Optional[float]]:
    """(reason or None, best distance)."""
    best = best_distance(search_results)
    lowered = (answer or "").lower()
    if (reasoning or "").lower().startswith("llm unavailable") or any(m in lowered for m in _UNAVAILABLE_MARKERS):
        return "llm_unavailable", best
    if not search_results:
        return "no_context", best
    if answer_says_unknown(answer):
        return "llm_unknown", best
    if best is not None and best > threshold:
        return "low_confidence", best
    return None, best


def similarity(a_norm: str, b_norm: str) -> float:
    """Jaccard similarity of content words (used by "also resolve similar")."""
    a = {w for w in a_norm.split() if w not in _STOPWORDS}
    b = {w for w in b_norm.split() if w not in _STOPWORDS}
    if not a or not b:
        return 1.0 if a_norm == b_norm else 0.0
    return len(a & b) / len(a | b)


def gap_to_dict(g: KnowledgeGap) -> Dict[str, Any]:
    return {
        "id": g.id,
        "tenant_id": g.tenant_id,
        "question": g.question,
        "reason": g.reason,
        "status": g.status,
        "occurrences": g.occurrences or 1,
        "best_distance": g.best_distance,
        "answer_given": g.answer_given,
        "session_id": g.session_id,
        "user_id": g.user_id,
        "user_name": g.user_name,
        "user_role": g.user_role,
        "resolution_note": g.resolution_note,
        "resolved_by": g.resolved_by_name,
        "resolved_at": g.resolved_at,
        "source_id": g.source_id,
        "created_at": g.created_at,
        "last_seen_at": g.last_seen_at,
        # additive
        "last_feedback_comment": g.last_feedback_comment,
    }


def upsert_gap(
    db: Session,
    tenant_id: str,
    question: str,
    reason: str,
    *,
    distance: Optional[float] = None,
    answer: Optional[str] = None,
    session_id: Optional[str] = None,
    user_id: Optional[str] = None,
    user_name: Optional[str] = None,
    user_role: Optional[str] = None,
    reopen: bool = False,
    feedback_comment: Optional[str] = None,
) -> Tuple[KnowledgeGap, bool]:
    """Create the gap or bump the existing one for the same normalized question. (gap, created)."""
    from app.staff import utcnow

    norm = normalize_question(question) or question.strip().lower()[:1000]
    digest = question_hash(norm)
    now = utcnow()
    for attempt in range(2):
        gap = db.query(KnowledgeGap).filter(
            KnowledgeGap.tenant_id == tenant_id, KnowledgeGap.question_hash == digest).first()
        if gap is not None:
            gap.occurrences = (gap.occurrences or 1) + 1
            gap.last_seen_at = now
            if answer is not None:
                gap.answer_given = answer
            if distance is not None:
                gap.best_distance = distance
            if session_id:
                gap.session_id, gap.user_id, gap.user_name, gap.user_role = session_id, user_id, user_name, user_role
            if feedback_comment:
                gap.last_feedback_comment = feedback_comment
            if reopen and gap.status == "resolved":
                gap.status = "open"
                gap.resolved_at = None
            db.commit()
            return gap, False
        gap = KnowledgeGap(
            tenant_id=tenant_id, question=question.strip()[:4000], question_norm=norm, question_hash=digest,
            reason=reason, status="open", occurrences=1, best_distance=distance, answer_given=answer,
            session_id=session_id, user_id=user_id, user_name=user_name, user_role=user_role,
            last_feedback_comment=feedback_comment, created_at=now, last_seen_at=now,
        )
        db.add(gap)
        try:
            db.commit()
            db.refresh(gap)
            return gap, True
        except IntegrityError:  # concurrent insert of the same question: bump it instead
            db.rollback()
            if attempt:
                raise
    raise RuntimeError("unreachable")


def _short(text: Optional[str], n: int) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= n else text[: n - 1] + "…"


_REASON_LABEL = {
    "no_context": "no matching knowledge",
    "low_confidence": "low-confidence match",
    "llm_unknown": "the assistant didn't know",
    "llm_unavailable": "the AI model was unavailable",
    "negative_feedback": "negative feedback",
}


def notify_new_gap(db: Session, gap: KnowledgeGap) -> None:
    from app.notify.service import notify_staff
    from app.tenant_settings import get_settings

    cfg = get_settings(db, gap.tenant_id)
    who = gap.user_name or gap.user_role or "a user"
    notify_staff(
        db, gap.tenant_id, "gap",
        title="New unanswered question",
        body=f"{_short(gap.question, 200)} ({_REASON_LABEL.get(gap.reason, gap.reason)}; asked by {who})",
        link=f"#/gaps/{gap.id}",
        email=cfg["notify_on_gap"],
        email_lines=[f"Question: {_short(gap.question, 500)}",
                     f"Reason: {_REASON_LABEL.get(gap.reason, gap.reason)}",
                     f"Asked by: {who}"],
        cta_text="Answer it in the dashboard",
        max_per_hour=cfg["email_max_per_hour"],
    )


def notify_feedback(db: Session, gap: KnowledgeGap, comment: Optional[str]) -> None:
    from app.notify.service import notify_staff
    from app.tenant_settings import get_settings

    cfg = get_settings(db, gap.tenant_id)
    lines = [f"Question: {_short(gap.question, 500)}", f"Answer given: {_short(gap.answer_given, 500)}"]
    if comment:
        lines.append(f"Comment: {_short(comment, 500)}")
    body = f"A user marked an answer as unhelpful: {_short(gap.question, 200)}"
    if comment:
        body += f" — “{_short(comment, 160)}”"
    notify_staff(
        db, gap.tenant_id, "feedback",
        title="Negative feedback on an answer",
        body=body,
        link=f"#/gaps/{gap.id}",
        email=cfg["notify_on_feedback"],
        email_lines=lines,
        cta_text="Review it in the dashboard",
        max_per_hour=cfg["email_max_per_hour"],
    )


def record_chat_outcome(
    tenant_id: str,
    question: str,
    answer: Optional[str],
    reason: Optional[str],
    distance: Optional[float],
    session_id: Optional[str] = None,
    message_id: Optional[int] = None,
    user_id: Optional[str] = None,
    user_name: Optional[str] = None,
    user_role: Optional[str] = None,
    cached: bool = False,
) -> None:
    """BackgroundTask: write the chat_event and record/notify the gap. Never raises."""
    from app.db.session import SessionLocal
    from app.staff import utcnow

    db = SessionLocal()
    try:
        db.add(ChatEvent(
            tenant_id=tenant_id, session_id=session_id, message_id=message_id, user_role=user_role,
            question=(question or "")[:2000], question_norm=normalize_question(question)[:500],
            answered=reason is None, gap_reason=reason, cached=cached, created_at=utcnow(),
        ))
        db.commit()
        if reason is None:
            return
        gap, created = upsert_gap(
            db, tenant_id, question, reason, distance=distance, answer=answer, session_id=session_id,
            user_id=user_id, user_name=user_name, user_role=user_role,
        )
        if created:
            logger.info(f"Knowledge gap #{gap.id} ({reason}) for tenant {tenant_id}")
            notify_new_gap(db, gap)
    except Exception as e:
        db.rollback()
        logger.error(f"Recording chat outcome failed: {e}", exc_info=True)
    finally:
        db.close()


def record_feedback_gap(
    tenant_id: str,
    question: str,
    answer: Optional[str],
    feedback_id: int,
    comment: Optional[str],
    session_id: Optional[str],
    user_id: Optional[str],
    user_name: Optional[str],
    user_role: Optional[str],
) -> None:
    """BackgroundTask for a thumbs-down: create/bump a negative_feedback gap and notify staff."""
    from app.db.models import ChatFeedback
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        gap, _ = upsert_gap(
            db, tenant_id, question, "negative_feedback", answer=answer, session_id=session_id,
            user_id=user_id, user_name=user_name, user_role=user_role, reopen=True,
            feedback_comment=(comment or None),
        )
        fb = db.query(ChatFeedback).filter(ChatFeedback.id == feedback_id).first()
        if fb is not None:
            fb.gap_id = gap.id
            db.commit()
        notify_feedback(db, gap, comment)
    except Exception as e:
        db.rollback()
        logger.error(f"Recording feedback gap failed: {e}", exc_info=True)
    finally:
        db.close()


def resolve_similar(db: Session, gap: KnowledgeGap, threshold: float = 0.6, limit: int = 1000) -> List[KnowledgeGap]:
    """Other open gaps of the tenant whose question is similar to ``gap``'s."""
    others = db.query(KnowledgeGap).filter(
        KnowledgeGap.tenant_id == gap.tenant_id,
        KnowledgeGap.status == "open",
        KnowledgeGap.id != gap.id,
    ).order_by(KnowledgeGap.last_seen_at.desc()).limit(limit).all()
    return [g for g in others if similarity(gap.question_norm, g.question_norm) >= threshold]
