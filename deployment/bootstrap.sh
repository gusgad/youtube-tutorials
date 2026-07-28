#!/usr/bin/env bash
# One-shot project bootstrap + deploy. Run AFTER:
#   gcloud auth login && gcloud auth application-default login
# Usage: bash deployment/bootstrap.sh PROJECT_ID [REGION]
set -euo pipefail

PROJECT="${1:?Usage: bootstrap.sh PROJECT_ID [REGION]}"
REGION="${2:-us-central1}"
BUCKET="${PROJECT}-log-triage-staging"

gcloud config set project "$PROJECT"
echo "== Enabling core APIs =="
gcloud services enable aiplatform.googleapis.com storage.googleapis.com \
  cloudresourcemanager.googleapis.com --project "$PROJECT"

echo "== Creating staging bucket gs://$BUCKET (if missing) =="
gcloud storage buckets create "gs://$BUCKET" --location="$REGION" \
  --project="$PROJECT" 2>/dev/null || echo "(bucket exists — continuing)"

cat > .env <<EOF
GOOGLE_GENAI_USE_VERTEXAI=True
GOOGLE_CLOUD_PROJECT=$PROJECT
GOOGLE_CLOUD_LOCATION=$REGION
GOOGLE_CLOUD_STORAGE_BUCKET=$BUCKET
AGENT_GATEWAY_NAME=log-triage-gateway
EOF
echo "Wrote .env"

# Agent Identity needs a GCP organization; fall back automatically if absent.
if gcloud projects describe "$PROJECT" --format="value(parent.type)" 2>/dev/null | grep -q organization; then
  echo "== Org detected: deploying WITH Agent Identity =="
  uv run python deployment/deploy.py
else
  echo "== No organization on this project: deploying WITHOUT Agent Identity =="
  echo "   (SPIFFE identity + Agent Gateway need an org-owned project)"
  uv run python deployment/deploy.py --no-identity
fi
