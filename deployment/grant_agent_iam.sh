#!/usr/bin/env bash
# Grant the deployed agent's SPIFFE identity the minimum roles it needs.
# Usage: bash deployment/grant_agent_iam.sh "principal://agents.global.org-.../reasoningEngines/ID"
set -euo pipefail

PRINCIPAL="${1:?Usage: grant_agent_iam.sh PRINCIPAL_IDENTIFIER}"
case "$PRINCIPAL" in principal://*) ;; *) PRINCIPAL="principal://$PRINCIPAL" ;; esac
PROJECT="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project)}"

# The agent starts with ZERO permissions — that's the point of Agent Identity.
# aiplatform.user      -> call Gemini models, Sessions, and Memory Bank
# serviceUsageConsumer -> consume API quota in the project
# cloudtrace.agent / logging.logWriter -> export spans and logs
for ROLE in roles/aiplatform.user roles/serviceusage.serviceUsageConsumer \
            roles/cloudtrace.agent roles/logging.logWriter; do
  echo "Granting $ROLE ..."
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="$PRINCIPAL" \
    --role="$ROLE" \
    --condition=None >/dev/null
done

echo "Done. IAM propagation takes ~1 minute."
