# YogaOS — Architecture Decision Records (ADRs)

**Document Reference:** `docs/architecture/ARCHITECTURE_DECISIONS.md`  
**Version:** 1.0.0 (Architecture Decision Records — Phase P04)  
**Status:** Approved Technical Baseline  
**Role:** Principal Software Architect & Senior Cloud Solutions Engineer  

---

## Index of Architectural Decisions

* [ADR-001: Architectural Style — Modular Monolith over Microservices](#adr-001-architectural-style--modular-monolith-over-microservices)
* [ADR-002: Monorepo Orchestration — Turborepo with pnpm Workspaces](#adr-002-monorepo-orchestration--turborepo-with-pnpm-workspaces)
* [ADR-003: Backend Framework — NestJS with Fastify HTTP Platform](#adr-003-backend-framework--nestjs-with-fastify-http-platform)
* [ADR-004: Frontend Application Topology — Unified Responsive Web Application](#adr-004-frontend-application-topology--unified-responsive-web-application)
* [ADR-005: Multi-Tenancy Isolation Strategy — Shared Schema with Dual-Layer Defense](#adr-005-multi-tenancy-isolation-strategy--shared-schema-with-dual-layer-defense)
* [ADR-006: Identity Model — Global User Identity with Studio-Specific Memberships](#adr-006-identity-model--global-user-identity-with-studio-specific-memberships)
* [ADR-007: Student Entity Identity — Decoupled Internal UUID with Mutable Phone/Email](#adr-007-student-entity-identity--decoupled-internal-uuid-with-mutable-phoneemail)
* [ADR-008: Automated Class Conductor — Offline-First Execution with Wall-Clock State Machine](#adr-008-automated-class-conductor--offline-first-execution-with-wall-clock-state-machine)
* [ADR-009: Anti-Auto-Complete Protection for Interrupted Class Sessions](#adr-009-anti-auto-complete-protection-for-interrupted-class-sessions)
* [ADR-010: Background Processing & Queues — BullMQ on Redis](#adr-010-background-processing--queues--bullmq-on-redis)
* [ADR-011: Configurable Indian GST Tax Calculation Engine](#adr-011-configurable-indian-gst-tax-calculation-engine)
* [ADR-012: Student Health Data Privacy & Field-Level Encryption](#adr-012-student-health-data-privacy--field-level-encryption)
* [ADR-013: Cloud Deployment Architecture — AWS ECS Fargate over Kubernetes](#adr-013-cloud-deployment-architecture--aws-ecs-fargate-over-kubernetes)

---

### ADR-001: Architectural Style — Modular Monolith over Microservices
* **Status:** **APPROVED**
* **Context:** YogaOS V1 requires 21 interconnected domain modules covering multi-tenancy, scheduling, attendance, billing, and offline conductor sync. We must choose between a distributed microservices architecture or a modular monolith.
* **Decision:** Build YogaOS as a **Modular Monolith** in NestJS. The code is strictly separated into cohesive domain modules with in-process TypeScript interfaces and domain events, backed by a single PostgreSQL database and an independent background worker daemon.
* **Alternatives Considered:**
  * *Distributed Microservices:* Rejected due to severe operational complexity, distributed transaction failure modes, high AWS networking costs, and premature overhead for an early-stage SaaS product.
* **Consequences & Trade-offs:**
  * *Positive:* Ultra-fast development velocity, unified local testing, simple ACID database transactions across bookings and credits, zero network latency between modules.
  * *Negative:* Requires strict linting and code review discipline to prevent developers from making circular imports or cross-module direct table queries.

---

### ADR-002: Monorepo Orchestration — Turborepo with pnpm Workspaces
* **Status:** **APPROVED**
* **Context:** The project encompasses a web app (`apps/web`), an API server (`apps/api`), a background worker (`apps/workers`), and shared libraries for contracts, database, design system, permissions, and logger.
* **Decision:** Adopt **Turborepo** with **pnpm workspaces** (`pnpm 12.16.1` is already installed and verified on the host system).
* **Alternatives Considered:**
  * *Nx:* Feature-rich but heavier configuration overhead and steeper learning curve.
  * *Multi-Repo:* High maintenance friction; keeping contracts, Prisma types, and frontend DTOs in sync across multiple git repositories causes severe version drift.
* **Consequences & Trade-offs:**
  * *Positive:* Fast incremental builds, shared remote cache, atomic commits across contracts and API routes, strict dependency trees.
  * *Negative:* Monorepo tooling requires careful pipeline caching configuration on Windows and Linux CI runners.

---

### ADR-003: Backend Framework — NestJS with Fastify HTTP Platform
* **Status:** **APPROVED**
* **Context:** We need a robust TypeScript backend framework supporting dependency injection, modular organization, OpenAPI generation, and high HTTP request throughput.
* **Decision:** Use **NestJS** paired with the **`@nestjs/platform-fastify`** adapter.
* **Alternatives Considered:**
  * *Express:* The default NestJS platform, but delivers 50% lower throughput and higher memory footprint than Fastify.
  * *Pure Fastify / Hono:* High performance, but lacks the structured architectural dependency injection and module lifecycle conventions provided by NestJS.
* **Consequences & Trade-offs:**
  * *Positive:* 2x–3x higher requests per second, lower latency, native Fastify JSON schema compilation, excellent OpenAPI Swagger integration.
  * *Negative:* Minor differences with certain Express-only middlewares (e.g. cookie parsing, file uploads), which are cleanly solved using Fastify ecosystem plugins (`@fastify/cookie`, `@fastify/multipart`).

---

### ADR-004: Frontend Application Topology — Unified Responsive Web Application
* **Status:** **APPROVED**
* **Context:** The original high-level proposal contemplated separate applications: `studio-web`, `instructor-web`, `practitioner-app`, and `platform-admin`.
* **Decision:** For V1, build a **single unified responsive Next.js 15 web application** (`apps/web`). Role-Based Access Control (RBAC) dynamically renders Studio Owner dashboards, Front Desk check-in rosters, or the fullscreen Instructor Class Conductor interface based on the active user session.
* **Alternatives Considered:**
  * *Separate Next.js Apps (`apps/studio-web` and `apps/instructor-web`):* Creates duplicated UI boilerplate, dual deployment overhead, shared session cookie synchronization complexities, and double build times.
* **Consequences & Trade-offs:**
  * *Positive:* Single web deployment pipeline, shared design tokens and components, seamless role switching for studio owners who also teach classes.
  * *Negative:* Requires careful code-splitting and dynamic route imports so that heavy Conductor assets do not burden administrative dashboard bundles.

---

### ADR-005: Multi-Tenancy Isolation Strategy — Shared Schema with Dual-Layer Defense
* **Status:** **APPROVED**
* **Context:** YogaOS is a multi-tenant SaaS. We must prevent data leakage between competing yoga studios while keeping database operating costs affordable.
* **Decision:** Adopt a **Shared Schema with `tenant_id` Partitioning**, enforced via dual-layer defense in depth:
  1. *Layer 1 (Application):* Prisma Client Extension automatically injects `{ where: { tenantId } }` on all tenant-owned model operations.
  2. *Layer 2 (Database):* PostgreSQL Row-Level Security (RLS) policies configured on sensitive tables (`students`, `invoices`, `payments`, `health_disclaimers`) evaluating `current_setting('app.current_tenant_id')`.
* **Alternatives Considered:**
  * *Database-per-Tenant:* Cost prohibitive for hundreds of boutique studios; massive connection pool overhead.
  * *Schema-per-Tenant:* PostgreSQL connection bloat and slow migration execution across 100+ schemas.
* **Consequences & Trade-offs:**
  * *Positive:* Cost-efficient, single database connection pool, unified database migrations, airtight defense against developer error.
  * *Negative:* Requires `AsyncLocalStorage` context propagation to ensure every request context possesses a validated `tenantId`.

---

### ADR-006: Identity Model — Global User Identity with Studio-Specific Memberships
* **Status:** **APPROVED**
* **Context:** Certified yoga instructors in India frequently teach at multiple independent, non-affiliated studios. Forcing teachers to manage multiple email logins causes operational friction.
* **Decision:** Separate the human identity (`User`) from the studio organization membership (`OrganizationMember`). An instructor has **one global user account** and independent memberships, permissions, hourly rates, and schedules for each studio.
* **Alternatives Considered:**
  * *Studio-Scoped Users (No Global Identity):* Forces an instructor teaching at 3 studios to maintain 3 separate logins, 3 passwords, and duplicate asana sequences across studios.
* **Consequences & Trade-offs:**
  * *Positive:* Industry-leading teacher UX, easy context switching via top navigation, preserves individual teacher credentials.
  * *Negative:* Complex cross-tenant scheduling validations to ensure a teacher is not double-booked across two different studios at the same time.

---

### ADR-007: Student Entity Identity — Decoupled Internal UUID with Mutable Phone/Email
* **Status:** **APPROVED**
* **Context:** In India, mobile phone numbers (+91) are the primary everyday customer identifier. However, users frequently change SIM cards or port numbers.
* **Decision:** The canonical identity of a student is an immutable internal **UUIDv7 (`id`)**. Phone numbers and email addresses are mutable contact/login fields. Updating a student's phone number updates the record without breaking historical attendance, invoices, or class pass links.
* **Alternatives Considered:**
  * *Phone Number as Natural Primary Key:* Catastrophic failure mode if a student changes their mobile number, requiring cascading foreign key updates across thousands of historical attendance records and invoices.
* **Consequences & Trade-offs:**
  * *Positive:* Permanent referential integrity for accounting and auditing; seamless contact information updates.
  * *Negative:* Requires dedicated unique indexes with soft-delete filtering (`UNIQUE(tenant_id, mobile_phone) WHERE deleted_at IS NULL`).

---

### ADR-008: Automated Class Conductor — Offline-First Execution with Wall-Clock State Machine
* **Status:** **APPROVED**
* **Context:** Studio Wi-Fi connections can be erratic. A live yoga class cannot pause or fail because of network dropouts or browser timer throttling.
* **Decision:** The Conductor is architected as an **Offline-First Client State Machine**:
  1. *Pre-Download Verification:* All sequence media (audio, video, images) must be downloaded and verified via SHA-256 hashes in browser storage (IndexedDB + Cache API) before an offline class can begin.
  2. *Anti-Drift Timing Engine:* Uses wall-clock timestamps (`Date.now()` + `performance.now()`) inside a requestAnimationFrame loop, completely avoiding the cumulative drift of `setInterval`.
  3. *Idempotent Synchronization:* Offline execution events are saved locally with client-generated UUIDs and synchronized idempotently to `/api/v1/conductor/sessions/sync` once internet is restored.
* **Alternatives Considered:**
  * *Cloud-Streaming Conductor (Live WebSocket):* Unusable in real-world Indian studios due to intermittent cellular/Wi-Fi packet loss causing frozen videos and silent audio cues.
* **Consequences & Trade-offs:**
  * *Positive:* 100% resilient class execution; zero jitter or frozen timers; works during full network outages.
  * *Negative:* Requires local storage quota monitoring (`navigator.storage.estimate()`) and cache management logic on client devices.

---

### ADR-009: Anti-Auto-Complete Protection for Interrupted Class Sessions
* **Status:** **APPROVED**
* **Context:** If an instructor pauses a class to attend to an emergency or walks away from the studio screen, the system must not falsely report the class as completed.
* **Decision:** An interrupted or abandoned session is **NEVER** automatically marked as `COMPLETED`. If a paused session remains inactive beyond 30 minutes, it automatically transitions to **`INTERRUPTED_ABANDONED`**. Exact partial duration, completed steps, and skipped steps are preserved in an immutable log.
* **Alternatives Considered:**
  * *Auto-Complete on Timeout:* Distorts teacher attendance records, falsely inflates student practice statistics, and creates compliance liabilities.
* **Consequences & Trade-offs:**
  * *Positive:* 100% audit accuracy for studio operations and instructor payroll reconciliation.
  * *Negative:* Requires teachers who forgot to conclude a class to see an "Interrupted" banner and manually append an explanatory note if desired.

---

### ADR-010: Background Processing & Queues — BullMQ on Redis
* **Status:** **APPROVED**
* **Context:** Asynchronous operations (PDF invoice generation, WhatsApp messages, class pass expiration, waitlist promotions) must not block the Fastify HTTP request loop.
* **Decision:** Deploy **BullMQ** running on a managed **Redis 7** cluster, consumed by an independent NestJS worker daemon (`apps/workers`).
* **Alternatives Considered:**
  * *In-Memory Event Emitter:* Unreliable; in-memory jobs are lost if the API process restarts or scales down.
  * *AWS SQS + Lambda:* Solid, but increases local development complexity and requires separate local emulation (LocalStack) compared to running Redis locally via Docker.
* **Consequences & Trade-offs:**
  * *Positive:* Simple local development with Docker, robust exponential retry backoff, parent-child job workflows, active Redis cluster reuse for caching.
  * *Negative:* Requires maintaining a dedicated Redis instance and monitoring queue memory depth.

---

### ADR-011: Configurable Indian GST Tax Calculation Engine
* **Status:** **APPROVED**
* **Context:** Indian Goods and Services Tax (GST) rules vary depending on studio turnover (composition scheme vs regular registration) and location. We must not hardcode an unverified 18% assumption.
* **Decision:** Implement a **Rule-Based Configurable Tax Engine**. Studios configure their registration status, GSTIN, default tax rate (e.g. 18%, 12%, 5%, 0% exempt), and SAC codes. The engine dynamically evaluates `branch_state_code` vs `customer_state_code` to apply CGST+SGST (intra-state) or IGST (inter-state).
* **Alternatives Considered:**
  * *Hardcoded 18% GST on all sales:* Legally invalid for studios operating under tax-exempt thresholds or composition schemes.
* **Consequences & Trade-offs:**
  * *Positive:* Full statutory compliance for any studio size in India; seamless transition if government GST slabs change.
  * *Negative:* Requires studio owners to input their tax settings during onboarding.

---

### ADR-012: Student Health Data Privacy & Field-Level Encryption
* **Status:** **APPROVED**
* **Context:** Under India's DPDP Act 2023, student injury history, surgeries, and physical restrictions are sensitive personal data. Front-desk staff should not have unrestricted access to intimate health narratives.
* **Decision:** Implement **Role-Based Non-Clinical Redaction** and **Field-Level Encryption at Rest (AES-256-GCM)**:
  * Front desk staff see only a high-level non-clinical safety alert badge (`CAUTION: Physical Restriction Flagged`).
  * Assigned class instructors and studio managers have permission to view decrypted clinical narratives.
  * Explicit student consent timestamps and IP addresses are recorded on every submission.
* **Alternatives Considered:**
  * *Plaintext Storage in Student Profile:* Violates privacy best practices and exposes medical narratives to all front-desk receptionists and staff.
* **Consequences & Trade-offs:**
  * *Positive:* Strict regulatory compliance, protects student dignity, prevents non-clinical staff from gossiping about sensitive injuries.
  * *Negative:* Requires key management in AWS Secrets Manager and encryption/decryption overhead on health endpoints.

---

### ADR-013: Cloud Deployment Architecture — AWS ECS Fargate over Kubernetes
* **Status:** **APPROVED**
* **Context:** We need a scalable, reliable, highly available cloud deployment architecture for V1 that minimizes DevOps overhead.
* **Decision:** Deploy containerized workloads (`apps/api` and `apps/workers`) to **AWS ECS Fargate** behind an Application Load Balancer, paired with **AWS RDS PostgreSQL 16 (Multi-AZ)**, **AWS ElastiCache Redis 7**, and **CloudFront + S3**.
* **Alternatives Considered:**
  * *Kubernetes (EKS):* Massive operational overhead, complex ingress controllers, cluster maintenance costs, and steep cognitive load for an initial V1 platform.
  * *Pure Serverless (AWS Lambda):* Severe cold starts for NestJS Fastify and Prisma connection pool exhaustion challenges during traffic bursts.
* **Consequences & Trade-offs:**
  * *Positive:* Fully managed serverless containers, zero EC2 OS patching, automatic horizontal task scaling based on CPU/memory/queue depth, straightforward Terraform management.
  * *Negative:* Slightly higher compute cost than bare EC2 instances, but heavily offset by zero operational maintenance labor.

---
*End of Architecture Decision Records.*
