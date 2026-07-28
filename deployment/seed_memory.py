"""Seed Memory Bank: run real sessions, trigger memory generation, list results.

Usage: python deployment/seed_memory.py
"""

import os
import time

from dotenv import load_dotenv

TURNS = {
    "gus": [
        "Triage the latest application logs and give me the report.",
        "Good report. Remember for future triages: I'm Gus, the SRE lead. "
        "For P1 database issues always tell me to page #incident-response. "
        "The orders service OOMKills are a known issue tracked as OPS-421, "
        "so mark them 'known issue' instead of P1. I prefer short bullet "
        "reports over long prose.",
    ],
    "demo-user": [
        "Triage the logs in app.log. Focus on payment problems.",
        "Noted. For context we should remember: Stripe timeouts happened "
        "last Tuesday too — vendor said it was their networking. If Stripe "
        "timeouts show up together with checkout 502s, treat it as one "
        "incident, not two.",
    ],
}


def main() -> None:
    load_dotenv()
    resource_name = os.environ["AGENT_ENGINE_RESOURCE_NAME"]
    _, project, _, location = resource_name.split("/")[:4]

    import vertexai

    client = vertexai.Client(project=project, location=location)
    agent = client.agent_engines.get(name=resource_name)

    session_names = []
    for user_id, messages in TURNS.items():
        session = agent.create_session(user_id=user_id)
        session_id = session["id"] if isinstance(session, dict) else session.id
        print(f"session {session_id} (user {user_id})")
        for msg in messages:
            print(f"  > {msg[:60]}...")
            chars = 0
            for event in agent.stream_query(
                user_id=user_id, session_id=session_id, message=msg
            ):
                chars += len(str(event))
            print(f"  < response received ({chars} chars of events)")
        session_names.append((user_id, f"{resource_name}/sessions/{session_id}"))

    print("\nTriggering Memory Bank generation from sessions ...")
    # Scope must exactly match what the deployed ADK runtime searches with:
    # {'app_name': <engine id>, 'user_id': ...} — a user_id-only scope is
    # invisible to the agent's PreloadMemoryTool.
    engine_id = resource_name.split("/")[-1]
    for user_id, session_name in session_names:
        op = client.agent_engines.memories.generate(
            name=resource_name,
            vertex_session_source={"session": session_name},
            scope={"app_name": engine_id, "user_id": user_id},
            config={"wait_for_completion": True},
        )
        print(f"  generated from {session_name.split('/')[-1]}: done={op.done}")

    time.sleep(2)
    print("\nMemories now in Memory Bank:")
    count = 0
    for memory in client.agent_engines.memories.list(name=resource_name):
        count += 1
        print(f"  [{memory.scope}] {memory.fact}")
    print(f"\nTotal: {count} memories")


if __name__ == "__main__":
    main()
