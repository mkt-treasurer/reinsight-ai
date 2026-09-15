#!/usr/bin/env bash
# One-time EC2 host setup for insightre.ai.
# Run this locally; it SSHs to the shared EC2 and performs:
#   1. Disk / docker cleanup
#   2. Provision reinsai postgres role + database (idempotent)
#   3. Install the nginx site and reload
#   4. Obtain TLS cert via certbot (--nginx)
#
# Pre-reqs:
#   - insightre.ai (A and optional CNAME www) must already point to the EC2 IP
#   - .env.prod exists locally with POSTGRES_PASSWORD (for the new reinsai role)
#   - deploy/nginx.insightre.conf committed
#
# Usage:
#   ./scripts/ec2-bootstrap.sh

set -euo pipefail

HOST="ec2-user@13.209.27.97"
KEY="/Users/ted/s-project/kbo-stats/kbo-stats-key.pem"
SSH="ssh -i $KEY -o StrictHostKeyChecking=accept-new"
SCP="scp -i $KEY -o StrictHostKeyChecking=accept-new"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! -f "$REPO_ROOT/.env.prod" ]]; then
  echo "[ERROR] $REPO_ROOT/.env.prod not found. Create it with POSTGRES_PASSWORD and other secrets first." >&2
  exit 1
fi
# shellcheck disable=SC1091
set -a; source "$REPO_ROOT/.env.prod"; set +a
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set in .env.prod}"

echo "==> [1/4] Disk + docker cleanup on EC2"
$SSH "$HOST" bash -s <<'REMOTE'
set -euo pipefail
echo "Before cleanup:"
df -h / | tail -1
echo "--- docker system prune ---"
docker system prune -af --volumes || true
echo "--- journalctl vacuum ---"
sudo journalctl --vacuum-time=3d || true
echo "After cleanup:"
df -h / | tail -1
echo "Memory:"
free -h
REMOTE

echo ""
echo "==> [2/4] Provision Postgres role/database"
# Use the kbo-stats-postgres container as superuser.
$SSH "$HOST" bash -s <<REMOTE
set -euo pipefail
PGC="kbo-stats-postgres-1"
PGSUPER="kbo"  # superuser on the shared kbo-stats postgres
echo "Using postgres container: \$PGC (superuser: \$PGSUPER)"
docker exec -i "\$PGC" psql -U "\$PGSUPER" -d postgres <<SQL
DO \\\$\\\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reinsai') THEN
    CREATE ROLE reinsai LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  ELSE
    ALTER ROLE reinsai WITH LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  END IF;
END
\\\$\\\$;
SQL
# Create the database outside the DO block (CREATE DATABASE cannot run in a transaction)
docker exec -i "\$PGC" psql -U "\$PGSUPER" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'reinsai'" \
  | grep -q 1 \
  || docker exec -i "\$PGC" psql -U "\$PGSUPER" -d postgres -c "CREATE DATABASE reinsai OWNER reinsai"
echo "postgres provisioning done"
REMOTE

echo ""
echo "==> [3/4] Install nginx site config"
$SCP "$REPO_ROOT/deploy/nginx.insightre.conf" "$HOST:/tmp/insightre.conf"
$SSH "$HOST" bash -s <<'REMOTE'
set -euo pipefail
sudo mv /tmp/insightre.conf /etc/nginx/conf.d/insightre.conf
sudo nginx -t
sudo systemctl reload nginx
echo "nginx config loaded"
REMOTE

echo ""
echo "==> [4/4] certbot --nginx (TLS)"
$SSH "$HOST" bash -s <<'REMOTE'
set -euo pipefail
if ! command -v certbot >/dev/null; then
  sudo dnf install -y certbot python3-certbot-nginx || sudo yum install -y certbot python3-certbot-nginx
fi
# Run non-interactively. If cert already exists, --keep avoids re-issue.
sudo certbot --nginx --non-interactive --agree-tos \
  --email admin@insightre.ai \
  -d insightre.ai -d www.insightre.ai \
  --keep-until-expiring --redirect || {
    echo "[WARN] certbot failed — DNS may not be propagated yet, or www subdomain missing. Re-run later." >&2
  }
REMOTE

echo ""
echo "Bootstrap finished. Next step: ./scripts/deploy.sh"
