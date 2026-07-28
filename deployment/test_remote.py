"""Smoke-test the deployed agent: run a triage query and exercise Memory Bank.

Usage: python deployment/test_remote.py projects/P/locations/L/reasoningEngines/ID
"""

import os
import sys

from dotenv import load_dotenv

PROMPT = "Triage the latest application logs and give me the report."


def main() -> None:
    load_dotenv()
    resource_name = sys.argv[1] if len(sys.argv) > 1 else os.environ["AGENT_ENGINE_RESOURCE_NAME"]
    _, project, _, location = resource_name.split("/")[:4]

    import vertexai

    client = vertexai.Client(project=project, location=location)
    agent = client.agent_engines.get(name=resource_name)

    print(f"Querying {resource_name} ...\n")
    for event in agent.stream_query(user_id="demo-user", message=PROMPT):
        content = getattr(event, "content", None) or (
            event.get("content") if isinstance(event, dict) else None
        )
        if not content:
            continue
        parts = content.get("parts", []) if isinstance(content, dict) else getattr(content, "parts", [])
        for part in parts:
            text = part.get("text") if isinstance(part, dict) else getattr(part, "text", None)
            if text:
                print(text, end="", flush=True)
    print("\n\nDone.")


if __name__ == "__main__":
    main()
