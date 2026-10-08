"""Record discovery and normalization (support tickets / generic API records).

A "record" is one JSON object from an API response, a JSON file, a CSV row or
an XML element. Normalizers turn records into knowledge items:
``{"key": <stable record id or None>, "title": str, "text": str, "metadata": dict}``.
"""
import html
import json
import re
from typing import Any, Dict, Iterable, List, Optional, Tuple

from app.chunkers.text import chunk_text

TICKET_MAX_CHARS = 2000

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _norm(key: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(key).lower())


_HTML_TAG_RE = re.compile(r"<[a-zA-Z/!][^>]*>")
_BLOCK_TAG_RE = re.compile(r"<\s*(br|/p|/div|/li|/tr|/h[1-6]|p|li)\b[^>]*>", re.I)


def strip_html(value: str) -> str:
    if not _HTML_TAG_RE.search(value):
        return value.strip()
    value = re.sub(r"<(script|style)\b.*?</\1>", " ", value, flags=re.I | re.S)
    value = _BLOCK_TAG_RE.sub("\n", value)
    value = _HTML_TAG_RE.sub("", value)
    value = html.unescape(value)
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n\s*\n+", "\n", value)
    return value.strip()


_TEXTISH_KEYS = ["body", "text", "plainbody", "bodytext", "message", "content", "value",
                 "htmlbody", "description", "comment", "note", "name", "title", "label"]


def to_text(value: Any, _depth: int = 0) -> str:
    """Render any JSON value as readable text."""
    if value is None or _depth > 6:
        return ""
    if isinstance(value, bool):
        return "yes" if value else "no"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        return strip_html(value)
    if isinstance(value, list):
        parts = [to_text(v, _depth + 1) for v in value]
        parts = [p for p in parts if p]
        if all(not isinstance(v, (dict, list)) for v in value):
            return ", ".join(parts)
        return "\n".join(parts)
    if isinstance(value, dict):
        lookup = {_norm(k): k for k in value}
        for cand in _TEXTISH_KEYS:
            if cand in lookup:
                txt = to_text(value[lookup[cand]], _depth + 1)
                if txt:
                    return txt
        parts = []
        for k, v in value.items():
            txt = to_text(v, _depth + 1)
            if txt:
                parts.append(f"{k}: {txt}")
        return ", ".join(parts)
    return str(value)


def get_path(obj: Any, path: Optional[str]) -> Any:
    """Resolve a dot path (``data.tickets``, ``items.0.body``); keys match case-insensitively."""
    if not path:
        return obj
    current = obj
    for part in str(path).split("."):
        if part == "":
            continue
        if isinstance(current, list):
            try:
                current = current[int(part)]
                continue
            except (ValueError, IndexError):
                return None
        if not isinstance(current, dict):
            return None
        if part in current:
            current = current[part]
            continue
        wanted = _norm(part)
        match = next((k for k in current if _norm(k) == wanted), None)
        if match is None:
            return None
        current = current[match]
    return current


def _find_key(record: dict, candidates: Iterable[str], exclude: Iterable[str] = ()) -> Optional[str]:
    """Find a (possibly one-level nested) key whose normalized name is in candidates (in priority order).

    Returns a dot path usable with get_path.
    """
    excl = {_norm(e) for e in exclude}
    lookup: Dict[str, str] = {}
    for k in record:
        lookup.setdefault(_norm(k), k)
    for cand in candidates:
        k = lookup.get(cand)
        if k is not None and _norm(k) not in excl and _has_value(record[k]):
            return str(k)
    # one level deep (e.g. Jira "fields.summary")
    for parent, sub in record.items():
        if isinstance(sub, dict) and _norm(parent) not in excl:
            sub_lookup = {}
            for k in sub:
                sub_lookup.setdefault(_norm(k), k)
            for cand in candidates:
                k = sub_lookup.get(cand)
                if k is not None and _has_value(sub[k]):
                    return f"{parent}.{k}"
    return None


def _has_value(v: Any) -> bool:
    if v is None:
        return False
    if isinstance(v, (str, list, dict)):
        return len(v) > 0 if not isinstance(v, str) else bool(v.strip())
    return True


# ---------------------------------------------------------------------------
# record discovery
# ---------------------------------------------------------------------------

_LIST_KEYS = ["data", "results", "items", "tickets", "records", "rows", "entries", "objects",
              "value", "hits", "conversations", "requests", "issues", "cases", "list",
              "response", "payload", "content", "nodes", "edges", "messages"]


