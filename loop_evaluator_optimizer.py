from typing import Annotated, TypedDict
import operator
from pydantic import BaseModel, Field
from langchain_anthropic import ChatAnthropic
from langgraph.graph import StateGraph, END

class Critique(BaseModel):
    passed: bool = Field(description="Whether the draft meets the criteria")
    feedback: str = Field(description="Specific, actionable feedback if not passed")

class LoopState(TypedDict):
    draft: str
    feedback: Annotated[list[str], operator.add]
    iteration: int
    passed: bool

MAX_ITERATIONS = 3

generator = ChatAnthropic(model="claude-sonnet-4-6")
critic = ChatAnthropic(model="claude-sonnet-4-6").with_structured_output(Critique)

def generate_node(state: LoopState):
    # Generator: produces or revises the draft, conditioned on any prior critique
    prior_feedback = "\n".join(state.get("feedback", []))
    prompt = f"Write a draft.\n\nAddress this feedback:\n{prior_feedback}" if prior_feedback else "Write a draft."
    response = generator.invoke([{"role": "user", "content": prompt}])
    return {"draft": response.content, "iteration": state.get("iteration", 0) + 1}

def critique_node(state: LoopState):
    # Critic: scores the draft against strict criteria, never writes content itself
    result = critic.invoke([
        {"role": "system", "content": "Evaluate this draft strictly. Pass only if it fully meets the criteria."},
        {"role": "user", "content": state["draft"]},
    ])
    return {"feedback": [result.feedback], "passed": result.passed}

def should_continue(state: LoopState):
    if state["passed"] or state["iteration"] >= MAX_ITERATIONS:
        return END
    return "generate"  # <- this edge is the entire loop

graph = StateGraph(LoopState)
graph.add_node("generate", generate_node)
graph.add_node("critique", critique_node)
graph.add_edge("generate", "critique")
graph.add_conditional_edges("critique", should_continue)
graph.set_entry_point("generate")

app = graph.compile()