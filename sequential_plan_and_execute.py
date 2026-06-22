from typing import Annotated, TypedDict
from pydantic import BaseModel, Field
from langchain_anthropic import ChatAnthropic
from langgraph.graph import StateGraph, END

class Plan(BaseModel):
    steps: list[str] = Field(description="Ordered list of discrete steps")

class AgentState(TypedDict):
    messages: Annotated[list, operator.add]
    plan: list[str]
    past_steps: Annotated[list[str], operator.add]
    step_index: int

planner = ChatAnthropic(model="claude-sonnet-4-6").with_structured_output(Plan)
executor = ChatAnthropic(model="claude-haiku-4-5-20251001").bind_tools(tools)

def plan_node(state: AgentState):
    # 1. Plan: one call, produces the entire ordered step list
    result = planner.invoke([
        {"role": "system", "content": "Break the task into an ordered list of discrete steps."},
        *state["messages"],
    ])
    return {"plan": result.steps, "step_index": 0}

def execute_node(state: AgentState):
    # 2. Execute: one call per step, cheaper model, only sees current step + prior results
    current_step = state["plan"][state["step_index"]]
    result = executor.invoke([
        {"role": "system", "content": "Past results:\n" + "\n".join(state["past_steps"])},
        {"role": "user", "content": current_step},
    ])
    return {
        "past_steps": [f"{current_step}: {result.content}"],
        "step_index": state["step_index"] + 1,
    }

def should_continue(state: AgentState):
    return "execute" if state["step_index"] < len(state["plan"]) else END

graph = StateGraph(AgentState)
graph.add_node("plan", plan_node)
graph.add_node("execute", execute_node)
graph.add_conditional_edges("execute", should_continue)
graph.add_edge("plan", "execute")
graph.set_entry_point("plan")

app = graph.compile()