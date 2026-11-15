# YogaOS — Master Product Requirements Document (PRD)

**Document Reference:** `docs/product/MASTER_PRD.md`  
**Version:** 1.1.0 (V1 Baseline Finalization — Phase P03)  
**Status:** Approved Technical Baseline  
**Author:** Senior Product Architect & Technical Product Manager  
**Target Release:** YogaOS V1.0 (Core Studio Operations + Automated Class Conductor)  

---

## 1. Executive Summary & Product Vision

### 1.1 Product Vision
**YogaOS** is an India-first, globally extensible SaaS operating system purpose-built for independent yoga studios, multi-branch wellness centers, yoga academies, and professional yoga teachers.

Unlike generic gym management platforms that treat activities merely as equipment bookings or open-floor access, YogaOS is tailored to the authentic, sequence-driven nature of yoga practice. It unifies administrative business operations (multi-branch tenancy, scheduling, batch management, student CRM, membership passes, and configurable GST invoicing) with a proprietary, deterministic **Automated Class Conductor** capable of reliable offline execution.

The Automated Class Conductor enables yoga instructors to curate structured, multi-step practice sequences in advance—integrating high-definition recorded video demonstrations, static anatomical/alignment images, synchronized voice instructions, configurable timers, repetition counters, and rest intervals. During class execution, the system guides the room deterministically while the human instructor retains complete physical control to pause, adjust, demonstrate, and provide hands-on posture corrections.

### 1.2 Core Product Pillars
1. **Studio Operations & Multi-Branch Management:** Multi-tenant organization hierarchies, branch-level resource allocation, global instructor identity with studio-specific memberships, student lifecycle management, attendance, and financial tracking.
2. **Automated Class Conductor (Offline-First):** A deterministic, teacher-controlled in-studio execution engine orchestrating verified pre-downloaded media, audio cues, timers, and breath intervals without relying on runtime AI, cloud streaming, or complex 3D graphics.
3. **Asana & Sequence Library:** A structured repository of classical yoga postures (with Sanskrit IAST and English nomenclature, anatomical focus, difficulty levels, and non-medicalized contraindications) coupled with an intuitive sequence builder.
4. **India-First, Global-Ready Commerce:** Configurable tax rules supporting Indian Goods and Services Tax (GST) compliance, multi-mode payment recording (UPI, Cash, Card, Net Banking), and WhatsApp-oriented communication workflows, built on clean multi-currency and timezone foundations for global extensibility.

---

## 2. Target Customers, Market & Positioning

### 2.1 Target Customer Segments

| Customer Segment | Description | Key Operational Pain Points | YogaOS Value Proposition |
| :--- | :--- | :--- | :--- |
| **Independent Studio Owners** | Single-location boutique yoga studios (1–3 studios, 50–300 active students). | Manual WhatsApp scheduling, cash/UPI tracking spreadsheets, repetitive vocal cueing causing instructor burnout. | Consolidated admin dashboard, automated batch management, deterministic class player freeing teachers to adjust posture. |
| **Multi-Branch Yoga Businesses** | Multi-location regional chains (2–10 branches, centralized management). | Lack of cross-branch roster visibility, fragmented instructor scheduling, inconsistent class quality across branches. | Multi-tenant organization hierarchy, branch-level access control, centralized sequence standardization. |
| **Yoga Schools & Academies** | Formal institutes offering teacher training, structured Hatha/Ashtanga courses. | Inflexible class pack models, inability to standardize curriculum sequences, paper-based attendance. | Strict batch progression, standardized reusable asana sequences, granular attendance tracking. |
| **Independent & Traveling Instructors** | Certified teachers conducting classes across multiple independent studios. | Managing multiple logins, fragmented teaching schedules, losing personal sequences when switching studios. | Single global instructor account, multi-studio workspace switcher, personal sequence library. |

### 2.2 Market Context & India-First Foundations
* **Currency & Payments:** Default currency is INR (₹). Support for domestic payment collection workflows (UPI UTR tracking, net banking, cards, manual cash/bank transfer reconciliation).
* **Taxation & Compliance:** Configurable tax settings supporting Indian GST compliance (CGST/SGST/IGST splits, SAC 9992, configurable rates e.g. 18%, 12%, 5%, or tax-exempt status), customizable per organization and branch.
* **Communication Channel:** Communication defaults prioritize WhatsApp notifications and SMS alongside transactional email, aligning with Indian consumer behavior.
* **Language & Terminology:** English as primary UI language; asana taxonomy strictly maintains dual Sanskrit (Devanagari & IAST transliteration) and English standard names.

---

## 3. Explicit Boundaries & Established Constraints

