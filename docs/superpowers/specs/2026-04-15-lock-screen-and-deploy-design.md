# Lock Screen + insightre.ai Deployment

Date: 2026-04-15

## Goal

1. Add a client-side lock screen that gates the entire app behind a simple password ("reins"), with a glassmorphism Framer Motion unlock animation.
2. Deploy the reinsai application to `insightre.ai` on the shared EC2 host `13.209.27.97` (same host as kbo-stats/kpop100), reusing the existing Postgres 16 and Redis instances to save disk.

## Out of Scope

- Server-side auth or user accounts (this is a demo gate, not a security boundary).
- CI/CD automation (deploy is a local script, run manually).
- Multi-environment staging (only production on EC2).

## Frontend: Lock Screen

**Files:**
- `frontend/src/components/LockGate.tsx` — wrapper placed in `app/layout.tsx`. On mount, checks `localStorage.getItem("reinsai_unlocked")`. If set, renders `{children}` directly. Otherwise renders `<LockScreen onUnlock={...}>` alongside a blurred `{children}`.
- `frontend/src/components/LockScreen.tsx` — full-screen overlay UI:
  - `backdrop-blur-xl bg-slate-900/40`
  - Centered glass card: `bg-white/10 border border-white/20 rounded-2xl p-8`, lock icon (lucide-react) + "InsightRe AI" title + subtext + password input + submit button.
  - Accepts password `"reins"` (constant in source).
  - On correct entry: set localStorage flag, animate blur→0, overlay opacity→0, card scale 1→1.05 and fade over 1.2s. Then unmount overlay.
  - On wrong entry: shake card `x: [0,-8,8,-8,8,0]` 300ms, show red error text.
  - Enter key submits.

**Dependencies added:** `framer-motion`, `lucide-react` (verify lucide not already present).

**Integration:** `app/layout.tsx` wraps `<div className="flex min-h-screen">…</div>` body content inside `<LockGate>`.

## Backend / DB

No backend changes. reinsai will reuse the kbo-stats Postgres 16 container on EC2 (`127.0.0.1:5432`). A new role `reinsai` and database `reinsai` will be created. Redis is shared directly (single-tenant usage, but use key prefix `reinsai:` going forward — follow-up, not blocking deploy).

## Deployment Architecture

**Host:** `ec2-user@13.209.27.97` (Amazon Linux 2023), SSH key at `/Users/ted/s-project/kbo-stats/kbo-stats-key.pem`.

**Ports (host-side):**
- frontend (Next.js): `5300:3000`
- backend (FastAPI): `5301:8000`
- worker: no exposed port

**Postgres/Redis:** shared with kbo-stats. Containers bind to `127.0.0.1:5432` / `127.0.0.1:6379`. reinsai containers reach them via `host.docker.internal` (Docker `extra_hosts: host.docker.internal:host-gateway` — same pattern kbo-stats uses).

**Files on EC2:** `/home/ec2-user/reinsai/`

**`docker-compose.prod.yml`** (new, at repo root):
```yaml
services:
  backend:
    build: ./backend
    ports: ["5301:8000"]
    env_file: .env
    environment:
      - DATABASE_URL=postgresql+asyncpg://reinsai:${POSTGRES_PASSWORD}@host.docker.internal:5432/reinsai
      - REDIS_URL=redis://host.docker.internal:6379/1
    extra_hosts: ["host.docker.internal:host-gateway"]
    restart: unless-stopped

  worker:
    build: ./backend
    command: python -m app.worker
    env_file: .env
    environment: (same DATABASE_URL / REDIS_URL as backend)
    extra_hosts: ["host.docker.internal:host-gateway"]
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports: ["5300:3000"]
    environment:
      - NEXT_PUBLIC_API_URL=https://insightre.ai/api
    restart: unless-stopped
```

**`frontend/Dockerfile`:** verify there's a production multi-stage build (NEXT standalone output). If current Dockerfile is dev-only, add a prod stage.

**Nginx** (`/etc/nginx/conf.d/insightre.conf` on host):
```
server {
  server_name insightre.ai www.insightre.ai;
  client_max_body_size 50M;

  location /api/ {
    proxy_pass http://127.0.0.1:5301/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
  }

  location / {
    proxy_pass http://127.0.0.1:5300;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  listen 80;
}
```
Then `sudo certbot --nginx -d insightre.ai -d www.insightre.ai` adds TLS.

**DNS:** insightre.ai A records (`@` and `www`) pointed to `13.209.27.97`. Provider TBD — ask user during DNS step.

## Scripts

**`scripts/ec2-bootstrap.sh`** — one-time EC2 prep:
1. Disk cleanup: `docker system prune -af --volumes`, `sudo journalctl --vacuum-time=3d`, report free space before/after.
2. Create Postgres role/db (idempotent `CREATE ROLE … IF NOT EXISTS` pattern via `DO $$` block).
3. Copy nginx config into `/etc/nginx/conf.d/` and reload.
4. Run certbot if not already issued.

**`scripts/deploy.sh`** — repeatable deploy:
1. `rsync -az --delete --exclude node_modules --exclude .next --exclude __pycache__ --exclude .git --exclude .venv ./ ec2-user@13.209.27.97:~/reinsai/`
2. SSH: `cd ~/reinsai && docker-compose -f docker-compose.prod.yml up -d --build`
3. SSH: `docker-compose -f docker-compose.prod.yml ps`
4. Local: curl `https://insightre.ai/` and `https://insightre.ai/api/health` for basic health check.

`.env` is transferred once via separate `scp` (not in rsync; contains secrets).

## Risk / Mitigation

- **Disk (currently 2.3GB free)**: prune before building. If still insufficient, user will extend EBS volume to 60GB via AWS console.
- **Memory (850MB free + 1.4GB swap)**: adding 3 containers is tight. Monitor with `docker stats` after deploy. If OOM, nextjs build is the largest; consider building image locally and pushing a tarball via `docker save/load` instead of building on EC2.
- **Shared postgres**: any DB migration in reinsai affects only the `reinsai` database, isolated from kbo-stats. But a postgres crash takes down all three apps — acceptable for now given demo stage.
- **Port conflicts**: 5300/5301 verified unused (only 5100-5201 taken).

## Success Criteria

- Loading https://insightre.ai shows the lock screen with blurred dashboard behind.
- Entering "reins" animates the unlock and reveals the dashboard.
- localStorage flag persists across refresh.
- `/api/*` proxies to FastAPI, backend responds.
- `./scripts/deploy.sh` can be re-run to push updates without manual intervention.
