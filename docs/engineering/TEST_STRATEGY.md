# YogaOS — Comprehensive Test Strategy & Quality Gates

**Document Reference:** `docs/engineering/TEST_STRATEGY.md`  
**Version:** 1.0.0 (Testing Baseline — Phase P05)  
**Status:** Approved for Implementation Execution  
**Role:** Senior QA Architect & Technical Lead  

---

## 1. Testing Philosophy & Test Pyramid

YogaOS enforces a rigorous, multi-tiered testing strategy designed to catch defects early, guarantee multi-tenant data isolation, verify statutory tax calculations, and ensure the Automated Class Conductor operates reliably during complete network outages.

```
                   ┌─────────────────────────────┐
                   │   Playwright E2E Tests      │  Critical User Journeys
                   │       (~20 Core Scenarios)  │  (Multi-Role, In-Browser)
                   ├─────────────────────────────┤
                   │   API Integration Tests     │  HTTP Endpoints, RBAC,
                   │      (~150 Endpoints)       │  Tenant Isolation, Webhooks
                   ├─────────────────────────────┤
                   │   Domain Service Tests      │  GST Splits, Pass Deduction,
                   │      (~250 Unit/Integ)      │  Conductor FSM, Waitlist
                   ├─────────────────────────────┤
                   │   Contracts & Pure Unit     │  Zod Schemas, DTOs,
                   │      (~300 Fast Tests)      │  Utilities, Pure Logic
                   └─────────────────────────────┘
```

---

## 2. Testing Methodologies by Layer

### 2.1 Multi-Tenant Isolation Tests (Non-Negotiable Gate)
* **Objective:** Empirically prove that Tenant A cannot access, mutate, or detect the existence of Tenant B's data under any circumstance.
* **Test Architecture:**
  * Uses automated test fixtures spinning up two distinct organizations: `Tenant_Alpha` and `Tenant_Beta`.
  * **Direct ID Manipulation Test:** Requests originating from `Tenant_Alpha` providing a valid UUID belonging to `Tenant_Beta` must return `404 Not Found` (never `200` and never leak metadata).
  * **Prisma Extension Injection Verification:** Spy on database queries to ensure `WHERE "tenantId" = ...` is present in 100% of generated SQL queries on tenant-owned models.
  * **PostgreSQL RLS Verification:** Execute direct raw SQL queries with mismatched `app.current_tenant_id` to verify zero rows returned at the database layer.

### 2.2 Permissions & Multi-Studio Identity Tests
* **Multi-Studio Teacher Context Tests:** Verify that an instructor belonging to Studio 1 and Studio 2 can toggle contexts cleanly; verify that Studio 1 schedules, rosters, and financial records are completely invisible when acting within Studio 2.
* **RBAC Privilege Escalation Tests:** Verify that Receptionists cannot access financial analytics, alter class types, or publish sequences; verify that Managers cannot access Organization-wide owner settings.
* **Branch Scoping Tests:** Verify that a Manager scoped to Branch A receives `403 Forbidden` when attempting to modify schedules or rosters at Branch B.

### 2.3 Student Health Privacy Tests (DPDP Act Compliance)
* **Field-Level Encryption Test:** Inspect PostgreSQL database directly after student registration; verify that raw injury notes are stored strictly as encrypted ciphertext with an initialization vector (`health_notes_ciphertext`, `health_notes_iv`).
* **Non-Clinical Redaction Test:** Call `GET /api/v1/students/:id` as a Receptionist; assert that payload contains only `{ hasHealthAlert: true, alertBadgeText: "CAUTION: ..." }` and that the decrypted narrative string does not exist anywhere in the JSON response.
* **Clinical Access Test:** Call the same endpoint as the assigned class instructor; assert that the decrypted medical notes are present.

### 2.4 Configurable GST Tax & Invoicing Tests
* **Intra-State Split Test:** Studio Branch State = Karnataka (`29`), Student State = Karnataka (`29`), Tax Rate = 18%. Assert: CGST = 9.00%, SGST = 9.00%, IGST = 0.00%.
* **Inter-State Allocation Test:** Studio Branch State = Karnataka (`29`), Student State = Maharashtra (`27`), Tax Rate = 18%. Assert: CGST = 0.00%, SGST = 0.00%, IGST = 18.00%.
* **Composition / Exempt Studio Test:** Studio Tax Status = Exempt / Unregistered. Assert: Tax = 0.00%, Bill of Supply generated without tax split lines.
* **Sequential Numbering Invariant:** Generate 50 concurrent invoices; assert that sequence numbers (`INV/2026-27/0001` through `INV/2026-27/0050`) have zero collisions and zero gaps.

### 2.5 Automated Class Conductor Offline & Timing Tests
* **Wall-Clock Anti-Drift Test:** Run the Conductor state machine in an automated test environment for an accelerated 60-minute simulated session with CPU throttling enabled. Verify that the elapsed logical time precisely tracks real-world wall-clock time with <50ms accumulated drift.
* **Simulated Network Dropout Test:**
  1. Trigger sequence pre-download; verify all assets pass SHA-256 hash checks and mark `OFFLINE_READY`.
  2. Disconnect network (`page.setOfflineMode(true)` in Playwright).
  3. Execute class sequence: verify timers count down, audio triggers locally, pause/resume works, and `+30s` adjustment functions.
  4. Conclude session while still offline; verify full execution log is stored in IndexedDB.
  5. Re-enable network; verify idempotent background synchronization succeeds and server marks session `COMPLETED`.
