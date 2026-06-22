from typing import Annotated, TypedDict
import operator
from pydantic import BaseModel, Field
from langchain_anthropic import ChatAnthropic
from langgraph.graph import StateGraph, END
from langgraph.types import Send

class Subtasks(BaseModel):
    subtasks: list[str] = Field(description="Independent subtasks that can run concurrently")

class OrchestratorState(TypedDict):
    messages: list
    subtasks: list[str]
    results: Annotated[list[str], operator.add]  # reducer merges results coming back from parallel workers

class WorkerState(TypedDict):
    subtask: str
    results: Annotated[list[str], operator.add]

orchestrator = ChatAnthropic(model="claude-sonnet-4-6").with_structured_output(Subtasks)
worker_model = ChatAnthropic(model="claude-haiku-4-5-20251001").bind_tools(tools)

def orchestrator_node(state: OrchestratorState):
    # The only sequential step: decompose the request into independent pieces
    result = orchestrator.invoke([
        {"role": "system", "content": "Break this into independent subtasks that can run "
                                       "concurrently. Only split if subtasks don't depend on each other."},
        *state["messages"],
    ])
    return {"subtasks": result.subtasks}

def dispatch(state: OrchestratorState):
    # Fan-out: spawn one worker invocation per subtask, all in parallel
    return [Send("worker", {"subtask": s}) for s in state["subtasks"]]

def worker_node(state: WorkerState):
    # Each worker only sees its own subtask - no shared context, no coordination with other workers
    response = worker_model.invoke([{"role": "user", "content": state["subtask"]}])
    return {"results": [response.content]}

def aggregate_node(state: OrchestratorState):
    # Fan-in: only runs once every parallel worker has finished
    summary = "\n\n".join(state["results"])
    return {"messages": [{"role": "assistant", "content": summary}]}

graph = StateGraph(OrchestratorState)
graph.add_node("orchestrator", orchestrator_node)
graph.add_node("worker", worker_node)
graph.add_node("aggregate", aggregate_node)
graph.add_conditional_edges("orchestrator", dispatch, ["worker"])
graph.add_edge("worker", "aggregate")
graph.set_entry_point("orchestrator")
graph.add_edge("aggregate", END)

app = graph.compile()