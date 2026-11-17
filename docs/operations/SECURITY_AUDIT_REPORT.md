# YogaOS — Comprehensive Security Audit & Hardening Report

**Document Reference:** `docs/operations/SECURITY_AUDIT_REPORT.md`  
**Version:** 1.0.0 (Release Hardening Baseline — Phase P20)  
**Status:** Approved for Production Readiness  
**Target Release:** YogaOS v1.0.0-rc  

---

## 1. Executive Summary

This Security Audit and Hardening Report documents the comprehensive review and active penetration defenses implemented for the YogaOS multi-tenant studio management platform. The audit examined all layers: authentication, session lifecycle, multi-tenant boundaries, role-based and branch-level authorization, AES-256-GCM health data encryption, payment gateway signature verification, input validation, rate limiting, and HTTP security headers.

All confirmed vulnerabilities were resolved in P20. The system enforces strict defense-in-depth across database, API, and client runtime layers.

---

## 2. Authentication & Session Security

### 2.1 Password Security & Credential Storage
- **Algorithm:** Passwords are never stored in plaintext. Passwords are salted and hashed using `bcrypt` (10 salt rounds) via `CryptoService.hashPassword`.
- **Credential Storage:** User credentials are decoupled into dedicated `UserCredential` records referencing `User`, supporting future credential rotations and multi-factor authentication.
- **Production Guard:** Default fallback development keys are strictly prohibited. In production (`NODE_ENV=production`), `CryptoService` throws an unhandled bootstrap exception if `ENCRYPTION_KEY` or `JWT_SECRET` is missing or set to dev defaults.

### 2.2 Session Lifecycle & Revocation
- **Session Tokens:** Cryptographically random 32-byte tokens (`crypto.randomBytes(32).toString('hex')`).
- **Storage:** Only the SHA-256 digest (`tokenHash`) is persisted in the PostgreSQL `Session` table. A compromised database dump cannot be used to forge sessions without recovering the raw token.
- **Expiration & Revocation:** Sessions expire automatically after 7 days (`expiresAt`). Active logouts mark `revokedAt = NOW()`. `AuthGuard` queries ensure revoked or expired sessions are rejected immediately with `401 Unauthorized`.
- **Cookie Security:** Web cookies (`yogaos_session`) are flagged with `HttpOnly = true`, `SameSite = 'lax'`, and `Secure = true` when running in production.

### 2.3 Brute-Force Rate Limiting
- **Protection:** Sensitive routes (`/auth/login`, `/auth/register`, `/auth/switch-tenant`) are protected by `RateLimitGuard`.
- **Threshold:** Sliding-window rate limit of 30 requests per 60 seconds per IP.
- **Behavior:** Exceeding requests trigger `HTTP 429 Too Many Requests` with a calculated `Retry-After: <seconds>` header.

---

## 3. Multi-Tenancy & Authorization

### 3.1 Global Identity vs Studio Organization
- Users have a single global identity (`User`), but multiple studio affiliations (`OrganizationMember`).
- `AuthGuard` inspects the active session tenant or client header (`X-Tenant-ID`).
- **Spoofing Prevention:** If a client requests a `tenantId` where their membership is non-existent, suspended, or not in `ACTIVE` status, the request is immediately rejected with `403 Forbidden` (`TENANT_SWITCH_DENIED` logged to audit).

### 3.2 Role-Based Access Control (RBAC)
- Roles enforced: `OWNER`, `MANAGER`, `INSTRUCTOR`, `RECEPTIONIST`.
- **Receptionist Boundaries:** Receptionists are strictly restricted to front-desk operational workflows (check-in, class schedule, student caution badges). Raw clinical health notes, diagnostic narratives, and financial analytics (revenue, monthly totals) are filtered and nullified.
- **Instructor Boundaries:** Instructors are scoped strictly to their assigned class sessions and sequence builder tools. Instructors cannot inspect cross-teacher rosters, billing invoices, or tax records.
- **Owner & Manager Boundaries:** Full operational and commercial governance, financial reporting, and studio configuration.

### 3.3 Database Tenant Isolation
- Every tenant-scoped entity (`Student`, `ClassSessionInstance`, `TaxInvoice`, `PaymentTransaction`, `Sequence`, `ConductorSession`) contains a foreign-keyed `tenantId`.
- Every service query explicitly injects `{ where: { tenantId } }` preventing cross-tenant leakage. Verified by automated multi-tenant isolation test suites.

