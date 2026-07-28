# Project context for Gemini CLI

This is a log-triage AI agent built with Google ADK, deployed to Vertex AI
Agent Engine with Agent Identity (SPIFFE), Memory Bank, and Agent Gateway.

- Agent code: `log_triage_agent/` (`agent.py` defines `root_agent`; `tools.py`
  has deterministic log parsing tools; `sample_logs/` has demo data).
- Deployment: `deployment/deploy.py` (flags: `--no-identity`, `--gateway`).
- Gateway setup: `deployment/gateway/setup_gateway.sh`.
- Env: `.env` (copy from `.env.example`).

Common commands:
- `uv run adk web` — local dev UI
- `uv run adk run log_triage_agent` — local CLI chat
- `uv run python deployment/deploy.py` — deploy to Agent Engine
- `uv run python deployment/test_remote.py <resource>` — query deployed agent

Python is managed by uv (3.10–3.12 required; do not use system 3.14).
