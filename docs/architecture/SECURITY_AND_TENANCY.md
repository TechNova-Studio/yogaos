# YogaOS — Security, Multi-Tenancy & Privacy Architecture

**Document Reference:** `docs/architecture/SECURITY_AND_TENANCY.md`  
**Version:** 1.0.0 (Security Architecture Baseline — Phase P04)  
**Status:** Approved for Implementation Planning  
**Role:** Principal Security Architect & Senior Cloud Solutions Engineer  

---

## 1. Global Identity & Multi-Studio Tenancy Model

### 1.1 Decoupled Identity Architecture
YogaOS strictly separates human authentication identity from tenant organization authorization:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   Global User Record                                   │
│                        (id: UUID, email: string, phone: string)                        │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ 1 : N Relationships
                      ┌─────────────────────┴─────────────────────┐
                      ▼                                           ▼
       ┌───────────────────────────────┐           ┌───────────────────────────────┐
       │   OrganizationMember (Org A)  │           │   OrganizationMember (Org B)  │
       │   - tenantId: Org_A_UUID      │           │   - tenantId: Org_B_UUID      │
       │   - role: INSTRUCTOR          │           │   - role: INSTRUCTOR          │
       │   - branchScope: [Branch_1]   │           │   - branchScope: [Branch_Central] │
       │   - status: ACTIVE            │           │   - status: ACTIVE            │
       └───────────────────────────────┘           └───────────────────────────────┘
```

* **Global User (`users`):** Represents the person. Contains global credentials (email, hashed password, phone, full name). Does not contain studio-specific permissions or data.
* **Studio Membership (`organization_members`):** Binds the user to a specific studio organization tenant. Contains the studio role (`OWNER`, `MANAGER`, `INSTRUCTOR`, `RECEPTIONIST`), status, and physical branch restrictions.
* **Studio Context Switching:** 
  1. A multi-studio instructor authenticates once with their global credentials, receiving a signed JWT or session cookie.
  2. The client provides the active studio identifier via the `X-Tenant-ID` HTTP header on all subsequent API requests.
  3. The backend middleware verifies that the authenticated user possesses an `ACTIVE` membership in that specified `tenant_id`. If invalid, the request is immediately rejected with `403 Forbidden`.

---

## 2. Multi-Tenant Data Isolation Strategy

### 2.1 Multi-Tenancy Pattern Evaluation

| Architectural Pattern | Isolation Level | Infrastructure Cost | Operational Complexity | YogaOS Decision |
| :--- | :---: | :---: | :---: | :--- |
| **Database-per-Tenant** | Highest | Prohibitive (hundreds of DB instances) | Extreme (schema migrations across hundreds of DBs) | **Rejected:** Overkill for boutique yoga studios; excessive cost. |
| **Schema-per-Tenant** | High | High connection pool overhead | High (Postgres connection/DDL limits, migration drift) | **Rejected:** Schema bloat on Postgres beyond 50+ studios. |
| **Shared Schema with `tenant_id` + RLS** | **Enterprise Grade** | **Optimal** (shared RDS cluster) | **Low** (single migration pipeline, unified pool) | **SELECTED:** Enforced via dual-layer defense in depth. |

### 2.2 Dual-Layer Defense in Depth
To guarantee absolute tenant data isolation, YogaOS implements two independent layers of enforcement:

```
Layer 1: Application-Level Enforcement (Prisma Client Extension)
         Automatically intercepts all find, create, update, delete queries
         and injects { where: { tenantId } } from AsyncLocalStorage context.
                           │
                           ▼
Layer 2: Database-Level Enforcement (PostgreSQL Row-Level Security)
         Postgres RLS policies evaluate current_setting('app.current_tenant_id')
         Blocking queries that cross tenant boundaries even if ORM logic fails.