---

## 4. Student Health Data Privacy & Medical Encryption

### 4.1 Cryptographic Storage (AES-256-GCM)
- Clinical medical history, physical restriction narratives, and injury notes are encrypted at rest using AES-256-GCM authenticated encryption.
- **Key Derivation:** SHA-256 derived key from `ENCRYPTION_KEY`.
- **IV & Tag:** A unique 12-byte initialization vector (`healthNotesIv`) is generated per record. The 16-byte authentication tag (`healthNotesTag`) guarantees ciphertext integrity.
- **Additional Authenticated Data (AAD):** The studio's `tenantId` is bound as AAD during encryption and decryption, preventing cross-tenant ciphertext transplanting.

### 4.2 Front-Desk Redaction & Access Audit
- Receptionist queries strip `healthDisclaimerDetails` to `null` while exposing only non-clinical caution flags (`hasHealthAlert: true`, `cautionBadge: 'Physical Restriction Flagged'`).
- Authorized access by instructors or managers logs `STUDENT_HEALTH_ACCESSED` to `AuditLog` without recording sensitive health text in log storage.

---

## 5. Webhook Security & Payment Gateways

### 5.1 Cryptographic Signature Verification
- **Razorpay:** Timing-safe HMAC SHA-256 verification (`crypto.timingSafeEqual`) against tenant-configured `webhookSecret`.
- **Stripe:** Timing-safe comparison of `v1` signatures with strict 300-second timestamp freshness validation to prevent replay attacks.
- **Production Hardening:** Synthetic test signatures (`test_sandbox_signature`, `mock_valid_signature`) are rejected with `401 Unauthorized` in production environments.

### 5.2 Idempotency & Replay Protection
- `WebhookEvent` enforces a unique constraint on `[provider, eventId]`. Duplicate webhook deliveries return `{ duplicate: true }` without re-executing payment side effects.
- Payment checkout requests enforce unique `[tenantId, idempotencyKey]` preventing duplicate student charges under network re-submissions.

---

## 6. HTTP & API Hardening

- **Security Headers:** Fastify `onSend` hook injects:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 0`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- **CORS Protection:** Configurable via `CORS_ALLOWED_ORIGINS` and `NEXT_PUBLIC_APP_URL` in production; wildcard origins prohibited.
- **Error Sanitization:** `HttpExceptionFilter` prevents database internal errors, table names, or stack traces from leaking on HTTP 500 errors in production, returning sanitized `Internal server error`.
- **Validation:** Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, and Zod contract parsing on every mutation.

---

## 7. Audit Logging & Non-Repudiation

- High-impact events are captured synchronously in PostgreSQL `AuditLog`:
  - `AUTH_REGISTER`, `AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAILED`, `AUTH_LOGOUT`
  - `TENANT_SWITCH_SUCCESS`, `TENANT_SWITCH_DENIED`
  - `STUDENT_HEALTH_ACCESSED`, `STUDENT_HEALTH_UPDATED`
  - `INVOICE_ISSUED`, `PAYMENT_RECORDED`, `REFUND_PROCESSED`
  - `CONDUCTOR_SESSION_INITIALIZED`, `CONDUCTOR_ACTION_*`, `CONDUCTOR_EVENTS_SYNCED`
- Audit records store immutable timestamps, actor `userId`, `tenantId`, `ipAddress`, and `userAgent`.

---

## 8. Unresolved Risks & External Dependencies

| Risk Item | Severity | Mitigation & Action Required |
| :--- | :---: | :--- |
| **Cloud WAF & DDoS** | Medium | YogaOS API runs behind reverse proxies (Nginx/Cloudflare). Rate-limiting is in-memory; enterprise deployments must enable Cloudflare WAF/DDoS protection at the DNS edge. |
| **Storage Bucket Isolation** | Medium | S3/GCS media bucket policies must enforce private object ACLs with presigned GET/PUT URLs for client media uploads. |
| **SMS/WhatsApp Gateway Credentials** | Low | Production SMS/WhatsApp API keys must be loaded exclusively via environment variables or secret managers (AWS Secrets Manager / Vault). |