To preserve implementation velocity, operational reliability, and student physical safety, the following constraints are strictly enforced:

1. **No 3D Avatars or 3D Graphics:** No Three.js, React Three Fiber, WebGL character engines, or GLB animation systems. Visual media is strictly 2D (teacher-uploaded recorded videos and high-resolution static images).
2. **Deterministic Live Execution:** The Automated Class Conductor must execute sequences strictly according to instructor-configured timers, media timestamps, and step rules. No live AI model may make autonomous runtime decisions, alter sequences on the fly, or control playback.
3. **Human Instructor Supremacy:** Automated class execution is an operational aid, never an autonomous replacement for a qualified human teacher. The instructor maintains continuous manual override (pause, resume, skip, rewind, abort).
4. **No Medical Claims or Autonomous Diagnostics:** Asana benefits, modifications, and contraindications are informational guidelines. The platform does not diagnose medical conditions, prescribe therapeutic treatments, or claim curative outcomes.
5. **No False Completion on Abandoned Sessions:** A paused, interrupted, or abandoned Conductor session must **never** be automatically marked as `COMPLETED`. If an instructor leaves a session inactive beyond a timeout threshold, it must transition to an explicit interrupted state (`INTERRUPTED_ABANDONED`), preserving exact partial execution logs.
6. **V1 Release Scope Boundaries:**
   - Standalone Native Mobile Practitioner App is deferred to V2.
   - Clinical Therapy Workspace (client intake, clinical body charting, medical assessments) is deferred to V3.
   - AI-assisted sequence auto-generation is deferred to a future phase.

---

## 4. User Roles and Personas

### 4.1 Multi-Studio Identity Architecture

YogaOS distinguishes between a **Global User Identity** and a **Studio Organization Membership**:

```
                              ┌──────────────────────────────────┐
                              │       Global User Account        │
                              │   (UUID, Email, Mobile Auth)     │
                              └────────────────┬─────────────────┘
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       ▼                                               ▼
        ┌─────────────────────────────┐                 ┌─────────────────────────────┐
        │  Studio Organization A      │                 │  Studio Organization B      │
        │  Membership: INSTRUCTOR     │                 │  Membership: INSTRUCTOR     │
        │  Permissions: Branch 1, 2   │                 │  Permissions: Branch Central│
        │  Assigned Classes & Rosters │                 │  Assigned Classes & Rosters │
        └─────────────────────────────┘                 └─────────────────────────────┘
```

* **Instructors** have **one global account** and separate memberships, roles, permissions, schedules, and data access for each studio organization they work with.
* Instructors switch studio context seamlessly from the top navigation. Data isolation between studio organizations is strictly maintained.

### 4.2 Persona Matrix

| Persona | Core Goal | Primary Surface | Permissions Scope | Health Data Access |
| :--- | :--- | :--- | :--- | :--- |
| **Platform Super Admin** | Multi-tenant SaaS governance | Platform Admin Console | Global platform level | None (strict tenant privacy) |
| **Studio Owner** | Studio revenue, retention & compliance | Studio Dashboard, Settings | Entire Organization | Full administrative access |
| **Studio Manager** | Timetable, staff & student operations | Branch Ops, Timetable, CRM | Assigned Branches | Full operational access |
| **Instructor** | Sequence building & class conduction | Instructor Workspace, Conductor | Assigned Classes (Multi-Studio) | Full access for booked students |
| **Front Desk Staff** | Student check-in, bookings & walk-ins | Daily Check-In Roster, POS | Assigned Branch | **High-level caution badge only** |
| **Student (V1 Admin)** | Attendance & membership status | Notifications, Receipts | Self profile | Self-provided with consent |

---

## 5. System Modules & Functional Requirements

### 5.1 Multi-Tenant Organization & Branch Management
* **FR-ORG-01 (Tenant Hierarchy):** The system must support an Organization as the top-level tenant entity, containing one or more physical or virtual Branches.
* **FR-ORG-02 (Branch Isolation & Config):** Each branch must maintain independent operational settings including physical address, room capacities, operating hours, local timezone, and contact details.
* **FR-ORG-03 (Cross-Branch Operations):** The system must allow students and staff to be associated either with a specific home branch or marked as multi-branch eligible based on membership plan terms.

