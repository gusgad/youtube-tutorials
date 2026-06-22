from typing import Annotated, TypedDict
import operator
from langchain_anthropic import ChatAnthropic
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode

class AgentState(TypedDict):
    messages: Annotated[list, operator.add]

model = ChatAnthropic(model="claude-sonnet-4-6").bind_tools(tools)

def agent_node(state: AgentState):
    # Thought + Action: one LLM call sees the full history so far
    response = model.invoke(state["messages"])
    return {"messages": [response]}

def should_continue(state: AgentState):
    last_message = state["messages"][-1]
    return "tools" if last_message.type == "tool_use" else END

graph = StateGraph(AgentState)
graph.add_node("agent", agent_node)
graph.add_node("tools", ToolNode(tools))  # Observation: executes whichever tool the model picked
graph.add_conditional_edges("agent", should_continue)
graph.add_edge("tools", "agent")  # <- this edge is the entire ReAct loop
graph.set_entry_point("agent")

app = graph.compile()


{
  "content": [
    { "type": "text", "text": "The user wants today's weather in Sevilla. I should call the weather tool with Sevilla's coordinates." },
    { "type": "tool_use", "name": "get_weather", "input": { "city": "Sevilla" } }
  ]
}