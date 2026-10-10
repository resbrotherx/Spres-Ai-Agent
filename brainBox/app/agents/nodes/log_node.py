import re
import threading
from contextlib import contextmanager
from datetime import datetime, timezone

from app.agents.tools.vector_search import semantic_search
from app.agents.state import AgentState
from app.utils.logging import logger
from app.permissions import allowed_audiences, normalize_role

def router_node(state: AgentState) -> AgentState:
    logger.info(f"Router node - Processing question: {state['question']}")
    return state

# ---------------------------------------------------------------------------------------------
# Small talk: greetings, thanks, "how are you", "who are you", "what time is it". Answered
# conversationally without a knowledge search (faster, and never logged as a knowledge gap).
# ---------------------------------------------------------------------------------------------
SMALL_TALK_REASONING = "Small talk: answered conversationally without knowledge search"
_SMALL_TALK = re.compile(
    r"^(?:hi+|hello+|hey+|hiya|yo|howdy|greetings|good\s+(?:morning|afternoon|evening|day|night)|morning|evening"
    r"|thanks?(?:\s+you)?|thank\s+you|thx|ty|cheers|ok(?:ay)?|cool|great|nice|awesome|perfect|bye|goodbye"
    r"|see\s+you(?:\s+later)?|good\s*bye|how\s+are\s+(?:you|u)(?:\s+doing)?|how(?:'s|\s+is)\s+it\s+going"
    r"|how\s+(?:is|was)\s+your\s+day|what'?s\s+up|sup|who\s+are\s+you|what\s+are\s+you"
    r"|what(?:'s|\s+is)\s+your\s+name|what\s+can\s+you\s+do|how\s+can\s+you\s+help(?:\s+me)?"
    r"|what\s+time\s+is\s+it|what(?:'s|\s+is)\s+the\s+time|what\s+day\s+is\s+(?:it|today)"
    r"|what(?:'s|\s+is)\s+(?:the|today'?s)\s+date|nice\s+to\s+meet\s+you|are\s+you\s+(?:there|a\s+bot|human))\b",
    re.IGNORECASE,
)
_FILLER = {"there", "team", "bot", "assistant", "sir", "madam", "ma", "friend", "again", "so", "much", "a", "lot",
           "you", "u", "all", "everyone", "today", "now", "please", "pls", "very", "dear", "brainbox", "ai", "and",
           "to", "the", "for", "your", "it", "oh", "ah", "well", "guys", "man", "bro", "mate", "o"}


def is_small_talk(question: str) -> bool:
    """True for a greeting / thanks / "how are you" style message with nothing else in it."""
    q = re.sub(r"[^\w\s']", " ", (question or "").lower())
    q = re.sub(r"\s+", " ", q).strip()
    if not q or len(q.split()) > 9:
        return False
    rest = q
    for _ in range(4):  # "hi, good morning, how are you"
        m = _SMALL_TALK.match(rest)
        if not m:
            break
        rest = rest[m.end():].strip()
        while rest.split() and rest.split()[0] in _FILLER and not _SMALL_TALK.match(rest):
            rest = " ".join(rest.split()[1:])
    if rest == q:
        return False
    return all(w in _FILLER for w in rest.split())


# Words that make a question about *this company* (its offer, policies or someone's account).
# Without matching knowledge such questions get the safe "don't know" reply instead of a guess.
_COMPANY_SPECIFIC = re.compile(
    r"\b(?:you|your|yours|we|our|ours|us|company|business|shop|store|price|prices|pricing|cost|fee|fees|plan|plans"
    r"|order|orders|account|invoice|invoices|bill|billing|refund|delivery|shipping|ship|policy|policies|hours|open"
    r"|contact|support|subscription|discount|warranty|return|returns|staff|branch|office|location|address|phone"
    r"|email|sell|stock|available|availability|meter|tariff|balance|payment|pay|customer|vendor|supplier)\b",
    re.IGNORECASE,
)


def is_general_question(question: str) -> bool:
    """True when the question is general knowledge (definitions, how-tos, code, maths), so the
    model may answer from what it knows even with no matching company knowledge."""
    return not _COMPANY_SPECIFIC.search(question or "")


def is_small_talk_reasoning(reasoning) -> bool:
    return (reasoning or "").startswith("Small talk")