### 5.2 Staff & Multi-Studio Identity (RBAC)
* **FR-STF-01 (Global User Identity & Studio Memberships):** Users have a single global authentication profile (UUID, email, phone credential). Studio affiliation is governed through an `OrganizationMember` record defining roles (`OWNER`, `MANAGER`, `INSTRUCTOR`, `RECEPTIONIST`) and branch scopes.
* **FR-STF-02 (Multi-Studio Instructor Switching):** An instructor can be invited to multiple independent studio organizations. Upon login, the instructor selects their active studio context or switches studios from the top header without re-authenticating. Studio data remains completely segregated.
* **FR-STF-03 (Branch-Scoped Permissions):** Staff permissions can be scoped to either the entire Organization or specific assigned Branches.
* **FR-STF-04 (Instructor Profile):** Instructors maintain teaching credentials, bio, styles, and availability windows per studio membership.

### 5.3 Student Management & Privacy-Compliant Health CRM
* **FR-STU-01 (Immutable Student Identity):** A student is assigned an internal immutable UUID (`student_id`). Phone numbers and email addresses are treated as mutable contact and login identifiers, allowing updates without breaking historical billing, attendance, or membership records.
* **FR-STU-02 (Health Disclaimer & Consent Logging):** Capture student self-reported physical restrictions, past injuries, surgeries, and pregnancy status, accompanied by an explicit student consent timestamp adhering to India's DPDP Act 2023 principles.
* **FR-STU-03 (Granular Health Data Privacy Boundary):**
  * **Front Desk / Receptionist View:** Limited to a non-clinical, high-visibility safety indicator badge (e.g., `CAUTION: Physical Restriction Flagged`). Front desk staff cannot read detailed clinical or medical narratives.
  * **Assigned Instructor & Manager View:** Full access to read specific injury notes and modifications for students enrolled in their assigned classes.
* **FR-STU-04 (Student Activity Timeline):** Unified chronological timeline displaying all past bookings, attendance records, membership purchases, notes, and communications.
* **FR-STU-05 (Lead & Inquiry Pipeline):** Pipeline tracking (`NEW`, `TRIAL_BOOKED`, `TRIAL_ATTENDED`, `CONVERTED`, `LOST`) with follow-up dates and notes.

### 5.4 Classes, Batches & Scheduling
* **FR-CLS-01 (Class Types):** Standardized class templates specifying default duration, default capacity, level, and intensity.
* **FR-CLS-02 (Batches & Recurring Schedules):** Recurring weekly schedules with defined recurrence rules, assigned branch room, primary instructor, and start/end dates.
* **FR-CLS-03 (Instructor & Room Conflict Detection):** Real-time validation preventing instructors from being double-booked across any studio branches or rooms.
* **FR-CLS-04 (One-Time Workshops):** Single-occurrence sessions with custom pricing, capacity, and instructor assignments.
* **FR-CLS-05 (Schedule Exceptions & Substitutions):** Cancel single sessions, reschedule timings, or assign substitute instructors without corrupting master recurrence patterns.

### 5.5 Booking, Waitlist, Check-In & Attendance
* **FR-BKG-01 (Capacity & Booking Window):** Class instances enforce maximum capacity; spot booking checks student membership validity.
* **FR-BKG-02 (Automated FIFO Waitlist):** Overflow bookings enter an ordered waitlist.
* **FR-BKG-03 (Cancellation & Auto-Promotion):** When an active booking is cancelled outside the late-cancellation window, the first waitlisted student is automatically promoted and notified.
* **FR-BKG-04 (Front Desk Rapid Check-In):** 1-click roster check-in updating status to `ATTENDED` and displaying the student safety caution badge.
* **FR-BKG-05 (Attendance Status Tracking):** Definitive booking states: `BOOKED`, `ATTENDED`, `LATE_CANCEL`, `NO_SHOW`.
* **FR-BKG-06 (Pass Deduction Rules):** Check-in (`ATTENDED`) or `NO_SHOW` (under studio policy) automatically decrements active class pass credits.

### 5.6 Memberships & Class Passes
* **FR-MEM-01 (Diverse Plan Models):** Support for (a) Time-Based Unlimited Subscriptions, (b) Fixed-Credit Class Packs, and (c) Single Drop-In Passes.
* **FR-MEM-02 (Membership Freeze & Extension):** Pause active time-based memberships for medical or personal reasons, extending expiry by exact frozen calendar days.
* **FR-MEM-03 (Multi-Branch Eligibility):** Configurable flags indicating whether a pass is restricted to the issuing branch or valid across all branches.
* **FR-MEM-04 (Expiry Engine):** Background job marks status `EXPIRED` once validity date passes or credits reach zero.

