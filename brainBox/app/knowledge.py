"""Audience labelling of the knowledge base ("who may see this?").

Documents ingested before audiences existed have ``audience = NULL`` and are served as
``LEGACY_DOC_AUDIENCE``. This module reads each such chunk and assigns the narrowest sensible
audience — public | customer | vendor | internal | admin — using keyword rules first and, for
chunks the rules can't settle, the local Ollama model (nothing leaves the server).

Every automatic label is recorded with ``audience_origin = "auto"`` and a short reason, so staff
can review them in the dashboard and :func:`reset_auto_labels` can undo a run completely.
Labels set by staff (``"staff"``) or inherited from a training source (``"source"``) are never
overwritten.
"""
import re
import threading
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from sqlalchemy import or_

from app.config import settings
from app.db.models import Document
from app.db.session import SessionLocal
from app.permissions import AUDIENCES
from app.utils.logging import logger

ORIGIN_AUTO = "auto"
ORIGIN_STAFF = "staff"
ORIGIN_SOURCE = "source"

# (audience, weight, pattern). Higher audiences win ties: a chunk that mentions a password is
# admin-only even if it also looks like a public FAQ.
_RULES: List[Tuple[str, int, str]] = [
    ("admin", 5, r"\bpass(?:word|wd|phrase)s?\b|\bsecret(?:s| key)?\b|\bapi[ _-]?keys?\b|\bprivate key\b|\bcredentials?\b"
                 r"|\baccess token\b|\bssh\b|\broot (?:user|access|login)\b|\bsk_live_|\bbank account\b|\biban\b"
                 r"|\bswift code\b|\brouting number\b|\bsalar(?:y|ies)\b|\bpayroll\b|\bsocial security\b|\bssn\b"
                 r"|\bnational id\b|\bconfidential\b|\badmin(?:istrator)? only\b|\bstrictly private\b"),
    ("internal", 3, r"\binternal(?: only| use| note| procedure| policy)?\b|\bemployees?\b|\bstaff only\b|\bstaff member"
                    r"|\bsop\b|\bstandard operating procedure\b|\bescalat(?:e|ion)\b|\bprofit margin\b|\bmargins?\b"
                    r"|\bcost price\b|\bcommission\b|\bhr\b|\bhuman resources\b|\bonboarding (?:of )?(?:new )?staff\b"
                    r"|\bdo not share\b|\bnot for customers\b|\bteam lead\b|\bshift schedule\b|\bperformance review\b"),
    ("vendor", 3, r"\bvendors?\b|\bsuppliers?\b|\bpurchase orders?\b|\bp\.?o\.? number\b|\bprocurement\b|\brfq\b"
                  r"|\brequest for quotation\b|\bvendor bills?\b|\bsupplier invoices?\b|\bdropship"),
    ("customer", 2, r"\byour (?:account|order|invoice|subscription|plan|bill|ticket|payment|meter|balance)\b"
                    r"|\bmy (?:account|order|invoice|subscription|bill|ticket|balance)\b|\border (?:status|number)\b"
                    r"|\binvoices?\b|\brefunds?\b|\bcustomer portal\b|\bsupport ticket\b|\btracking number\b"
                    r"|\boutstanding balance\b|\bdue date\b|\bcustomer id\b|\baccount number\b"),
    ("public", 1, r"\bfaq\b|\bfrequently asked\b|\babout us\b|\bcontact us\b|\bopening hours\b|\bbusiness hours\b"
                  r"|\bpricing\b|\bprices?\b|\bfeatures?\b|\bproducts?\b|\bservices?\b|\bhow (?:do|can|to)\b"
                  r"|\bgetting started\b|\bwelcome\b|\bwebsite\b|\blocation\b|\baddress\b"),
]
_COMPILED = [(aud, w, re.compile(p, re.IGNORECASE)) for aud, w, p in _RULES]
_RANK = {"public": 0, "customer": 1, "vendor": 1, "internal": 2, "admin": 3}

_PROMPT = """You label company knowledge for an AI assistant. Decide who may read the text below.
Answer with exactly one word from this list:
public   - general information anyone may see (products, prices, FAQs, contact details, how-to guides)
customer - information for existing customers about their own accounts, orders, invoices or support
vendor   - information for suppliers and vendors (purchase orders, supplier terms, deliveries to us)
internal - for the company's staff only (internal procedures, employee matters, costs, margins)
admin    - highly sensitive (passwords, keys, credentials, salaries, bank details, personal data)

Text:
\"\"\"{text}\"\"\"

Answer (one word):"""