```

#### Layer 1: Prisma Client Extension (`packages/database`)
```typescript
// Conceptual architecture pattern for tenant isolation extension
export const tenantIsolationExtension = (clsService: ClsService) => {
  return Prisma.defineExtension({
    name: 'tenantIsolation',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const tenantId = clsService.get('tenantId');
          if (isTenantOwnedModel(model)) {
            if (!tenantId) {
              throw new SecurityException('Tenant context missing on tenant-owned query');
            }
            // Auto-inject tenantId into query filter
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        },
      },
    },
  });
};
```

#### Layer 2: PostgreSQL Row-Level Security (RLS)
For critical tables (`students`, `tax_invoices`, `payment_transactions`, `student_health_disclaimers`), RLS is enabled:
```sql
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON "students"
FOR ALL
USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
```

### 2.3 Cross-Tenant Prevention Test Strategy
The test suite in `apps/api/test/security/tenant-isolation.spec.ts` enforces non-negotiable security gates in CI/CD:
1. **Direct Query Penetration Test:** Verify that User A (Tenant A) querying `/api/v1/students/:id` belonging to Tenant B receives `404 Not Found` (never `200` and never leak existence).
2. **Batch Modification Attack:** Verify that update or delete operations on student or billing records silently affect zero rows if an attacker manipulates the target ID to belong to another tenant.
3. **Cross-Tenant Sequence Sharing:** Verify that draft sequences from Studio A cannot be read or linked by instructors in Studio B unless explicitly published as a public platform template.

---

## 3. Role-Based Access Control (RBAC) & Permission Matrix

### 3.1 Role Hierarchy & Evaluation
YogaOS enforces 4 predefined roles with strict hierarchical privilege escalation:

$$\text{OWNER} \succ \text{MANAGER} \succ \text{INSTRUCTOR} \succ \text{RECEPTIONIST}$$

* **Branch Scoping Rule:** A user's role can be scoped to specific branches (e.g. Manager of "Indiranagar" branch only). If scoped, the authorization guard verifies `request.branchId IN user.branchScope`.

### 3.2 Granular Permissions Matrix

| Functional Module | Permission Name | OWNER | MANAGER | INSTRUCTOR | RECEPTIONIST |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Organization & Branches** | `org:manage` | **ALLOW** | DENY | DENY | DENY |
| | `branch:manage` | **ALLOW** | Branch Scope | DENY | DENY |
| **Staff & Roles** | `staff:invite` | **ALLOW** | DENY | DENY | DENY |
| | `staff:view` | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** |
| **Students & CRM** | `student:create` | **ALLOW** | **ALLOW** | DENY | **ALLOW** |
| | `student:edit_profile`| **ALLOW** | **ALLOW** | DENY | **ALLOW** |
| | `student:health_view` | **ALLOW** | **ALLOW** | **Assigned Classes Only** | **CAUTION Badge Only** |
| **Classes & Batches** | `classes:manage_types`| **ALLOW** | **ALLOW** | DENY | DENY |
| | `schedule:create` | **ALLOW** | Branch Scope | DENY | DENY |
| | `schedule:substitute` | **ALLOW** | Branch Scope | Own Classes | DENY |
| **Bookings & Attendance** | `booking:create` | **ALLOW** | **ALLOW** | DENY | **ALLOW** |
| | `attendance:check_in` | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** |
| **Memberships & Passes**| `membership:create_plan`| **ALLOW** | DENY | DENY | DENY |
| | `membership:assign` | **ALLOW** | **ALLOW** | DENY | **ALLOW** |
| | `membership:freeze` | **ALLOW** | **ALLOW** | DENY | DENY |
| **Billing & Invoicing** | `billing:record_payment`| **ALLOW** | **ALLOW** | DENY | **ALLOW** |
| | `billing:view_financials`| **ALLOW** | Branch Scope | DENY | Shift Cash Only |
| | `billing:issue_refund`| **ALLOW** | **ALLOW** | DENY | DENY |
| **Asanas & Sequences** | `asana:manage` | **ALLOW** | **ALLOW** | **ALLOW** | DENY |
| | `sequence:create_edit`| **ALLOW** | **ALLOW** | **ALLOW** | DENY |
| **Conductor Execution** | `conductor:launch` | **ALLOW** | **ALLOW** | **ALLOW** | DENY |
| | `conductor:sync_offline`| **ALLOW** | **ALLOW** | **ALLOW** | DENY |

---

## 4. Student Health Data Privacy & DPDP Act 2023 Compliance

### 4.1 Legal & Ethical Principles
Under India's Digital Personal Data Protection (DPDP) Act 2023, student self-reported physical conditions, past injuries, surgeries, and pregnancy notes are classified as **Sensitive Personal Data**. YogaOS guarantees three technical protections:

1. **Explicit Consent Ledger:** Every health disclaimer entry logs the student's affirmative consent, timestamp (`consent_timestamp`), and system version.
2. **Right to Erasure / Redaction:** Students can request the complete erasure of their health disclaimer record without impacting their membership or billing history.
3. **Purpose Limitation:** Health data is used strictly for physical injury prevention on the yoga mat.

### 4.2 Non-Clinical Redaction Boundary
To prevent front-desk staff or unassigned personnel from viewing intimate medical narratives:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              API Health Redaction Layer                                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Caller: Front Desk Staff / Receptionist                                                │
│ Output: {                                                                              │
│   "hasHealthAlert": true,                                                              │
│   "alertBadge": "CAUTION: Physical Restriction Flagged"                                │
│ }                                                                                      │
│ (Raw clinical narrative text is completely STRIPPED from response payload)            │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Caller: Assigned Class Instructor / Studio Manager                                     │
│ Output: {                                                                              │
│   "hasHealthAlert": true,                                                              │
│   "injurySummary": "L4-L5 Lumbar Disc Herniation, Right Wrist Sprain",                 │
│   "healthNotes": "Avoid full wheel and high load inversions. Requires block support."  │
│ }                                                                                      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Field-Level Encryption at Rest
Detailed clinical narratives are encrypted at the application layer prior to database insertion:
* **Algorithm:** AES-256-GCM (Authenticated Encryption with Associated Data).
* **Key Derivation:** Tenant-specific data encryption key (DEK) derived via HKDF from the master key stored in AWS Secrets Manager.
* **Storage:** `health_notes_ciphertext` + `health_notes_iv` in `student_health_disclaimers`.

---

## 5. Financial, Payment & Webhook Security

### 5.1 PCI-DSS Scope Reduction
YogaOS **never** ingests, transmits, or stores raw payment card numbers (PANs) or CVVs on its servers:
* Online payments are conducted via **Razorpay Standard Checkout** or **Stripe Hosted Checkout**.
* The YogaOS backend receives only tokenized transaction identifiers and Webhook events.
* In V1, manual offline payment records (`UPI`, Cash, Card POS) record only the bank UTR or terminal receipt number.

### 5.2 Webhook Signature & Replay Attack Defense
Incoming webhooks from Razorpay or Stripe are processed under strict cryptographic safeguards:
1. **Raw Body Cryptographic Verification:** Webhook request signatures (`X-Razorpay-Signature` / `Stripe-Signature`) are computed against the raw, unparsed HTTP request body using HMAC-SHA256.
2. **Replay Attack Window:** Webhooks with a timestamp older than 300 seconds are rejected.
3. **Idempotency Queue:** Every webhook event ID is recorded in Redis (`SET webhook:{id} 1 EX 86400 NX`). If the key already exists, the request returns `200 OK` immediately without duplicate processing.

---

## 6. Audit Logging & Compliance Trails

Every state-altering and sensitive access operation writes an immutable record to the `audit_logs` table:
* **Captured Events:** `HEALTH_DATA_DECRYPTED`, `STUDENT_PROFILE_ACCESSED`, `INVOICE_GENERATED`, `PAYMENT_RECORDED`, `MEMBERSHIP_FROZEN`, `STAFF_ROLE_MODIFIED`.
* **Captured Metadata:** `tenant_id`, `user_id`, `ip_address`, `user_agent`, `timestamp`, `resource_type`, `resource_id`, and `diff_summary` (JSONB).
* **Storage Guarantee:** Audit logs cannot be updated or deleted by any API route or tenant role; access is append-only.

---
*End of Security, Multi-Tenancy & Privacy Architecture.*