### 5.7 Billing, Invoicing & Configurable Tax Management
* **FR-BIL-01 (Payment Recording):** Log payments across `UPI` (with UTR tracking), `CARD`, `NET_BANKING`, `CASH`, and `BANK_TRANSFER`.
* **FR-BIL-02 (Configurable GST Tax Engine):** Tax rules and rates are studio-configurable rather than hardcoded:
  * Configurable GSTIN, legal name, and tax registration status (registered vs unregistered/composition).
  * Configurable default tax rate (e.g., 18%, 12%, 5%, 0% exempt) and custom SAC codes (default 9992).
  * Automated tax split: Intra-state (CGST + SGST) vs Inter-state (IGST) based on branch state vs student billing state.
* **FR-BIL-03 (Sequential Tax Invoices):** Immutable, sequential invoice generation compliant with Indian tax formats.
* **FR-BIL-04 (Refunds & Credit Notes):** Record full or partial refunds with mandatory reason tracking and credit note generation.
* **FR-BIL-05 (Daily Cash & Collections Reconciliation):** Shift-close reports detailing receipts by payment channel.

### 5.8 Instructor Workspace
* **FR-INS-01 (Multi-Studio Schedule View):** Distraction-free calendar view showing assigned classes filtered by active studio organization.
* **FR-INS-02 (Roster & Injury Review):** Review registered attendees with detailed injury and health modification notes for booked students.
* **FR-INS-03 (Class Preparation & Sequence Linking):** Link a prepared sequence from the Sequence Library to an upcoming class session.
* **FR-INS-04 (Conductor Launch & Offline Preparation):** Pre-download and verify all sequence media on the studio device before class.

### 5.9 Asana Library & Sequence Builder
* **FR-ASN-01 (Classical Posture Taxonomy):** Structured catalog containing Sanskrit name (IAST), English name, category, difficulty, anatomical focus, and contraindications.
* **FR-ASN-02 (Custom Asana Creator):** Add studio-specific postures with static photo references.
* **FR-SEQ-01 (Step-Based Sequence Builder):** Compose flows with configurable hold durations (seconds) or breath counts, and rest intervals.
* **FR-SEQ-02 (Bilateral Symmetry):** Flag postures as bilateral to automatically generate symmetrical Right-Side and Left-Side holds.
* **FR-SEQ-03 (Sequence Media Binding):** Attach recorded MP3 voice cues, MP4 demo videos, and static reference images to individual steps.
* **FR-SEQ-04 (Sequence Versioning):** Sequences exist in `DRAFT` or `PUBLISHED` states. Modifying a published sequence generates a new version (e.g., `v1.1`), preserving historical class logs.

### 5.10 Automated Class Conductor (Offline-First Engine)
* **FR-CND-01 (Deterministic Playback Engine):** State machine executing class steps strictly by configured durations and transition triggers without runtime AI variance.
* **FR-CND-02 (Large-Format Studio Display):** High-contrast display showing Sanskrit & English posture names, Left/Right side badge, countdown timer, and upcoming posture preview.
* **FR-CND-03 (Synchronized Media & Audio Playback):** Synchronized execution of demo videos, static alignment graphics, and voice instruction audio cues.
* **FR-CND-04 (Instructor Transport Controls):** Dedicated keyboard shortcuts (`Spacebar`: Pause/Resume, `Right Arrow`: Skip, `Left Arrow`: Previous) and touch controls.
* **FR-CND-05 (Live Time Adjustment):** Instant `+30s` / `-30s` buttons to adapt hold times on the fly without altering the sequence template.
* **FR-CND-06 (Audio Autoplay Unlock):** High-visibility "Initialize & Start Session" user gesture permanently unlocks browser Web Audio contexts.
* **FR-CND-07 (Essential Offline Playback & Media Readiness):**
  * **Pre-Download & Verification:** All sequence media (video, audio, images) must be downloaded, integrity-checked, and cached locally in browser storage (IndexedDB / Cache API / OPFS) before a session can be marked `OFFLINE_READY`.
  * **Quota Management:** Engine inspects available storage quota (`navigator.storage.estimate()`), enforces LRU cache eviction of old sessions, and warns if storage is insufficient.
  * **Complete Offline Execution:** Timers, audio cues, video loops, static images, and instructor transport controls function 100% locally without an active internet connection.
* **FR-CND-08 (Safe Post-Connectivity Event Synchronization):**
  * Session telemetry and execution milestones are queued in local IndexedDB during offline playback.
  * Upon network restoration, events synchronize idempotently to the backend API.
* **FR-CND-09 (Session Lifecycle & Anti-Auto-Complete Protection):**
  * An interrupted, paused, or abandoned session is **NEVER** marked as `COMPLETED`.
  * If a paused session remains inactive beyond an instructor-configured timeout (default: 30 minutes), it transitions to `INTERRUPTED_ABANDONED`.
  * The exact elapsed duration, completed steps, and skipped steps are preserved in an immutable audit log.

