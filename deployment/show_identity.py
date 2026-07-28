"""Print the SPIFFE agent identity of a deployed Agent Engine instance.

Usage: python deployment/show_identity.py projects/P/locations/L/reasoningEngines/ID
"""

import os
import sys

from dotenv import load_dotenv


def main() -> None:
    load_dotenv()
    resource_name = sys.argv[1] if len(sys.argv) > 1 else os.environ["AGENT_ENGINE_RESOURCE_NAME"]
    _, project, _, location = resource_name.split("/")[:4]

    import vertexai

    client = vertexai.Client(
        project=project, location=location,
        http_options={"api_version": "v1beta1"},
    )
    engine = client.agent_engines.get(name=resource_name)
    spec = engine.api_resource.spec
    print(f"Resource:        {engine.api_resource.name}")
    print(f"Identity type:   {getattr(spec, 'identity_type', 'n/a')}")
    print(f"SPIFFE principal: {getattr(spec, 'effective_identity', 'n/a')}")
    gw = getattr(getattr(spec, "deployment_spec", None), "agent_gateway_config", None)
    print(f"Agent Gateway:   {gw or 'not attached'}")


if __name__ == "__main__":
    main()
