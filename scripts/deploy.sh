#!/usr/bin/env bash
# Deploy reinsai to the shared EC2 host.
#   1. rsync source to ~/reinsai
#   2. ensure .env.prod is on the host
#   3. docker-compose -f docker-compose.prod.yml up -d --build
#   4. health check
#
# Usage:
#   ./scripts/deploy.sh

set -euo pipefail

HOST="${REINSAI_SSH_HOST:-ec2-user@13.209.27.97}"
KEY="${REINSAI_SSH_KEY:-$HOME/.ssh/kbo-stats-key.pem}"

if [ ! -r "$KEY" ]; then
  echo "[ERROR] SSH key not readable at $KEY" >&2
  echo "        Set REINSAI_SSH_KEY or place key at \$HOME/.ssh/kbo-stats-key.pem" >&2
  exit 1
fi

SSH="ssh -i $KEY -o StrictHostKeyChecking=accept-new"
SCP="scp -i $KEY -o StrictHostKeyChecking=accept-new"
REMOTE_DIR="/home/ec2-user/reinsai"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -f ".env.prod" ]]; then
  echo "[ERROR] .env.prod missing. Populate it (POSTGRES_PASSWORD + GEMINI_API_KEY + any other secrets) first." >&2
  exit 1
fi

echo "==> [1/4] rsync source to $HOST:$REMOTE_DIR"
$SSH "$HOST" "mkdir -p $REMOTE_DIR"
rsync -az --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '__pycache__' \
  --exclude '.venv' \
  --exclude 'venv' \
  --exclude '.env' \
  --exclude '.env.prod' \
  --exclude '*.pyc' \
  --exclude '.pytest_cache' \
  --exclude 'test-results' \
  --exclude '.claude' \
  --exclude 'docs/superpowers' \
  --exclude 'reference' \
  --exclude '.DS_Store' \
  --exclude 'backend/logs' \
  --exclude 'weekly-data' \
  --exclude 'news-data' \
  --exclude 'ops-data' \
  --exclude '트레져러 & 인스보험중개' \
  --exclude '인스보험중개 계약 서류 양식' \
  --exclude '2026년 3월' \
  -e "ssh -i $KEY -o StrictHostKeyChecking=accept-new" \
  ./ "$HOST:$REMOTE_DIR/"

echo ""
echo "==> [2/4] copy .env.prod"
$SCP .env.prod "$HOST:$REMOTE_DIR/.env.prod"

echo ""
echo "==> [3/4] docker-compose up --build"
$SSH "$HOST" bash -s <<REMOTE
set -euo pipefail
cd $REMOTE_DIR
# Export POSTGRES_PASSWORD so docker-compose.prod.yml variable substitution works
set -a; source .env.prod; set +a
docker-compose -f docker-compose.prod.yml up -d --build
echo ""
docker-compose -f docker-compose.prod.yml ps
REMOTE

echo ""
echo "==> [4/4] Health check"
# Give services a beat to finish starting
sleep 5
set +e
echo "-- backend /api/health via EC2:5301 --"
$SSH "$HOST" "curl -sSf --max-time 10 http://127.0.0.1:5301/api/health" && echo "" || echo "(backend not healthy yet)"
echo "-- frontend via EC2:5300 --"
$SSH "$HOST" "curl -sSfo /dev/null -w 'HTTP %{http_code}\n' --max-time 10 http://127.0.0.1:5300/"
echo "-- public https://insightre.ai --"
curl -sSfo /dev/null -w "HTTP %{http_code}\n" --max-time 15 https://insightre.ai/ || echo "(public URL not yet live — DNS/TLS)"
set -e

echo ""
echo "Deploy finished."
