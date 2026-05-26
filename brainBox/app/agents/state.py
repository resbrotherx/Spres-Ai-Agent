from typing import TypedDict, List, Optional

class AgentState(TypedDict):
    question: str
    tenant_id: str
    context: List[str]
    response: Optional[str]
    search_results: List
    reasoning: Optional[str]