def find_records(data: Any, data_path: Optional[str] = None) -> Tuple[List[Any], Optional[str]]:
    """Return (records, path_used). Auto-detects the list of records when data_path is empty."""
    if data_path:
        found = get_path(data, data_path)
        if found is None:
            raise ValueError(f"data_path '{data_path}' was not found in the response")
        if isinstance(found, dict):
            return [found], data_path
        if not isinstance(found, list):
            raise ValueError(f"data_path '{data_path}' does not point to a list of records")
        return found, data_path

    if isinstance(data, list):
        return data, ""
    if not isinstance(data, dict):
        return [], None

    def search(obj: dict, prefix: str, depth: int) -> Tuple[Optional[list], Optional[str]]:
        lookup = {}
        for k in obj:
            lookup.setdefault(_norm(k), k)
        for cand in _LIST_KEYS:
            k = lookup.get(cand)
            if k is None:
                continue
            v = obj[k]
            path = f"{prefix}{k}"
            if isinstance(v, list):
                return v, path
            if isinstance(v, dict) and depth < 2:
                found, p = search(v, path + ".", depth + 1)
                if found is not None:
                    return found, p
        # any list of objects under this dict
        for k, v in obj.items():
            if isinstance(v, list) and v and all(isinstance(i, dict) for i in v[:5]):
                return v, f"{prefix}{k}"
        return None, None

    found, path = search(data, "", 0)
    if found is not None:
        return found, path
    # A single object: treat it as one record
    return [data], ""


# ---------------------------------------------------------------------------
# support tickets
# ---------------------------------------------------------------------------

ID_KEYS = ["ticketid", "ticketnumber", "ticketno", "casenumber", "caseid", "id", "number",
           "key", "reference", "ref", "uuid"]
TITLE_KEYS = ["subject", "title", "summary", "topic", "headline", "issuetitle", "name"]
QUESTION_KEYS = ["customerissue", "issue", "question", "problem", "description", "issuedescription",
                 "customermessage", "complaint", "query", "inquiry", "enquiry", "request",
                 "body", "message", "content", "details", "text", "comment"]
ANSWER_KEYS = ["ourresponse", "response", "answer", "reply", "resolution", "solution",
               "agentresponse", "agentreply", "supportresponse", "resolutionnotes", "resolutionnote",
               "responsetext", "answertext", "replytext", "resolutiontext", "finalresponse",
               "workaround", "fix"]
MESSAGES_KEYS = ["messages", "comments", "replies", "conversation", "conversations", "thread",
                 "threads", "interactions", "conversationparts", "posts", "notes"]
DEFAULT_EXTRA_KEYS = ["status", "priority", "category", "type", "tags", "product"]

_MSG_BODY_KEYS = ["body", "text", "message", "content", "plainbody", "bodytext", "htmlbody",
                  "value", "comment", "note", "description"]
_ROLE_KEYS = ["role", "authorrole", "authortype", "sendertype", "usertype", "fromtype", "type",
              "from", "sender", "direction", "source", "createdbytype", "by", "author"]
_AUTHOR_KEYS = ["author", "user", "sender", "from", "createdby", "submitter", "requester"]
_AGENT_TOKENS = {"agent", "agents", "admin", "administrator", "staff", "support", "operator",
                 "assistant", "bot", "team", "employee", "rep", "outbound", "outgoing", "helpdesk",
                 "system", "teammate", "engineer"}
_CUSTOMER_TOKENS = {"customer", "user", "enduser", "client", "requester", "requestor", "contact",
                    "visitor", "lead", "guest", "inbound", "incoming", "end"}


