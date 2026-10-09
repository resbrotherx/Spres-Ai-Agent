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

def response_node(state: AgentState) -> AgentState:
    from app.config import settings
    from app.llm.ollama_client import ask_ollama_sync
    from app.llm.openai_client import ask_openai_sync, openai_enabled
    from app.gaps import UNKNOWN_ANSWER_PREFIX  # gap detection looks for this phrase

    # Prompt size is the main cost on a CPU-only server, so keep it tight (tunable in .env).
    MAX_CHUNK_CHARS = settings.RAG_MAX_CHUNK_CHARS
    MAX_CHUNKS = settings.RAG_MAX_CHUNKS
    sources = [r.get("source") for r in state.get("search_results") or []]
    blocks = []
    for i, chunk in enumerate(state["context"][:MAX_CHUNKS]):
        label = sources[i] if i < len(sources) and sources[i] else "document"
        blocks.append(f"[{i + 1}] ({label})\n{chunk[:MAX_CHUNK_CHARS]}")
    question = state["question"]

    # Nothing in the knowledge base this user may see: don't let the model guess (small local
    # models invent answers from thin air). Reply at once; chat.py records it as a no_context gap.
    if not blocks:
        return {
            **state,
            "response": (
                f"{UNKNOWN_ANSWER_PREFIX}. I've passed your question to our team so they can add "
                "the answer — please contact support if you need help right away."
            ),
            "reasoning": "No matching knowledge-base context; answered without calling the LLM",
        }

    context = "\n\n".join(blocks)

    prompt = f"""You are a friendly customer-support assistant. Answer using ONLY the context below
(past support tickets with our team's response, documents, records).
- If the context doesn't answer the question, reply: "{UNKNOWN_ANSWER_PREFIX}." plus one short polite sentence.
- If a past ticket matches, reuse the response our team gave.
- Keep it short: at most 4 sentences or a few bullet steps.
- Never reveal names, contact details or account details of other customers.

Context:
{context}

Question: {question}
Answer:"""

    # Provider order: the configured one first, the other as a fallback when available.
    providers = [("ollama", ask_ollama_sync, "Ollama"), ("openai", ask_openai_sync, "OpenAI-compatible")]
    if settings.LLM_PROVIDER == "openai":
        providers.reverse()

    response, reasoning = None, None
    for name, ask, label in providers:
        if name == "openai" and not openai_enabled():
            continue
        response = ask(prompt)
        if response:
            reasoning = f"Used semantic search and {label} LLM for response"
            break

    if not response:
        response = (
            "I found relevant knowledge-base context, but the AI model service is currently "
            "unavailable. Please try again in a moment."
        )
        reasoning = "LLM unavailable; returned fallback instead of raw infrastructure error"

    return {
        **state,
        "response": response.strip(),
        "reasoning": reasoning
    }