def rule_label(text: str) -> Tuple[Optional[str], int, str]:
    """(audience, confidence 0-5, reason) from keyword rules; audience None when nothing matched."""
    scores: Dict[str, int] = {}
    hits: Dict[str, List[str]] = {}
    for aud, weight, rx in _COMPILED:
        found = {m.group(0).lower() for m in rx.finditer(text or "")}
        if found:
            scores[aud] = weight * len(found)
            hits[aud] = sorted(found)[:4]
    if not scores:
        return None, 0, ""
    # Sensitive content always wins: one strong admin hit is enough.
    if "admin" in scores:
        return "admin", 5, "mentions " + ", ".join(hits["admin"])
    best = max(scores, key=lambda a: (scores[a], _RANK[a]))
    confidence = 4 if scores[best] >= 6 else 3 if scores[best] >= 3 else 1
    return best, confidence, "mentions " + ", ".join(hits[best])


def ai_label(text: str) -> Optional[str]:
    """Ask the local Ollama model; None when it is unavailable or answers off-list."""
    try:
        from app.llm.ollama_client import ask_ollama_sync
        answer = ask_ollama_sync(_PROMPT.format(text=(text or "")[:1200].replace('"""', "'''")))
    except Exception as e:  # noqa: BLE001 — the model is optional here
        logger.warning(f"knowledge: AI labelling unavailable: {e}")
        return None
    for word in re.findall(r"[a-z]+", (answer or "").lower())[:6]:
        if word in AUDIENCES:
            return word
    return None


def classify_text(text: str, use_ai: bool = True) -> Tuple[str, str]:
    """(audience, reason) for one chunk. Unclear general text stays public (today's behaviour)."""
    aud, confidence, reason = rule_label(text)
    if aud and confidence >= 3:
        return aud, reason
    if use_ai:
        guess = ai_label(text)
        if guess:
            # Rules can only make the AI's answer stricter, never more open.
            if aud and _RANK[aud] > _RANK[guess]:
                return aud, reason
            return guess, "AI review" + (f" ({reason})" if reason else "")
    if aud:
        return aud, reason
    return "public", "general information (no sensitive terms found)"


# ---------------------------------------------------------------------------
# background labelling job (one per tenant; single API worker)
# ---------------------------------------------------------------------------

_jobs: Dict[str, dict] = {}
_lock = threading.Lock()


def job_status(tenant_id: str) -> dict:
    with _lock:
        job = dict(_jobs.get(tenant_id) or {"state": "idle"})
    return job


def _pending_filter(query, scope: str):
    if scope == "auto":  # re-label earlier automatic labels too
        return query.filter(or_(Document.audience.is_(None), Document.audience_origin == ORIGIN_AUTO))
    return query.filter(Document.audience.is_(None))


def count_pending(db, tenant_id: str, scope: str = "unlabelled") -> int:
    return _pending_filter(db.query(Document.id).filter(Document.tenant_id == tenant_id), scope).count()


def start_job(tenant_id: str, scope: str = "unlabelled", use_ai: bool = True, started_by: Optional[str] = None) -> dict:
    with _lock:
        current = _jobs.get(tenant_id)
        if current and current.get("state") == "running":
            return dict(current)
        job = {"state": "running", "scope": scope, "use_ai": use_ai, "done": 0, "total": 0,
               "counts": {a: 0 for a in AUDIENCES}, "started_at": datetime.now(timezone.utc).isoformat(),
               "finished_at": None, "started_by": started_by, "error": None}
        _jobs[tenant_id] = job
    threading.Thread(target=_run_job, args=(tenant_id, scope, use_ai), name=f"label-{tenant_id[:8]}",
                     daemon=True).start()
    return dict(job)


def _publish(tenant_id: str, action: str) -> None:
    try:
        from app import realtime
        realtime.publish(tenant_id, "knowledge", {"action": action, "job": job_status(tenant_id)}, min_role="viewer")
    except Exception:  # noqa: BLE001 — realtime is best effort
        pass


