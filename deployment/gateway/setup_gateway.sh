#!/usr/bin/env bash
# Create the Agent Gateway (egress mode) + Agent Registry for the log triage agent.
# Prereqs: gcloud authenticated; GOOGLE_CLOUD_PROJECT / GOOGLE_CLOUD_LOCATION set (or .env loaded).
set -euo pipefail

PROJECT="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project)}"
LOCATION="${GOOGLE_CLOUD_LOCATION:-us-central1}"
GATEWAY_NAME="${AGENT_GATEWAY_NAME:-log-triage-gateway}"
REGISTRY_NAME="log-triage-registry"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "== Enabling required APIs on $PROJECT =="
gcloud services enable \
  compute.googleapis.com \
  networksecurity.googleapis.com \
  networkservices.googleapis.com \
  dns.googleapis.com \
  iam.googleapis.com \
  agentregistry.googleapis.com \
  aiplatform.googleapis.com \
  modelarmor.googleapis.com \
  --project "$PROJECT"

echo "== Creating Agent Registry ($REGISTRY_NAME) =="
gcloud beta agent-registry registries create "$REGISTRY_NAME" \
  --location="$LOCATION" --project="$PROJECT" 2>/dev/null \
  || echo "(registry may already exist — continuing)"

echo "== Importing Agent Gateway ($GATEWAY_NAME, egress mode) =="
sed -e "s/PROJECT_ID/$PROJECT/g" -e "s/LOCATION/$LOCATION/g" \
  -e "s/^name: .*/name: $GATEWAY_NAME/" \
  "$DIR/agent-gateway-egress.yaml" > "$DIR/.gateway-rendered.yaml"

gcloud network-services agent-gateways import "$GATEWAY_NAME" \
  --source="$DIR/.gateway-rendered.yaml" \
  --location="$LOCATION" \
  --project="$PROJECT"

echo "Gateway ready: projects/$PROJECT/locations/$LOCATION/agentGateways/$GATEWAY_NAME"
echo "Deploy the agent through it:  python deployment/deploy.py --gateway $GATEWAY_NAME"