---

## 6. Business Rules & Core Policies

| Policy Domain | Rule ID | Business Rule Specification |
| :--- | :--- | :--- |
| **Tenant Isolation** | `BR-TEN-01` | An Organization owns all branches, schedules, memberships, and billing records. Multi-studio instructors access studio data strictly via their verified `OrganizationMember` role. |
| **Student Identity** | `BR-STU-01` | Student records are anchored to an internal UUID (`student_id`). Phone numbers are mutable and validated against E.164 / Indian 10-digit formats. |
| **Health Privacy** | `BR-STU-02` | Front desk staff view only a non-clinical `CAUTION` badge. Clinical health narratives are restricted to assigned instructors and management. |
| **Instructor Conflict** | `BR-SCH-01` | Instructors cannot be scheduled for overlapping class sessions across any branches or studio organizations they belong to. |
| **Capacity & Waitlist** | `BR-BKG-01` | Maximum class capacity is strictly enforced. Overflow enrollments enter an automated FIFO waitlist. |
| **Late Cancellation** | `BR-BKG-02` | Cancellations made within the studio's configured cutoff window forfeit pass credit and are recorded as `LATE_CANCEL`. |
| **Configurable Tax** | `BR-TAX-01` | Tax application follows studio configuration (registered vs exempt). If registered, intra-state applies CGST+SGST, inter-state applies IGST, using configured rates. |
| **Conductor Offline** | `BR-CND-01` | A class cannot be started in offline mode unless all step media assets pass local hash/size verification and are marked `OFFLINE_READY`. |
| **Abandoned Session** | `BR-CND-02` | Paused sessions inactive for >30 minutes transition to `INTERRUPTED_ABANDONED`. They are never marked `COMPLETED`. |

---

## 7. Non-Functional Requirements (NFRs)

### 7.1 Security, Privacy & DPDP Compliance
* **NFR-SEC-01 (Multi-Tenant Isolation):** All database queries must enforce an explicit, validated `tenant_id` context. Multi-studio instructors query only within their active session tenant.
* **NFR-SEC-02 (Health Data Protection):** Self-reported student injury records are encrypted at rest. Access requires explicit permission flags. Student consent timestamps are permanently logged.
* **NFR-SEC-03 (Authentication & Passwords):** Argon2id / bcrypt password hashing, secure HTTP-only cookies, and session invalidation on role revocation.

### 7.2 Offline Playback & Conductor Reliability
* **NFR-REL-01 (Local Execution Guarantee):** Once marked `OFFLINE_READY`, the Conductor must execute all timers, transitions, and audio cues without dropping frames or freezing, regardless of Wi-Fi drops.
* **NFR-REL-02 (Crash Recovery):** State is written to IndexedDB every 3 seconds, enabling instant recovery if the browser tab is accidentally refreshed.
* **NFR-REL-03 (Idempotent Sync):** Post-connectivity event sync uses client-generated event UUIDs to prevent duplicate billing or attendance entries.

### 7.3 Performance Standards
* **NFR-PER-01 (Check-In Latency):** Front-desk roster check-in must complete in under 500ms.
* **NFR-PER-02 (Audio Latency):** Voice cues and chime audio must trigger within 50ms of scheduled step timestamps.
* **NFR-PER-03 (Display Rendering):** Conductor UI must render smoothly at 60fps on modern tablets and 1080p/4K studio TV displays.

---

## 8. Preserved Open Business Decisions

The following three business decisions remain open pending formal stakeholder confirmation. Clean architectural hooks and configuration flags have been established:

| Decision Ref | Topic / Open Question | Provisional Architecture Hook | Status |
| :--- | :--- | :--- | :--- |
| **OQ-01** | **Tax Exemption / Waiver Policy:** Can staff manually waive GST for specific students or corporate packages? | Configurable toggle per plan / transaction: `TAXABLE` vs `EXEMPT`. Default is to apply configured tax rules strictly. | Open Business Decision |
| **OQ-02** | **Expired Pass Check-In Grace Period:** Should the system permit checking in students whose memberships expired within a grace window (e.g. 24 hours)? | Configurable studio policy setting: `ALLOW_EXPIRED_CHECKIN_WITH_WARNING`. Default requires staff override. | Open Business Decision |
| **OQ-03** | **Drop-In Pass Refund Method:** Are cancelled drop-in passes refundable as cash or strictly store credit? | System supports recording both cash refunds and store credit balances; studio policy governs front-desk permissions. | Open Business Decision |

---
*End of Master Product Requirements Document.*
