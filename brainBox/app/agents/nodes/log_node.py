from app.agents.tools.vector_search import semantic_search
from app.agents.state import AgentState
from app.utils.logging import logger

def router_node(state: AgentState) -> AgentState:
    logger.info(f"Router node - Processing question: {state['question']}")
    return state

def log_node(state: AgentState) -> AgentState:
    question = state["question"]
    tenant_id = state["tenant_id"]

    logger.info(f"Log node - Searching for: {question}")

    results = semantic_search(question, tenant_id, limit=5)

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

    MAX_CHUNK_CHARS = 800
    truncated_context = [c[:MAX_CHUNK_CHARS] for c in state["context"][:3]]
    context = "\n".join(truncated_context) if truncated_context else "No context found"
    # context = "\n".join(state["context"][:3]) if state["context"] else "No context found"
    question = state["question"]

    prompt = f"""You are a server infrastructure AI assistant.

Context from the knowledge base:
{context}

User Question: {question}

Provide a helpful, accurate response based on the context."""

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
