# YogaOS — Local Development & Environment Setup Guide

**Document Reference:** `docs/engineering/DEVELOPMENT_SETUP.md`  
**Version:** 1.0.0 (Engineering Baseline — Phase P06)  
**Status:** Approved for Local Engineering  

---

## 1. System Requirements

* **Operating System:** Windows 10/11, macOS (Apple Silicon or Intel), or Linux (Ubuntu 22.04+).
* **Node.js:** `>= 20.0.0` (LTS 20/22 or Node 24).
* **pnpm:** `12.x` or `9.x+` (`corepack enable` or `npm install -g pnpm`).
* **Docker Desktop / Docker Engine:** Required for containerized PostgreSQL 16 and Redis 7.

---

## 2. Workspace Initialization

### Step 1: Environment Configuration
Copy the provided `.env.example` into a local `.env`:
```bash
cp .env.example .env
```
The default values in `.env.example` are preconfigured to connect to the local Docker Compose PostgreSQL and Redis instances on standard ports (5432 and 6379).

### Step 2: Install Monorepo Dependencies
```bash
pnpm install
```
This resolves workspace symlinks for all packages (`@yogaos/config`, `@yogaos/contracts`, `@yogaos/database`, `@yogaos/logger`, `@yogaos/permissions`, `@yogaos/ui`, `@yogaos/api-client`) across `apps/web`, `apps/api`, and `apps/workers`.

### Step 3: Start Local Backing Infrastructure
```bash
pnpm docker:up
```
This runs `docker compose -f infrastructure/docker/docker-compose.yml up -d` starting:
* `yogaos-postgres`: PostgreSQL 16 on port `5432` with healthcheck.
* `yogaos-redis`: Redis 7 on port `6379` with healthcheck.

To stop the containers:
```bash
pnpm docker:down
```

### Step 4: Generate Prisma Client
```bash
pnpm db:generate
```
Generates the typed `@prisma/client` from `packages/database/prisma/schema.prisma`.

---

## 3. Running Applications

### Start All Services Concurrently
```bash
pnpm dev
```
Turborepo orchestrates parallel execution:
* `apps/web`: Next.js web portal on `http://localhost:3000`
* `apps/api`: NestJS Fastify API on `http://localhost:4000/v1`
* `apps/workers`: Background worker daemon on console

### Start Individual Workspaces
* Run API only: `pnpm --filter @yogaos/api dev`
* Run Web only: `pnpm --filter @yogaos/web dev`
* Run Workers only: `pnpm --filter @yogaos/workers dev`

---

## 4. Verification & Testing

### Workspace Health Checks
* **API Health Endpoint:**
  ```bash
  curl http://localhost:4000/v1/health
  ```
  Expected Response:
  ```json
  {
    "status": "ok",
    "version": "1.0.0",
    "services": {
      "database": "connected"
    }
  }
  ```

### Build & Linting Verification
* Type check all workspaces: `pnpm typecheck`
* Lint all workspaces: `pnpm lint`
* Production build: `pnpm build`
