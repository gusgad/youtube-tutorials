"""Drive varied queries at the deployed agent to populate observability
dashboards (Traces/Spans, Sessions, request metrics).

Usage: python deployment/generate_traffic.py [n_rounds]
"""

import os
import sys

from dotenv import load_dotenv

QUERIES = [
    ("gus", "Quick triage of the latest logs, bullets only."),
    ("gus", "Which service is the root cause of the 503s?"),
    ("demo-user", "Summarize payment-related failures in the logs."),
    ("alice-oncall", "Triage app.log. What should I page someone about right now?"),
    ("alice-oncall", "Any TLS or certificate problems in the logs?"),
    ("bob-dev", "Did the orders v2.14.0 rollout cause any of these errors?"),
    ("bob-dev", "How bad is the redis latency compared to threshold?"),
    ("demo-user", "Are the Stripe timeouts and checkout 502s the same incident?"),
]


def main() -> None:
    load_dotenv()
    rounds = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    resource_name = os.environ["AGENT_ENGINE_RESOURCE_NAME"]
    _, project, _, location = resource_name.split("/")[:4]

    import vertexai

    client = vertexai.Client(project=project, location=location)
    agent = client.agent_engines.get(name=resource_name)

    sessions: dict[str, str] = {}
    ok = failed = 0
    for _ in range(rounds):
        for user_id, message in QUERIES:
            if user_id not in sessions:
                s = agent.create_session(user_id=user_id)
                sessions[user_id] = s["id"] if isinstance(s, dict) else s.id
            try:
                chars = sum(
                    len(str(e))
                    for e in agent.stream_query(
                        user_id=user_id,
                        session_id=sessions[user_id],
                        message=message,
                    )
                )
                ok += 1
                print(f"ok   [{user_id}] {message[:48]}... ({chars} ev-chars)")
            except Exception as exc:  # noqa: BLE001 - keep driving traffic
                failed += 1
                print(f"FAIL [{user_id}] {message[:48]}... -> {exc}")

    print(f"\n{ok} succeeded, {failed} failed across {len(sessions)} sessions")


if __name__ == "__main__":
    main()
