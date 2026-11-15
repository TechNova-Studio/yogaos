# YogaOS — Studio Management & Automated Class Conductor

YogaOS is an India-first, globally extensible SaaS platform for yoga studios, wellness centers, and certified yoga instructors. It combines studio management operations (scheduling, batch planning, student CRM, memberships, and configurable GST invoicing) with a proprietary, deterministic, offline-first **Automated Class Conductor**.

---

## 1. Quick Start

### Prerequisites
* **Node.js:** `>= 20.0.0` (Tested on Node `v24.19.0`)
* **Package Manager:** `pnpm >= 9.x` (Tested on `pnpm 12.16.1`)
* **Docker & Docker Compose:** For running local PostgreSQL 16 & Redis 7

### Installation & Local Setup

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd yoga-studio-management
   ```

2. **Copy environment variables:**
   ```bash
   cp .env.example .env
   ```

3. **Install workspace dependencies:**
   ```bash
   pnpm install
   ```

4. **Start local backing services (PostgreSQL & Redis):**
   ```bash
   pnpm docker:up
   ```

5. **Generate Prisma Client:**
   ```bash
   pnpm db:generate
   ```

6. **Start local development servers:**
   ```bash
   pnpm dev
   ```

* **Web Portal:** [http://localhost:3000](http://localhost:3000)
* **API Gateway:** [http://localhost:4000/v1](http://localhost:4000/v1)
* **Health Endpoint:** [http://localhost:4000/v1/health](http://localhost:4000/v1/health)

---

## 2. Monorepo Structure

```text
├── apps/
│   ├── web/                    # Next.js 15 App Router web application
│   ├── api/                    # NestJS Fastify REST API engine
│   └── workers/                # Background worker daemon (BullMQ + Redis)
├── packages/
│   ├── contracts/              # Shared Zod schemas, DTOs & API types
│   ├── database/               # Prisma ORM client & database migrations
│   ├── ui/                     # Design system (Tailwind + Radix / shadcn)
│   ├── logger/                 # Structured Pino logger with OpenTelemetry
│   ├── config/                 # Zod-validated environment configurations
│   ├── permissions/            # RBAC roles, permission matrix & guards
│   └── api-client/             # Typed API client library
├── infrastructure/
│   └── docker/                 # Local Docker Compose setup (Postgres 16 + Redis 7)
└── docs/                       # Product, Architecture, and Engineering documentation
```

---

## 3. Core Commands

| Command | Action |
| :--- | :--- |
| `pnpm build` | Build all applications and packages via Turborepo |
| `pnpm dev` | Start all applications concurrently in development mode |
| `pnpm typecheck` | Run TypeScript type checks across all workspaces |
| `pnpm lint` | Run code quality linters |
| `pnpm db:generate` | Generate typed Prisma client |
| `pnpm docker:up` | Launch local PostgreSQL & Redis containers |
| `pnpm docker:down` | Stop local backing containers |

---

## 4. Documentation Links

* [Master PRD](docs/product/MASTER_PRD.md)
* [Feature Catalog (42 P0 Features)](docs/product/FEATURE_CATALOG.md)
* [System Architecture](docs/architecture/SYSTEM_ARCHITECTURE.md)
* [Database Architecture](docs/architecture/DATABASE_ARCHITECTURE.md)
* [Security & Tenancy](docs/architecture/SECURITY_AND_TENANCY.md)
* [Architecture Decision Records (ADRs)](docs/architecture/ARCHITECTURE_DECISIONS.md)
* [Engineering Roadmap](docs/engineering/DEVELOPMENT_ROADMAP.md)
* [Local Setup Guide](docs/engineering/DEVELOPMENT_SETUP.md)
