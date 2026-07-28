"""Attach the Agent Gateway to the deployed engine (egress mode).

Uses the documented SDK update path: gateway config + the token-sharing env
var must be set together, and the SDK requires the agent payload whenever
env_vars change.

Usage: python deployment/attach_gateway.py
"""

import os
import sys

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from deploy import REQUIREMENTS  # noqa: E402


def main() -> None:
    load_dotenv()
    name = os.environ["AGENT_ENGINE_RESOURCE_NAME"]
    project = os.environ["GOOGLE_CLOUD_PROJECT"]
    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
    bucket = os.environ["GOOGLE_CLOUD_STORAGE_BUCKET"]
    gateway = os.environ.get("AGENT_GATEWAY_NAME", "log-triage-gw")

    import vertexai
    from vertexai.agent_engines import AdkApp

    from log_triage_agent.agent import root_agent

    client = vertexai.Client(
        project=project, location=location,
        http_options={"api_version": "v1beta1"},
    )
    app = AdkApp(agent=root_agent, enable_tracing=True)
    updated = client.agent_engines.update(
        name=name,
        agent=app,
        config={
            "display_name": "log-triage-agent-id",
            "requirements": REQUIREMENTS,
            "extra_packages": ["./log_triage_agent"],
            "staging_bucket": f"gs://{bucket}",
            "agent_gateway_config": {
                "agent_to_anywhere_config": {
                    "agent_gateway": (
                        f"projects/{project}/locations/{location}"
                        f"/agentGateways/{gateway}"
                    )
                }
            },
            "env_vars": {
                "GOOGLE_API_PREVENT_AGENT_TOKEN_SHARING_FOR_GCP_SERVICES": "False",
            },
        },
    )
    print("UPDATE OK:", updated.api_resource.name)


if __name__ == "__main__":
    main()
