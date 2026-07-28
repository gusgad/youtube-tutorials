#!/usr/bin/env bash
# Register the Google endpoints an Agent Runtime agent needs in Agent Registry
# and grant the agent's SPIFFE principal egress access through Agent Gateway.
# Usage: allowlist_endpoints.sh PRINCIPAL_IDENTIFIER
set -euo pipefail

PRINCIPAL="${1:?Usage: allowlist_endpoints.sh PRINCIPAL_IDENTIFIER}"
case "$PRINCIPAL" in principal://*) ;; *) PRINCIPAL="principal://$PRINCIPAL" ;; esac
PROJECT="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project)}"
REGION="${GOOGLE_CLOUD_LOCATION:-us-central1}"

# Endpoints required by the runtime itself: traces, logs, and the Vertex AI
# regional API (Gemini calls, Sessions, Memory Bank) — plus mTLS variants,
# since the Google-managed gateway uses mTLS egress.
declare -a NAMES=(allow-telemetry allow-telemetry-mtls allow-logging
                  allow-logging-mtls allow-aiplatform allow-aiplatform-mtls)
declare -a URLS=(
  "https://telemetry.googleapis.com"
  "https://telemetry.mtls.googleapis.com"
  "https://logging.googleapis.com"
  "https://logging.mtls.googleapis.com"
  "https://${REGION}-aiplatform.googleapis.com"
  "https://${REGION}-aiplatform.mtls.googleapis.com"
)

for i in "${!NAMES[@]}"; do
  echo "== Registering ${NAMES[$i]} -> ${URLS[$i]}"
  gcloud agent-registry services create "${NAMES[$i]}" \
    --project="$PROJECT" --location="$REGION" \
    --display-name="${NAMES[$i]}" \
    --endpoint-spec-type=no-spec \
    --interfaces="url=${URLS[$i]},protocolBinding=http-json" 2>&1 \
    | tail -1 || echo "(may already exist — continuing)"
done

echo "== Projected endpoints:"
gcloud agent-registry endpoints list --project="$PROJECT" --location="$REGION" \
  --format="value(name)" | tee /tmp/agent-endpoints.txt

echo "== Granting roles/iap.egressor to agent principal on each endpoint"
while read -r EP; do
  EP_ID="${EP##*/}"
  gcloud iap web add-iam-policy-binding \
    --resource-type=agent-registry \
    --endpoint="$EP_ID" \
    --region="$REGION" \
    --project="$PROJECT" \
    --member="$PRINCIPAL" \
    --role=roles/iap.egressor >/dev/null \
    && echo "  ok: $EP_ID"
done < /tmp/agent-endpoints.txt

echo "Done. Retry the gateway attach after ~1 minute of IAM propagation."
