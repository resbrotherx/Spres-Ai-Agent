from langgraph.graph import StateGraph, END

from app.agents.state import AgentState
from app.agents.nodes.log_node import router_node, log_node, response_node

workflow = StateGraph(AgentState)

workflow.add_node("router", router_node)
workflow.add_node("search", log_node)
workflow.add_node("generate_response", response_node)

workflow.set_entry_point("router")
workflow.add_edge("router", "search")
workflow.add_edge("search", "generate_response")
workflow.add_edge("generate_response", END)

graph = workflow.compile()
