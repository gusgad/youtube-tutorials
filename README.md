# Log Triage Agent — ADK + Gemini Enterprise Agent Platform demo

An SRE log-triage agent built with **Google's Agent Development Kit (ADK)** and
deployed to **Vertex AI Agent Engine (Agent Runtime)**, demonstrating three
Gemini Enterprise platform features:

| Feature | Where |
|---|---|
| **Agent Identity (SPIFFE)** | `deployment/deploy.py` — `identity_type: AGENT_IDENTITY`; the agent gets a zero-permission SPIFFE principal (`principal://agents.global.org-…/reasoningEngines/…`) you grant roles to via `deployment/grant_agent_iam.sh` |
| **Memory Bank** | `log_triage_agent/agent.py` — `PreloadMemoryTool` recalls past incidents; on Agent Runtime the ADK template uses the same instance's Memory Bank automatically |
| **Agent Gateway** | `deployment/gateway/` — egress (Agent-to-Anywhere) gateway; attach at deploy time with `--gateway` |

The agent loads logs (bundled `sample_logs/app.log` or `LOG_DIR`), pre-digests
them with deterministic tools (`tools.py`), and produces a P1/P2/P3 triage
report with root causes and remediation, remembering recurring incidents
across sessions.

## Local development

```bash
uv sync                       # installs deps into .venv (Python 3.10–3.12)
cp .env.example .env          # fill in project / region / bucket
gcloud auth application-default login
uv run adk web                # browser UI — pick log_triage_agent
# or: uv run adk run log_triage_agent
```

To use real Memory Bank locally (instead of in-memory), point ADK at an Agent
Engine instance:

```bash
uv run adk web --memory_service_uri="agentengine://AGENT_ENGINE_ID"
```

You can also drive development with **Gemini CLI** (`gemini` in this
directory) — `GEMINI.md` gives it project context.

## Deploy

```bash
# one-time project setup
gcloud services enable aiplatform.googleapis.com storage.googleapis.com
gsutil mb -l us-central1 gs://YOUR_STAGING_BUCKET

uv run python deployment/deploy.py                      # identity on, no gateway
uv run python deployment/deploy.py --no-identity        # if project has no GCP organization
bash deployment/gateway/setup_gateway.sh                # create gateway + registry (org needed)
uv run python deployment/deploy.py --gateway log-triage-gateway
```

After deploy, grant the printed SPIFFE principal its (minimal) roles:

```bash
bash deployment/grant_agent_iam.sh "principal://agents.global.org-…"
uv run python deployment/test_remote.py projects/…/reasoningEngines/…
uv run python deployment/show_identity.py projects/…/reasoningEngines/…
```

## Caveats

- **Agent Identity and Agent Gateway require the project to belong to a Google
  Cloud organization** (the SPIFFE trust domain is `agents.global.org-ORG_ID.system.id.goog`).
  On a personal (no-org) project, deploy with `--no-identity` — everything else works.
- Both features are Preview and need the `v1beta1` API (already set in `deploy.py`).
- Registering the deployed agent into a **Gemini Enterprise** app additionally
  requires a Gemini Enterprise subscription; the agent is then added from
  Agent Engine via the Gemini Enterprise admin console.