def _run_job(tenant_id: str, scope: str, use_ai: bool) -> None:
    db = SessionLocal()
    try:
        ids = [i for (i,) in _pending_filter(
            db.query(Document.id).filter(Document.tenant_id == tenant_id), scope).order_by(Document.id).all()]
        with _lock:
            _jobs[tenant_id]["total"] = len(ids)
        _publish(tenant_id, "started")
        last_pub = time.time()
        for doc_id in ids:
            doc = db.query(Document).filter(Document.id == doc_id, Document.tenant_id == tenant_id).first()
            if doc is None or doc.audience_origin in (ORIGIN_STAFF, ORIGIN_SOURCE):
                continue
            if scope != "auto" and doc.audience is not None:
                continue
            audience, reason = classify_text(doc.content or "", use_ai=use_ai)
            doc.audience = audience
            doc.audience_origin = ORIGIN_AUTO
            doc.audience_reason = reason[:240]
            db.commit()
            with _lock:
                job = _jobs[tenant_id]
                job["done"] += 1
                job["counts"][audience] = job["counts"].get(audience, 0) + 1
            if time.time() - last_pub > 1.5:
                _publish(tenant_id, "progress")
                last_pub = time.time()
            if use_ai:
                time.sleep(settings.KNOWLEDGE_LABEL_PAUSE_S)  # leave the model free for live chats
        with _lock:
            _jobs[tenant_id].update(state="done", finished_at=datetime.now(timezone.utc).isoformat())
        _clear_answers(tenant_id)
        logger.info(f"knowledge: labelled {len(ids)} chunk(s) for tenant {tenant_id[:8]}…: {job_status(tenant_id)['counts']}")
    except Exception as e:  # noqa: BLE001
        db.rollback()
        logger.exception(f"knowledge: labelling failed for tenant {tenant_id[:8]}…")
        with _lock:
            _jobs[tenant_id].update(state="failed", error=str(e)[:300],
                                    finished_at=datetime.now(timezone.utc).isoformat())
    finally:
        db.close()
        _publish(tenant_id, "finished")


def _clear_answers(tenant_id: str) -> None:
    """Cached answers were produced under the old labels; drop them."""
    try:
        from app.redis_cache.cache import clear_tenant_cache
        clear_tenant_cache(tenant_id)
    except Exception:  # noqa: BLE001
        pass


def set_audience(db, tenant_id: str, ids: List[int], audience: str) -> int:
    """Staff decision for one or more chunks (locks them against automatic relabelling)."""
    n = db.query(Document).filter(Document.tenant_id == tenant_id, Document.id.in_(ids)).update(
        {Document.audience: audience, Document.audience_origin: ORIGIN_STAFF, Document.audience_reason: None},
        synchronize_session=False)
    db.commit()
    _clear_answers(tenant_id)
    return n


def reset_auto_labels(db, tenant_id: str) -> int:
    """Undo automatic labelling: those chunks go back to NULL (served as LEGACY_DOC_AUDIENCE)."""
    n = db.query(Document).filter(Document.tenant_id == tenant_id, Document.audience_origin == ORIGIN_AUTO).update(
        {Document.audience: None, Document.audience_origin: None, Document.audience_reason: None},
        synchronize_session=False)
    db.commit()
    _clear_answers(tenant_id)
    return n


def label_legacy_on_startup() -> None:
    """Label every tenant's unlabelled (legacy) chunks once, in the background, after startup."""
    if not settings.KNOWLEDGE_AUTO_LABEL:
        return
    time.sleep(20)  # let the model warm up and the server settle first
    db = SessionLocal()
    try:
        tenants = [t for (t,) in db.query(Document.tenant_id).filter(Document.audience.is_(None)).distinct().all()]
    except Exception as e:  # noqa: BLE001
        logger.warning(f"knowledge: startup labelling skipped: {e}")
        return
    finally:
        db.close()
    for tenant_id in tenants:
        logger.info(f"knowledge: labelling legacy chunks for tenant {tenant_id[:8]}…")
        start_job(tenant_id, "unlabelled", use_ai=settings.KNOWLEDGE_LABEL_USE_AI, started_by="startup")
        # one tenant at a time: wait for this job before the next
        while job_status(tenant_id).get("state") == "running":
            time.sleep(2)
