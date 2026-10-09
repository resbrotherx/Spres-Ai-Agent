from app.agents.tools.vector_search import semantic_search
from app.agents.state import AgentState
from app.utils.logging import logger
from app.permissions import allowed_audiences, normalize_role

def router_node(state: AgentState) -> AgentState:
    logger.info(f"Router node - Processing question: {state['question']}")
    return state

def log_node(state: AgentState) -> AgentState:
    question = state["question"]
    tenant_id = state["tenant_id"]

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

    # Nothing in the knowledge base this user may see: don't let the model guess (small local
    # models invent answers from thin air).
    if not blocks:
        return None

    context = "\n\n".join(blocks)

    return f"""You are a friendly customer-support assistant. Answer using ONLY the context below
(past support tickets with our team's response, documents, records).
- If the context doesn't answer the question, reply: "{UNKNOWN_ANSWER_PREFIX}." plus one short polite sentence.
- If a past ticket matches, reuse the response our team gave.
- Keep it short: at most 4 sentences or a few bullet steps.
- Never reveal names, contact details or account details of other customers.

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
    prompt = build_prompt(state)

    # Nothing in the knowledge base this user may see: reply at once; chat.py records it as a
    # no_context gap.
    if prompt is None:
        return {**state, "response": no_context_response(), "reasoning": NO_CONTEXT_REASONING}

    response, reasoning = generate_answer(prompt)
    return {
        **state,
        "response": response.strip(),
        "reasoning": reasoning
    }
