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
    from app.llm.ollama_client import ask_ollama_sync
    from app.llm.openai_client import ask_openai_sync
    from app.gaps import UNKNOWN_ANSWER_PREFIX  # gap detection looks for this phrase

    MAX_CHUNK_CHARS = 1200
    MAX_CHUNKS = 5
    sources = [r.get("source") for r in state.get("search_results") or []]
    blocks = []
    for i, chunk in enumerate(state["context"][:MAX_CHUNKS]):
        label = sources[i] if i < len(sources) and sources[i] else "document"
        blocks.append(f"[{i + 1}] (source: {label})\n{chunk[:MAX_CHUNK_CHARS]}")
    context = "\n\n".join(blocks) if blocks else "No context found"
    question = state["question"]

    prompt = f"""You are a helpful customer-support and knowledge assistant.
Answer the user's question using the knowledge base context below. The context may contain
past support tickets (a customer issue and the response our team gave), uploaded documents,
API records and logs.

Guidelines:
- Base your answer on the context. If the context does not contain the answer, do not guess:
  start your reply with exactly "{UNKNOWN_ANSWER_PREFIX}" followed by a short, polite sentence
  (for example suggesting the user contact support). Never start an answer with that phrase
  when the context does answer the question.
- If a past support ticket matches the user's issue, reuse the response that was given there
  (adapted to the user's question) and mention that it resolved a similar issue before.
- Be concise, friendly and accurate. Use steps or bullet points for procedures.
- Never reveal names, contact details, orders, tickets or any other information about other
  customers or accounts; describe how an issue was solved without saying who had it.

Context from the knowledge base:
{context}

User Question: {question}

Answer:"""

    response = ask_ollama_sync(prompt)
    reasoning = "Used semantic search and Ollama LLM for response"

    if not response:
        response = ask_openai_sync(prompt)
        reasoning = "Used semantic search and OpenAI LLM for response"

    if not response:
        if state["context"]:
            response = (
                "I found relevant knowledge-base context, but the AI model service is currently "
                "unavailable. Please check the Ollama/OpenAI configuration and try again."
            )
        else:
            response = (
                "I could not find matching knowledge-base context, and the AI model service is "
                "currently unavailable. Please check the Ollama/OpenAI configuration and try again."
            )
        reasoning = "LLM unavailable; returned fallback instead of raw infrastructure error"

    return {
        **state,
        "response": response,
        "reasoning": reasoning
    }
