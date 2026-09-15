#!/usr/bin/env bash
# SSH tunnel from local -> EC2 for postgres/redis (shared kbo-stats instances).
# Local ports: 7700 (postgres), 7703 (redis) -> remote 127.0.0.1:5432 / 6379
# Auto-reconnects when connection drops.
#
# Run this in a terminal and leave it open while working locally.

KEY="${REINSAI_SSH_KEY:-$HOME/.ssh/kbo-stats-key.pem}"
HOST="${REINSAI_SSH_HOST:-ec2-user@13.209.27.97}"

if [ ! -r "$KEY" ]; then
  echo "Error: SSH key not found at $KEY"
  echo "Set REINSAI_SSH_KEY env var or place key at \$HOME/.ssh/kbo-stats-key.pem"
  exit 1
fi

while true; do
  echo "[$(date)] Starting SSH tunnel (reinsai -> EC2)..."
  ssh -i "$KEY" -N \
    -L 7700:127.0.0.1:5432 \
    -L 7703:127.0.0.1:6379 \
    -o ServerAliveInterval=15 \
    -o ServerAliveCountMax=3 \
    -o ExitOnForwardFailure=yes \
    -o ConnectTimeout=10 \
    "$HOST"
  echo "[$(date)] Tunnel disconnected. Reconnecting in 3s..."
  sleep 3
done
