from typing import TypedDict, List, Optional

class AgentState(TypedDict):
    question: str
    tenant_id: str
    context: List[str]
    response: Optional[str]
    search_results: List
    reasoning: Optional[str]
    # End-user identity. user_role is the *effective* role resolved by /api/chat (publishable
    # keys are always "public"); log_node filters retrieval by the audiences it may read.
    user_id: Optional[str]
    user_role: Optional[str]