def _role_from_value(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    tokens = set(re.split(r"[^a-z0-9]+", value.lower()))
    if tokens & _AGENT_TOKENS:
        return "agent"
    if tokens & _CUSTOMER_TOKENS:
        return "customer"
    return None


def _role_from_obj(obj: dict, depth: int = 0) -> Optional[str]:
    lookup = {_norm(k): k for k in obj}
    for bkey, role in (("isagent", "agent"), ("fromagent", "agent"), ("isstaff", "agent"),
                       ("isadmin", "agent"), ("agent", "agent"), ("staff", "agent"),
                       ("iscustomer", "customer"), ("customer", "customer"),
                       ("incoming", "customer"), ("private", "agent")):
        k = lookup.get(bkey)
        if k is not None and isinstance(obj[k], bool):
            if obj[k]:
                return role
            if bkey in ("isagent", "fromagent", "isstaff", "agent", "iscustomer", "customer", "incoming"):
                return "customer" if role == "agent" else "agent"
    for rkey in _ROLE_KEYS:
        k = lookup.get(rkey)
        if k is None:
            continue
        v = obj[k]
        if isinstance(v, dict) and depth == 0:
            r = _role_from_obj(v, depth + 1)
        else:
            r = _role_from_value(v)
        if r:
            return r
    if depth == 0:
        for akey in _AUTHOR_KEYS:
            k = lookup.get(akey)
            if k is not None and isinstance(obj[k], dict):
                r = _role_from_obj(obj[k], depth + 1)
                if r:
                    return r
    return None


def _author_identity(msg: dict) -> Optional[str]:
    lookup = {_norm(k): k for k in msg}
    for akey in _AUTHOR_KEYS + ["authorid", "userid", "senderid", "authoremail", "email", "authorname"]:
        k = lookup.get(akey)
        if k is None:
            continue
        v = msg[k]
        if isinstance(v, dict):
            sub = {_norm(x): x for x in v}
            for ik in ("id", "email", "name", "username"):
                if ik in sub and v[sub[ik]] not in (None, ""):
                    return str(v[sub[ik]])
        elif v not in (None, "") and not isinstance(v, list):
            return str(v)
    return None


def render_conversation(messages: Any) -> List[str]:
    if not isinstance(messages, list):
        return []
    lines: List[str] = []
    first_identity = None
    prev_role = None
    seen_first = False
    for msg in messages:
        if isinstance(msg, str):
            body, role, ident = strip_html(msg), None, None
        elif isinstance(msg, dict):
            bkey = _find_key(msg, _MSG_BODY_KEYS)
            body = to_text(get_path(msg, bkey)) if bkey else ""
            role = _role_from_obj(msg)
            ident = _author_identity(msg)
        else:
            continue
        if not body:
            continue
        if not seen_first:
            seen_first = True
            first_identity = ident
        if role is None:
            if prev_role is None:
                role = "customer"  # first message: assume the customer opened the ticket
            elif ident is not None and first_identity is not None:
                role = "customer" if ident == first_identity else "agent"
            else:
                role = "agent" if prev_role == "customer" else "customer"
        prev_role = role
        label = "Customer" if role == "customer" else "Agent"
        lines.append(f"{label}: {body}")
    return lines


def _field(record: dict, explicit: Optional[str], candidates: List[str], exclude=()) -> Tuple[Optional[str], Any]:
    if explicit:
        return explicit, get_path(record, explicit)
    key = _find_key(record, candidates, exclude)
    return key, (get_path(record, key) if key else None)


def is_ticket_like(record: Any) -> bool:
    if not isinstance(record, dict):
        return False
    has_q = _find_key(record, QUESTION_KEYS + TITLE_KEYS[:3]) is not None
    has_a = _find_key(record, ANSWER_KEYS) is not None
    m_key = _find_key(record, MESSAGES_KEYS)
    has_m = m_key is not None and isinstance(get_path(record, m_key), list)
    return (has_q and has_a) or has_m


def looks_like_tickets(records: List[Any]) -> bool:
    sample = [r for r in records[:20] if isinstance(r, dict)]
    if not sample:
        return False
    return sum(1 for r in sample if is_ticket_like(r)) * 2 >= len(sample)


def _split_long(header: str, body: str, max_chars: int) -> List[str]:
    full = f"{header}\n{body}" if body else header
    if len(full) <= max_chars:
        return [full]
    parts = chunk_lines(body.split("\n"), max_chars=max_chars - len(header) - 20)
    n = len(parts)
    return [f"{header} (part {i + 1}/{n})\n{p}" for i, p in enumerate(parts)]


def normalize_ticket(record: dict, mapping: Optional[dict] = None) -> Optional[Dict[str, Any]]:
    mapping = mapping or {}
    if not isinstance(record, dict):
        return None
    used = set()
    id_key, rid = _field(record, mapping.get("id_field"), ID_KEYS)
    title_key, title = _field(record, mapping.get("title_field"), TITLE_KEYS)
    msgs_key, msgs = _field(record, mapping.get("messages_field"), MESSAGES_KEYS)
    if not isinstance(msgs, list):
        msgs_key, msgs = None, None
    ans_key, answer = _field(record, mapping.get("answer_field"), ANSWER_KEYS,
                             exclude=[k for k in (msgs_key,) if k])
    q_exclude = [k for k in (msgs_key, ans_key, title_key, id_key) if k]
    q_key, question = _field(record, mapping.get("question_field"), QUESTION_KEYS, exclude=q_exclude)
    used.update(k for k in (id_key, title_key, msgs_key, ans_key, q_key) if k)

    rid_s = to_text(rid) if rid is not None and not isinstance(rid, (dict, list)) else ""
    title_s = to_text(title).replace("\n", " ").strip() if title is not None else ""
    question_s = to_text(question) if question is not None else ""
    answer_s = to_text(answer) if answer is not None else ""
    conversation = render_conversation(msgs) if msgs else []

    if not question_s and not answer_s and not conversation:
        return None
    if conversation and question_s and conversation[0] == f"Customer: {question_s}":
        conversation = conversation[1:]  # opening message repeats the issue
    if rid_s and title_s:
        header = f"Support ticket #{rid_s}: {title_s}"
    elif rid_s:
        header = f"Support ticket #{rid_s}"
    elif title_s:
        header = f"Support ticket: {title_s}"
    else:
        header = "Support ticket"

    lines: List[str] = []
    if question_s:
        lines.append(f"Customer issue: {question_s}")
    if answer_s:
        lines.append(f"Our response: {answer_s}")
    if conversation:
        lines.append("Conversation:")
        lines.extend(conversation)
    extra_fields = mapping.get("extra_fields")
    if extra_fields:
        for f in extra_fields:
            v = to_text(get_path(record, f))
            if v:
                lines.append(f"{f}: {v}")
    else:
        lookup = {_norm(k): k for k in record}
        for cand in DEFAULT_EXTRA_KEYS:
            k = lookup.get(cand)
            if k is not None and k not in used:
                v = to_text(record[k])
                if v and len(v) < 300:
                    lines.append(f"{k}: {v}")

    body = "\n".join(lines)
    return {
        "key": rid_s or None,
        "title": header,
        "text": f"{header}\n{body}",
        "chunks": _split_long(header, body, TICKET_MAX_CHARS),
        "metadata": {"ticket_id": rid_s or None, "title": title_s or None},
    }


# ---------------------------------------------------------------------------
# generic records
# ---------------------------------------------------------------------------

def flatten(obj: Any, prefix: str = "", out: Optional[List[Tuple[str, str]]] = None, depth: int = 0) -> List[Tuple[str, str]]:
    out = [] if out is None else out
    if depth > 8:
        return out
    if isinstance(obj, dict):
        for k, v in obj.items():
            flatten(v, f"{prefix}.{k}" if prefix else str(k), out, depth + 1)
    elif isinstance(obj, list):
        if all(not isinstance(v, (dict, list)) for v in obj):
            txt = to_text(obj)
            if txt:
                out.append((prefix or "value", txt))
        else:
            for i, v in enumerate(obj):
                flatten(v, f"{prefix}[{i}]", out, depth + 1)
    else:
        txt = to_text(obj)
        if txt:
            out.append((prefix or "value", txt))
    return out


def chunk_lines(lines: List[str], header: str = "", max_chars: int = 1500) -> List[str]:
    """Pack lines into chunks (each prefixed with header); long lines are split on words."""
    budget = max(300, max_chars - len(header) - 1)
    pieces: List[str] = []
    for line in lines:
        if len(line) > budget:
            pieces.extend(chunk_text(line, chunk_size=budget, overlap=100))
        else:
            pieces.append(line)
    chunks: List[str] = []
    current: List[str] = []
    size = 0
    for p in pieces:
        if current and size + len(p) + 1 > budget:
            chunks.append("\n".join(current))
            current, size = [], 0
        current.append(p)
        size += len(p) + 1
    if current:
        chunks.append("\n".join(current))
    if header:
        chunks = [f"{header}\n{c}" for c in chunks]
    return chunks


def normalize_generic(record: Any, mapping: Optional[dict] = None) -> Optional[Dict[str, Any]]:
    mapping = mapping or {}
    if not isinstance(record, dict):
        txt = to_text(record)
        if not txt:
            return None
        return {"key": None, "title": txt[:80], "text": txt,
                "chunks": chunk_lines([txt]), "metadata": {}}
    _, rid = _field(record, mapping.get("id_field"), ["id", "uuid", "key", "number"])
    _, title = _field(record, mapping.get("title_field"), ["title", "name", "subject", "summary"])
    rid_s = to_text(rid) if rid is not None and not isinstance(rid, (dict, list)) else ""
    title_s = to_text(title).replace("\n", " ").strip()[:200] if title is not None else ""
    lines = [f"{k}: {v}" for k, v in flatten(record)]
    if not lines:
        return None
    header = f"Record #{rid_s}: {title_s}" if rid_s and title_s else (
        f"Record #{rid_s}" if rid_s else (f"Record: {title_s}" if title_s else "Record"))
    return {
        "key": rid_s or None,
        "title": header,
        "text": header + "\n" + "\n".join(lines),
        "chunks": chunk_lines(lines, header=header),
        "metadata": {"record_id": rid_s or None},
    }


def normalize_records(records: List[Any], source_type: str = "support_tickets",
                      mapping: Optional[dict] = None) -> Tuple[List[Dict[str, Any]], int]:
    """Normalize records; returns (items, skipped_count)."""
    items: List[Dict[str, Any]] = []
    skipped = 0
    normalizer = normalize_ticket if source_type == "support_tickets" else normalize_generic
    for rec in records:
        try:
            item = normalizer(rec, mapping)
        except Exception:
            item = None
        if item is None:
            skipped += 1
        else:
            items.append(item)
    return items, skipped


def detected_fields(records: List[Any]) -> List[str]:
    first = next((r for r in records if isinstance(r, dict)), None)
    return [str(k) for k in first.keys()] if first else []


def json_dumps_safe(obj: Any) -> str:
    return json.dumps(obj, default=str, ensure_ascii=False)
