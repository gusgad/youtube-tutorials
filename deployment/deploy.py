"""Deploy the log triage agent to Vertex AI Agent Engine (Agent Runtime).

Enterprise features:
  - Agent Identity (SPIFFE): on by default; disable with --no-identity
    (requires the project to belong to a Google Cloud organization).
  - Memory Bank: the ADK runtime template uses Vertex AI Memory Bank on the
    same Agent Engine instance by default — no extra config needed.
  - Agent Gateway: pass --gateway GATEWAY_NAME to route egress traffic
    through an existing Agent Gateway in the same project/region.

Usage:
  python deployment/deploy.py [--no-identity] [--gateway NAME] [--display-name NAME]
"""

import argparse
import os
import sys

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# google-adk must stay <2.0: the Agent Engine ADK template passes the numeric
# engine ID as app_name, which ADK 2.x's App name validation rejects.
REQUIREMENTS = [
    "google-adk>=1.19.0,<2.0.0",
    "cloudpickle>=3.0",
    "google-cloud-aiplatform[adk,agent_engines]>=1.128.0,<2.0.0",
    "google-genai>=1.52.0,<2.0.0",
    "pydantic>=2.10.6,<3.0.0",
    "opentelemetry-exporter-gcp-trace",
]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-identity", action="store_true",
                        help="Deploy without Agent Identity (e.g. project has no organization)")
    parser.add_argument("--gateway", default=os.getenv("AGENT_GATEWAY_NAME"),
                        help="Agent Gateway name to route egress traffic through")
    parser.add_argument("--display-name", default="log-triage-agent")
    args = parser.parse_args()

    load_dotenv()
    project = os.environ["GOOGLE_CLOUD_PROJECT"]
    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
    bucket = os.environ["GOOGLE_CLOUD_STORAGE_BUCKET"]

    import vertexai
    from vertexai import types
    from vertexai.agent_engines import AdkApp

    from log_triage_agent.agent import root_agent

    app = AdkApp(agent=root_agent, enable_tracing=True)

    # v1beta1 is only needed for identity_type / agent_gateway_config;
    # plain deploys use the GA surface.
    needs_beta = not args.no_identity or bool(args.gateway)
    client = vertexai.Client(
        project=project,
        location=location,
        http_options={"api_version": "v1beta1" if needs_beta else "v1"},
    )

    config: dict = {
        "display_name": args.display_name,
        "description": root_agent.description,
        "requirements": REQUIREMENTS,
        "extra_packages": ["./log_triage_agent"],
        "staging_bucket": f"gs://{bucket}",
    }

    if not args.no_identity:
        config["identity_type"] = types.IdentityType.AGENT_IDENTITY

    if args.gateway:
        config["agent_gateway_config"] = {
            "agent_to_anywhere_config": {
                "agent_gateway": (
                    f"projects/{project}/locations/{location}"
                    f"/agentGateways/{args.gateway}"
                )
            }
        }

    print(f"Deploying to {project}/{location} "
          f"(identity={'AGENT_IDENTITY' if not args.no_identity else 'off'}, "
          f"gateway={args.gateway or 'none'}) ...")

    remote_agent = client.agent_engines.create(agent=app, config=config)

    resource = remote_agent.api_resource
    print(f"\n✅ Deployed: {resource.name}")

    spec = getattr(resource, "spec", None)
    identity = getattr(spec, "effective_identity", None) if spec else None
    if args.no_identity:
        print(f"Runs as the default Vertex service agent: {identity or 'n/a'}")
    elif identity:
        print(f"🔐 Agent Identity (SPIFFE principal): {identity}")
        print("\nGrant it the roles it needs, e.g.:")
        print(f"  bash deployment/grant_agent_iam.sh '{identity}'")
    else:
        print("⚠️  effective_identity not present on the response; "
              "fetch it later via deployment/show_identity.py")

    engine_id = resource.name.split("/")[-1]
    print(f"\nMemory Bank lives on this same Agent Engine instance (id {engine_id}).")
    print(f"Test it:  python deployment/test_remote.py {resource.name}")


if __name__ == "__main__":
    main()