def _now():
    """(local datetime, part of day) in ASSISTANT_TIMEZONE."""
    from app.config import settings
    now = datetime.now(timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        now = now.astimezone(ZoneInfo(settings.ASSISTANT_TIMEZONE))
    except Exception:  # unknown zone: stay on UTC
        pass
    part = "morning" if 5 <= now.hour < 12 else "afternoon" if 12 <= now.hour < 17 else "evening" if 17 <= now.hour < 22 else "night"
    return now, part


def _now_text() -> str:
    now, part = _now()
    return f"{now.strftime('%A %d %B %Y, %H:%M')} ({part}, {now.tzname() or 'UTC'})"


def _has(q: str, pattern: str) -> bool:
    return re.search(pattern, q) is not None


def small_talk_reply(question: str) -> str:
    """Instant, correct reply to small talk (no model call: faster, and the time is always right)."""
    q = (question or "").lower()
    now, part = _now()
    clock = now.strftime("%I:%M %p").lstrip("0")
    day = f"{now.strftime('%A')}, {now.day} {now.strftime('%B %Y')}"
    hello = f"Good {part}!" if part != "night" else "Hello!"
    parts = []
    if _has(q, r"\btime\b"):
        return f"It's {clock} ({part}) on {day}. How can I help you?"
    if _has(q, r"\b(?:date|what day)\b"):
        return f"Today is {day}. How can I help you?"
    if _has(q, r"\b(?:thanks?|thank you|thx|ty|cheers)\b"):
        return "You're welcome! Is there anything else I can help you with?"
    if _has(q, r"\b(?:bye|goodbye|good bye|see you)\b"):
        return f"Goodbye! Have a great {part if part != 'night' else 'night'}. 👋"
    if _has(q, r"\b(?:hi+|hello+|hey+|hiya|yo|howdy|greetings|good (?:morning|afternoon|evening|day|night)|morning|evening)\b"):
        parts.append(f"{hello} 👋")
    if _has(q, r"how are (?:you|u)|how(?:'s| is) it going|how (?:is|was) your day|what'?s up|\bsup\b"):
        parts.append("I'm doing great, thank you for asking!")
    if _has(q, r"who are you|what are you|your name|are you (?:a bot|human)|what can you do|how can you help"):
        parts.append("I'm your AI assistant — I can answer questions about our products, services and your "
                     "account, and help with general questions too.")
    if _has(q, r"are you there"):
        parts.append("Yes, I'm here!")
    if not parts:
        return "Great! Let me know if there's anything else I can help you with."
    return " ".join(parts + ["How can I help you today?"])


# Answers being generated right now; background jobs (knowledge labelling) wait while > 0 so
# live chats always get the model first.
_active = 0
_active_lock = threading.Lock()


@contextmanager
def _chat_in_progress():
    global _active
    with _active_lock:
        _active += 1
    try:
        yield
    finally:
        with _active_lock:
            _active -= 1


def active_chats() -> int:
    return _active


def log_node(state: AgentState) -> AgentState:
    question = state["question"]
    tenant_id = state["tenant_id"]

    if is_small_talk(question):
        logger.info("Log node - small talk, instant reply")
        return {**state, "small_talk": True, "instant_reply": small_talk_reply(question),
                "context": [], "search_results": []}

    logger.info(f"Log node - Searching for: {question}")

    # Permissions: only documents whose audience this role may read are retrieved, so the LLM
    # never sees restricted content. /api/chat already resolved the effective role (publishable
    # keys are forced to "public") and caches per tenant + role.
    role = normalize_role(state.get("user_role"))
    audiences = allowed_audiences(role)  # None = admin, unrestricted
    results = semantic_search(question, tenant_id, limit=5, audiences=audiences)

    context = []
    search_results = []

    for result in results:
        doc_id, content, source_type, file_path, distance = result
        context.append(content)
        search_results.append({
            "id": doc_id,
            "content": content[:500],
            "source": source_type,
            "file_path": file_path,
            "distance": float(distance)
        })

    return {
        **state,
        "context": context,
        "search_results": search_results
    }

def code_node(state: AgentState) -> AgentState:
    logger.info("Code node - Analyzing code context")
    return state

def postgres_node(state: AgentState) -> AgentState:
    logger.info("Postgres node - Searching PostgreSQL")
    return state

LLM_FALLBACK_RESPONSE = (
    "I found relevant knowledge-base context, but the AI model service is currently "
    "unavailable. Please try again in a moment."
)
LLM_FALLBACK_REASONING = "LLM unavailable; returned fallback instead of raw infrastructure error"
NO_CONTEXT_REASONING = "No matching knowledge-base context; answered without calling the LLM"


class LLMStreamError(RuntimeError):
    """The LLM failed after part of the answer was already streamed."""


def no_context_response() -> str:
    from app.gaps import UNKNOWN_ANSWER_PREFIX  # gap detection looks for this phrase
    return (
        f"{UNKNOWN_ANSWER_PREFIX}. I've passed your question to our team so they can add "
        "the answer — please contact support if you need help right away."
    )


def build_prompt(state: AgentState):
    """The answer prompt for the retrieved context, or None when there is no context the user
    may see (then the caller answers ``no_context_response()`` without calling the LLM)."""
    from app.config import settings
    from app.gaps import UNKNOWN_ANSWER_PREFIX  # gap detection looks for this phrase

    # Prompt size is the main cost on a CPU-only server, so keep it tight (tunable in .env).
    MAX_CHUNK_CHARS = settings.RAG_MAX_CHUNK_CHARS
    MAX_CHUNKS = settings.RAG_MAX_CHUNKS
    sources = [r.get("source") for r in state.get("search_results") or []]
    blocks = []
    for i, chunk in enumerate((state.get("context") or [])[:MAX_CHUNKS]):
        label = sources[i] if i < len(sources) and sources[i] else "document"
        blocks.append(f"[{i + 1}] ({label})\n{chunk[:MAX_CHUNK_CHARS]}")
    question = state["question"]

    if state.get("small_talk"):
        return f"""You are a warm, professional AI assistant for a company. It is now {_now_text()}.
Reply naturally to the user's message in one or two short sentences: greet back using the right
time of day, say how you are, explain what you can help with, or give the time/date if asked.
Offer to help with their questions. Do not invent company facts.

User: {question}
Assistant:"""

    rules = f"""- Company-specific facts (our products, prices, policies, staff, accounts, orders) must come ONLY from the context.
  If the context doesn't contain them, reply: "{UNKNOWN_ANSWER_PREFIX}." plus one short polite sentence.
- General questions (definitions, how-tos, writing, maths, code) may be answered from your own knowledge.
- Format with Markdown: numbered steps for instructions, a table for comparisons or lists of records,
  and fenced code blocks with the language name (```python) for any code.
- Be concise. Never reveal names, contact details or account details of other customers."""

    # Nothing in the knowledge base this user may see: general questions can still be answered
    # from the model's own knowledge; company-specific ones get the instant "don't know" reply
    # (small local models invent company facts from thin air) and become a knowledge gap.
    if not blocks:
        if not is_general_question(question):
            return None
        return f"""You are a helpful AI assistant for a company. It is now {_now_text()}.
{rules}

Question: {question}
Answer:"""

    context = "\n\n".join(blocks)

    return f"""You are a friendly customer-support assistant. It is now {_now_text()}.
Use the context below (past support tickets with our team's response, documents, records).
{rules}
- If a past ticket matches, reuse the response our team gave.

Context:
{context}

Question: {question}
Answer:"""


def llm_providers():
    """[(name, ask_sync, stream_sync, label)] - the configured provider first, the other one as
    a fallback when available. Resolved at call time (tests/monkeypatching friendly)."""
    from app.config import settings
    from app.llm import ollama_client, openai_client

    providers = [
        ("ollama", ollama_client.ask_ollama_sync, ollama_client.stream_ollama_sync, "Ollama"),
        ("openai", openai_client.ask_openai_sync, openai_client.stream_openai_sync, "OpenAI-compatible"),
    ]
    if settings.LLM_PROVIDER == "openai":
        providers.reverse()
    return [p for p in providers if p[0] != "openai" or openai_client.openai_enabled()]


def generate_answer(prompt: str):
    """(response, reasoning) from the first provider that answers, else the fallback text."""
    for _name, ask, _stream, label in llm_providers():
        with _chat_in_progress():
            response = ask(prompt)
        if response:
            return response.strip(), f"Used semantic search and {label} LLM for response"
    return LLM_FALLBACK_RESPONSE, LLM_FALLBACK_REASONING


def stream_answer(prompt: str):
    """Streaming twin of ``generate_answer`` (same provider order and fallback).

    Yields ``("token", delta)`` items, then exactly one of ``("end", response, reasoning)`` or
    ``("fallback", LLM_FALLBACK_RESPONSE, LLM_FALLBACK_REASONING)`` (every provider failed before
    producing any text). A provider that fails after it streamed text raises ``LLMStreamError``.
    """
    with _chat_in_progress():
        yield from _stream_answer(prompt)


def _stream_answer(prompt: str):
    for name, _ask, stream, label in llm_providers():
        parts = []
        try:
            for piece in stream(prompt):
                if not piece:
                    continue
                parts.append(piece)
                yield ("token", piece)
        except GeneratorExit:
            raise
        except Exception as e:
            if "".join(parts).strip():
                logger.error(f"{label} LLM failed mid-stream: {e}")
                raise LLMStreamError(str(e)) from e
            logger.error(f"Error streaming from {label} LLM: {e}")
            continue
        text = "".join(parts).strip()
        if text:
            yield ("end", text, f"Used semantic search and {label} LLM for response")
            return
    yield ("fallback", LLM_FALLBACK_RESPONSE, LLM_FALLBACK_REASONING)


def response_node(state: AgentState) -> AgentState:
    if state.get("instant_reply"):
        return {**state, "response": state["instant_reply"], "reasoning": SMALL_TALK_REASONING}
    prompt = build_prompt(state)

    # Nothing in the knowledge base this user may see: reply at once; chat.py records it as a
    # no_context gap.
    if prompt is None:
        return {**state, "response": no_context_response(), "reasoning": NO_CONTEXT_REASONING}

    response, reasoning = generate_answer(prompt)
    if state.get("small_talk") and reasoning != LLM_FALLBACK_REASONING:
        reasoning = SMALL_TALK_REASONING
    return {
        **state,
        "response": response.strip(),
        "reasoning": reasoning
    }
