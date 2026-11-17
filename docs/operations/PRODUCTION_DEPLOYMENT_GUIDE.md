# YogaOS — Production Deployment & Operational Runbook

**Document Reference:** `docs/operations/PRODUCTION_DEPLOYMENT_GUIDE.md`  
**Version:** 1.0.0 (Release Hardening Baseline — Phase P20)  
**Status:** Approved for Production Operations  

---

## 1. Architecture & Topography

YogaOS is deployed as a modular containerized stack:

```
                      Internet Clients (Web / Tablet PWA)
                                      │
                                      ▼
                        Reverse Proxy (Nginx / Cloudflare)
                         SSL/TLS Termination (Port 443)
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
      Frontend App (Next.js 15)              API Server (NestJS / Fastify)
      Port 3000 / Internal Pod               Port 4000 / Internal Pod
                                                         │
                                  ┌──────────────────────┼──────────────────────┐
                                  ▼                      ▼                      ▼
                       PostgreSQL 16 Database      Redis 7 Daemon       Background Workers
                        Shared Multi-Tenant          Jobs & Cache      apps/workers (Billing)
```

---

## 2. Environment Configuration Matrix

All production secrets and runtime flags must be configured via environment variables or secret managers (AWS Secrets Manager, GCP Secret Manager, or Kubernetes Secrets).

| Variable Name | Required | Default / Example | Purpose |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Yes | `production` | Enables production optimizations, secure cookies, and strict HMAC validation. |
| `API_PORT` | No | `4000` | Port for the NestJS/Fastify API service. |
| `WEB_PORT` | No | `3000` | Port for the Next.js web application. |
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/yogaos_prod?schema=public` | Production PostgreSQL 16 connection URI. |
| `REDIS_HOST` | Yes | `redis` | Redis server hostname. |
| `REDIS_PORT` | No | `6379` | Redis server port. |
| `REDIS_PASSWORD`| No | `<secret>` | Redis auth password. |
| `JWT_SECRET` | Yes | `<secure_random_string_32_chars>` | Session token signing secret. |
| `ENCRYPTION_KEY`| Yes | `<secure_random_string_32_chars>` | AES-256-GCM medical health disclaimer encryption key. |
| `NEXT_PUBLIC_API_URL` | Yes | `https://api.yogaos.in/v1` | Publicly accessible API base URL. |
| `NEXT_PUBLIC_APP_URL` | Yes | `https://app.yogaos.in` | Publicly accessible Web app base URL. |
| `CORS_ALLOWED_ORIGINS`| Yes | `https://app.yogaos.in` | Comma-separated list of allowed web origins. |
| `LOG_LEVEL` | No | `info` | Logging verbosity (`fatal`, `error`, `warn`, `info`, `debug`). |

---

## 3. Deployment Procedure

### 3.1 Step 1: Database Migration Deployment
Always deploy database migrations before spinning up updated application containers:

```bash
# In CI/CD or bastion runner:
pnpm --filter @yogaos/database exec prisma migrate deploy
```

> [!IMPORTANT]
> Never run `prisma migrate dev` or `prisma db push` in production. `prisma migrate deploy` applies verified, committed migrations idempotently without resetting data.

### 3.2 Step 2: Build & Containerization

```bash
# Build monorepo packages
pnpm install --frozen-lockfile
pnpm build
```

Docker Compose production deployment:

```bash
# Pull and start services
docker compose -f infrastructure/docker/docker-compose.yml up -d --build
```

### 3.3 Step 3: Background Worker Startup

```bash
# Start worker daemon
pnpm --filter @yogaos/workers start
```

---

## 4. Health Checks & Observability

### 4.1 Health Check Endpoints
- **API Health:** `GET /v1/health`
  - Returns `200 OK` with database, memory, and uptime status:
  ```json
  {
    "status": "ok",
    "info": { "database": { "status": "up" } },
    "error": {},
    "details": { "database": { "status": "up" } }
  }
  ```
- **Web Health:** `GET /` (Static 200 response).
- **PostgreSQL Health:** `pg_isready -U yogaos -d yogaos_dev`
- **Redis Health:** `redis-cli ping`

### 4.2 Structured Logging & Auditing
- Logs are formatted in structured JSON via `@yogaos/logger` (Pino).
- Security events are stored synchronously in PostgreSQL `AuditLog`.

---

## 5. Rollback & Incident Response Runbook

### 5.1 Application Rollback
If a critical runtime defect is detected in a new release:
1. Revert container image tag to previous stable release tag in deployment configuration.
2. Trigger rolling restart: `docker compose restart api web`.
3. Confirm API `/v1/health` responds with `status: "ok"`.

### 5.2 Migration Rollback Guideline
- YogaOS migrations are additive and forward-compatible.
- If a migration must be reverted, author a compensating forward migration (e.g. `pnpm prisma migrate new`) rather than modifying applied historical migrations.