* **Anti-Auto-Complete Timeout Test:** Pause a session; simulate 31 minutes of inactivity; verify session transitions to `INTERRUPTED_ABANDONED` and is **never** marked `COMPLETED`.
* **Browser Audio Autoplay Gate Test:** Verify that sound playback is prevented until the explicit "Initialize Audio & Start Session" user click occurs, avoiding browser autoplay rejection exceptions.

### 2.6 Concurrency & Booking Capacity Tests
* **Overbooking Prevention:** Configure a room with a capacity of 10. Fire 30 simultaneous booking requests using `Promise.all()`. Assert that exactly 10 succeed (`BOOKED`), and the remaining 20 are cleanly queued in the FIFO waitlist (`WAITING`) in sequential rank order.
* **Waitlist Auto-Promotion Test:** Cancel one of the 10 confirmed bookings; verify that Waitlist Rank #1 is automatically promoted to `BOOKED` and credit deducted.

---

## 3. Formal Quality Gates (Definition of Done)

Progressing between major implementation phases requires formal certification against the following empirical gates:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        YogaOS Quality Gates                            │
├─────────┬───────────────────────────┬──────────────────────────────────┤
│ Gate 1  │ Foundation Readiness      │ Monorepo builds cleanly;         │
│         │ (End of Phase 1)          │ local Postgres/Redis operational │
├─────────┼───────────────────────────┼──────────────────────────────────┤
│ Gate 2  │ Multi-Tenant Security     │ 100% tenant isolation tests pass;│
│         │ (End of Phase 2)          │ multi-studio switcher verified   │
├─────────┼───────────────────────────┼──────────────────────────────────┤
│ Gate 3  │ Core Operations           │ Rosters, batches, conflict checks│
│         │ (End of Phase 4)          │ & encrypted health privacy pass  │
├─────────┼───────────────────────────┼──────────────────────────────────┤
│ Gate 4  │ Commercial & Billing      │ GST calculations mathematically  │
│         │ (End of Phase 5)          │ exact; sequential invoices valid │
├─────────┼───────────────────────────┼──────────────────────────────────┤
│ Gate 5  │ Conductor Offline         │ Pre-download verified; 100%      │
│         │ (End of Phase 7)          │ offline execution; sync verified │
├─────────┼───────────────────────────┼──────────────────────────────────┤
│ Gate 6  │ Production Release        │ 20 Playwright E2E flows pass;    │
│         │ (End of Phase 8)          │ zero high/critical vulnerabilities│
└─────────┴───────────────────────────┴──────────────────────────────────┘
```

### Detailed Gate Thresholds

#### Gate 1: Foundation Readiness
- [ ] `pnpm build` passes with zero errors across all packages.
- [ ] `pnpm lint` and `pnpm format` pass with zero warnings.
- [ ] Local PostgreSQL 16 and Redis 7 start up via `docker-compose up -d` and pass connection pings.
- [ ] `@yogaos/contracts` exports validated Zod schemas.

#### Gate 2: Multi-Tenant Security & Identity
- [ ] Global user can register, log in, and receive secure JWT / session cookies.
- [ ] Organization membership invitations and role assignments verified.
- [ ] Dual-layer tenant isolation verified: 100% of cross-tenant query attempts return `404 Not Found`.
- [ ] Multi-studio instructor can switch organizations in under 200ms without data leakage.

#### Gate 3: Core Operations & Health Privacy
- [ ] Class types, rooms, and weekly recurring batches generate valid calendar instances.
- [ ] Cross-studio instructor double-booking conflict check blocks overlapping schedules.
- [ ] Student health disclaimer text verified encrypted in PostgreSQL via AES-256-GCM.
- [ ] Front desk check-in roster displays safety badge without medical narrative; instructor roster displays clinical notes.

#### Gate 4: Commercial & Billing Accuracy
- [ ] Membership passes decrement credits accurately upon check-in.
- [ ] CGST/SGST/IGST tax computations match statutory Indian tax slabs across all test combinations.
- [ ] Sequential invoice numbers increment monotonically with zero gaps or collisions.
- [ ] Membership freeze pauses credits and extends expiration date by exact calendar days.

#### Gate 5: Conductor Offline Resilience
- [ ] Sequence media downloads into IndexedDB/Cache API and validates SHA-256 checksums.
- [ ] Session executes 100% locally in simulated offline mode with zero timer drift.
- [ ] "Initialize Audio & Start Session" user gesture eliminates browser autoplay errors.
- [ ] Paused session abandoned for >30m transitions to `INTERRUPTED_ABANDONED` (NEVER `COMPLETED`).
- [ ] Queued offline execution events sync idempotently upon network reconnection.

#### Gate 6: Production Release Readiness
- [ ] 20 Playwright end-to-end browser scenarios execute successfully.
- [ ] Sub-second page load times on standard broadband connections.
- [ ] Conductor displays legible telemetry from 8 meters on 1080p studio displays.
- [ ] Zero high or critical security vulnerabilities detected via `pnpm audit`.

---
*End of Comprehensive Test Strategy & Quality Gates.*
