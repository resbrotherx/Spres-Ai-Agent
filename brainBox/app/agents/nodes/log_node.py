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

    context = "\n".join(state["context"][:3]) if state["context"] else "No context found"
    question = state["question"]

    prompt = f"""You are a server infrastructure AI assistant.

Context from the knowledge base:
{context}

User Question: {question}

Provide a helpful, accurate response based on the context."""

    response = ask_ollama_sync(prompt)

    return {
        **state,
        "response": response,
        "reasoning": "Used semantic search and Ollama LLM for response"
    }
