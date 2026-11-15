# YogaOS — Consolidated Feature Catalog & Requirements Matrix

**Document Reference:** `docs/product/FEATURE_CATALOG.md`  
**Version:** 1.1.0 (V1 Baseline Finalization — Phase P03)  
**Status:** Approved Technical Baseline  
**Author:** Senior Product Architect & Technical Product Manager  

---

## 1. Feature Priority Definitions

Every feature in the YogaOS platform is classified under one of four explicit priority tiers:

* **P0 — Essential for First Usable Release (V1 Baseline):** Non-negotiable core functionality required for an operational yoga studio to manage daily classes and execute live, deterministic, offline-capable guided sessions with the Automated Class Conductor.
* **P1 — Important (Fast Follow):** High-value operational workflows and user experience enhancements that follow immediately after the initial release.
* **P2 — Future Enhancement:** Capabilities planned for subsequent growth phases (e.g., native mobile apps, practice streaks, multi-location business intelligence).
* **OUT OF SCOPE:** Explicitly rejected or deferred capabilities (e.g., 3D avatars, Three.js, autonomous AI live control, clinical therapy workspace).

---

## 2. Priority Distribution Summary

Following the P03 baseline review, **CND-08 (Essential Offline Playback & Post-Connectivity Synchronization)** was promoted from P1 to **P0** in accordance with Confirmed Product Decisions #4–#7. All 41 original P0 capabilities have been retained and refined.

| Module | Total Features | P0 (V1 Baseline) | P1 (Fast Follow) | P2 (Future) | Out of Scope |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **1. Multi-Tenant Organization & Branches** | 5 | 3 | 2 | 0 | 0 |
| **2. Staff, Identity & Multi-Studio RBAC** | 5 | 4 | 1 | 0 | 0 |
| **3. Student Management & Health CRM** | 6 | 4 | 2 | 0 | 0 |
| **4. Classes, Batches & Scheduling** | 6 | 5 | 1 | 0 | 0 |
| **5. Bookings, Waitlist & Attendance** | 7 | 5 | 2 | 0 | 0 |
| **6. Memberships & Passes** | 6 | 4 | 2 | 0 | 0 |
| **7. Billing, Invoicing & Configurable Tax** | 6 | 4 | 2 | 0 | 0 |
| **8. Instructor Workspace** | 5 | 4 | 1 | 0 | 0 |
| **9. Asana Library & Sequence Builder** | 7 | 5 | 1 | 1 | 0 |
| **10. Automated Class Conductor (Offline-First)**| 9 | **8** | 1 | 0 | 0 |
| **11. Practitioner Experience (Future)** | 4 | 0 | 1 | 3 | 0 |
| **12. Therapy & Clinical Workspace** | 3 | 0 | 0 | 0 | 3 |
| **13. Graphics & Animation Systems** | 3 | 0 | 0 | 0 | 3 |
| **Total** | **72** | **42** | **16** | **4** | **10** |

---

## 3. Consolidated Feature Matrix

### Module 1: Multi-Tenant Organization & Branches

| Feature ID | Feature Name | Primary User | Business Purpose | Priority | Dependencies | Key Acceptance Criteria |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **ORG-01** | Multi-Tenant Organization Provisioning | Super Admin / Owner | Provide isolated tenant workspace for each studio business. | **P0** | None | System enforces tenant isolation across all database queries; creates default organization profile with legal entity details and default currency (INR). |
| **ORG-02** | Branch Creation & Resource Setup | Studio Owner | Support physical studio locations, rooms, and floor capacities. | **P0** | ORG-01 | Owner can define multiple branches under one organization; specify address, contact info, timezone, and individual practice rooms with set capacities. |
| **ORG-03** | Studio Operations Dashboard | Studio Owner / Manager | Real-time operational overview of daily classes, attendance, and revenue. | **P0** | ORG-02, BKG-04, BIL-01 | Displays today's scheduled classes, check-in rate, active student count, and today's gross collection summary. |
| **ORG-04** | Branch Switching & Cross-Branch View | Studio Manager | Enable managers assigned to multiple branches to switch context seamlessly. | **P1** | ORG-02 | User can toggle active branch from top navigation without logging out; all views update instantly to selected branch context. |
| **ORG-05** | Multi-Branch Centralized Reporting | Studio Owner | Compare attendance, occupancy, and revenue across multiple branches. | **P1** | ORG-04, BIL-04 | Aggregate reporting showing branch-by-branch performance and room utilization metrics. |

---

### Module 2: Staff, Identity & Multi-Studio RBAC

| Feature ID | Feature Name | Primary User | Business Purpose | Priority | Dependencies | Key Acceptance Criteria |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **STF-01** | Global User Identity & Studio Memberships | Studio Owner / Instructor | Support single global identity with studio-specific memberships. | **P0** | ORG-01 | Users possess one global identity. Affiliation with studios is modeled via `OrganizationMember` records. Invitations link existing global accounts without exposing data across studios. |
| **STF-02** | Predefined Role Assignment | Studio Owner | Enforce least-privilege security across administrative functions. | **P0** | STF-01 | Assign one of 4 predefined roles: `OWNER`, `MANAGER`, `INSTRUCTOR`, `RECEPTIONIST`; system blocks unauthorized routes and API actions. |
| **STF-03** | Branch-Scoped Permissions | Studio Owner | Restrict managers and receptionists to specific physical locations. | **P0** | STF-02, ORG-02 | Staff can only view rosters, schedules, and financials for branches they are explicitly granted access to. |
| **STF-04** | Instructor Profile & Multi-Studio Bio | Instructor | Maintain credentials, styles, and bio across studio affiliations. | **P0** | STF-01 | Instructor can maintain global credentials (RYT certifications) and studio-specific bios, rates, and active availability windows. |
| **STF-05** | Custom Role & Permission Builder | Studio Owner | Configure bespoke permission sets for specialized staff. | **P1** | STF-02 | Interface to toggle individual granular permission flags (e.g., allow front desk to view student contact info but not revenue reports). |

---

### Module 3: Student Management & Health CRM

| Feature ID | Feature Name | Primary User | Business Purpose | Priority | Dependencies | Key Acceptance Criteria |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **STU-01** | Immutable Student Profile & Identity | Front Desk / Manager | Register new students with decoupled internal UUID identity. | **P0** | ORG-01 | Student record is anchored to immutable internal `student_id` (UUID). Phone and email are mutable login/contact identifiers. Updating phone does not corrupt historical records. |
| **STU-02** | Health Disclaimer & Privacy Boundaries | Front Desk / Instructor | Record physical limitations with role-based visibility. | **P0** | STU-01 | Student self-reported injuries/conditions recorded with consent timestamp. **Front desk view displays only a non-clinical `CAUTION` badge**; clinical narratives visible only to assigned instructors & management. |
| **STU-03** | Student Activity & Practice Timeline | Front Desk / Instructor | Chronological audit of class attendance, memberships, and notes. | **P0** | STU-01, BKG-04 | Displays unified timeline of attended classes, cancellations, no-shows, purchased packages, and internal staff notes. |
| **STU-04** | Lead & Inquiry Pipeline | Front Desk / Manager | Track prospective students from initial trial inquiry to paid member. | **P0** | STU-01 | Manage pipeline states: `NEW`, `TRIAL_BOOKED`, `TRIAL_ATTENDED`, `CONVERTED`, `LOST`; set next follow-up dates and notes. |
| **STU-05** | Student Document & Waiver Storage | Front Desk / Manager | Store signed physical or digital liability waivers. | **P1** | STU-01 | Upload and preview PDF/image waivers linked to the student profile. |
| **STU-06** | Student Bulk Import / Export | Studio Owner / Manager | Enable fast migration from legacy Excel or paper registries. | **P1** | STU-01 | CSV import with validation, error preview, duplicate phone/email detection, and CSV export. |

---

### Module 4: Classes, Batches & Scheduling

| Feature ID | Feature Name | Primary User | Business Purpose | Priority | Dependencies | Key Acceptance Criteria |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **CLS-01** | Class Type Catalog | Studio Manager | Create standardized class formats with default attributes. | **P0** | ORG-01 | Define class title, description, level (Beginner/Intermediate/Advanced), default duration (mins), default capacity, and intensity. |
| **CLS-02** | Recurring Batch Schedule Creator | Studio Manager | Establish regular weekly timetable for studio batches. | **P0** | CLS-01, ORG-02, STF-04 | Configure recurring schedules (e.g., Mon/Wed/Fri at 07:00 AM); assign branch room, primary instructor, and start/end dates. |
| **CLS-03** | Cross-Studio Instructor Conflict Check | Studio Manager | Prevent double-booking instructors across branches and studios. | **P0** | CLS-02 | System validates instructor schedule across all studio memberships; prevents overlapping session confirmations. |
| **CLS-04** | One-Time & Workshop Scheduling | Studio Manager | Schedule standalone events, workshops, or masterclasses. | **P0** | CLS-01, ORG-02 | Create single-occurrence sessions with custom pricing, capacity, and instructor assignments. |
| **CLS-05** | Schedule Exception & Substitution Manager | Studio Manager | Handle teacher sickness, holiday closures, or room changes. | **P0** | CLS-02 | Modify a single instance of a recurring batch without altering the master rule: substitute instructor, change room, or cancel session. |
| **CLS-06** | Interactive Calendar & Grid View | Studio Manager / Front Desk | Visual operational timetable of all studio activities. | **P1** | CLS-02, CLS-05 | Week, Day, and Agenda views filterable by branch, room, instructor, and class type; drag-and-drop rescheduling support. |

---

### Module 5: Bookings, Waitlist & Attendance

| Feature ID | Feature Name | Primary User | Business Purpose | Priority | Dependencies | Key Acceptance Criteria |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **BKG-01** | Class Booking & Capacity Check | Front Desk / Manager | Book a student into an upcoming class instance. | **P0** | CLS-02, STU-01, MEM-02 | Validates active pass credits; checks room capacity; reserves spot; decrements remaining capacity. |
| **BKG-02** | Automated FIFO Waitlist | Front Desk / System | Manage overflow demand when a class is fully booked. | **P0** | BKG-01 | When capacity is reached, subsequent bookings enter waitlist with sequential priority rank; displays waitlist position to staff. |
| **BKG-03** | Booking Cancellation & Auto-Promotion | Front Desk / System | Free up spots and promote waitlisted students automatically. | **P0** | BKG-02 | If an enrolled student cancels before cutoff, the spot is freed; top waitlisted student is automatically enrolled and notified. |
| **BKG-04** | Front Desk Rapid Check-In Roster | Front Desk Staff | Process student arrivals quickly prior to class start. | **P0** | BKG-01 | Real-time roster; 1-click check-in updates status to `ATTENDED`; displays student injury caution badge without medical details. |
| **BKG-05** | No-Show & Late Cancellation Tracking | Front Desk / Manager | Enforce studio attendance policies and discourage empty bookings. | **P0** | BKG-04 | Mark un-attended bookings as `NO_SHOW` or `LATE_CANCEL`; deducts class pass credit according to studio rule. |
| **BKG-06** | Walk-In Booking & Instant Pass Sell | Front Desk Staff | Accommodate unregistered students arriving at studio door. | **P1** | BKG-01, MEM-02, BIL-01 | Single consolidated modal to register student, sell pass, record payment, and check into current class in under 60 seconds. |
| **BKG-07** | Self-Service Check-In Kiosk Mode | Student | Enable students to tap/search phone number at studio entrance tablet. | **P1** | BKG-04 | Fullscreen locked tablet view allowing student to enter phone number, view their booking, and tap "Check In". |

---

### Module 6: Memberships & Class Passes

| Feature ID | Feature Name | Primary User | Business Purpose | Priority | Dependencies | Key Acceptance Criteria |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **MEM-01** | Membership Plan Configuration | Studio Owner | Create productized membership offerings. | **P0** | ORG-01 | Define plans: (a) Unlimited Time-Based (e.g., Monthly, Quarterly, Annual), (b) Class Packs (e.g., 10-Class Pack, valid 60 days), (c) Drop-in Single Pass. |
| **MEM-02** | Student Membership Assignment | Front Desk / Manager | Issue a membership plan or pass pack to a student. | **P0** | MEM-01, STU-01 | Assign plan, set custom start date, auto-calculate expiry date, allocate credit balance, and link to payment transaction. |
| **MEM-03** | Credit Consumption & Expiry Engine | System | Track remaining pass credits and flag expired subscriptions. | **P0** | MEM-02, BKG-04 | Automatically deducts 1 credit upon check-in; background task marks status `EXPIRED` once validity date passes or credits reach zero. |
| **MEM-04** | Membership Freeze & Extension | Studio Manager | Pause student membership during injury or travel. | **P0** | MEM-02 | Manager specifies freeze start and end date; system pauses credit use and extends overall membership expiration by exact frozen days. |
| **MEM-05** | Multi-Branch Pass Eligibility Rules | Studio Owner | Control whether passes can be used across multiple branches. | **P1** | MEM-01, ORG-02 | Configure plan flag: `HOME_BRANCH_ONLY` vs `ALL_BRANCHES_VALID`; system verifies branch eligibility during booking. |
| **MEM-06** | Membership Renewal Alerts & Tracking | Front Desk / Manager | Proactively retain expiring members. | **P1** | MEM-03 | Filter students whose memberships expire in next 7/14 days; generate automated reminder list. |

---

### Module 7: Billing, Invoicing & Configurable Tax

| Feature ID | Feature Name | Primary User | Business Purpose | Priority | Dependencies | Key Acceptance Criteria |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **BIL-01** | Payment Recording (Multi-Mode) | Front Desk / Manager | Log revenue collections across diverse payment channels. | **P0** | MEM-02, STU-01 | Record payment amount, date, reference/UTR number, and payment mode: `UPI`, `CARD`, `NET_BANKING`, `CASH`, `BANK_TRANSFER`. |
| **BIL-02** | Configurable GST Tax Engine & Invoices | Front Desk / Manager | Support studio-specific GST rates, SAC codes, and exemptions. | **P0** | BIL-01, ORG-01 | Tax rate is configurable (e.g., 18%, 12%, 5%, 0% exempt); calculates CGST+SGST or IGST; generates immutable sequential tax invoice. |
| **BIL-03** | Refund & Credit Note Logging | Studio Manager / Owner | Process membership cancellations or billing errors cleanly. | **P0** | BIL-02 | Record full or partial refunds with mandatory reason; update membership status; generate official Credit Note document. |
| **BIL-04** | Daily Collections & Cash Summary | Studio Manager / Owner | End-of-day financial reconciliation for front desk shifts. | **P0** | BIL-01 | Report showing total cash, UPI, card, and bank transfers collected today with cashier sign-off summary. |
| **BIL-05** | GST Summary Report Export | Studio Owner / Accountant | Provide monthly tax summary for chartered accountant filing. | **P1** | BIL-02 | Export CSV of B2C and B2B invoices with Taxable Value, CGST, SGST, IGST totals, and credit notes for GSTR-1 preparation. |
| **BIL-06** | Payment Gateway Integration (Razorpay) | Front Desk / Student | Direct digital payment link generation for remote renewals. | **P1** | BIL-01 | Generate Razorpay payment link sent via WhatsApp/SMS; automatically marks payment complete upon webhook confirmation. |

---

### Module 8: Instructor Workspace

| Feature ID | Feature Name | Primary User | Business Purpose | Priority | Dependencies | Key Acceptance Criteria |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **INS-01** | Multi-Studio Instructor Workspace | Instructor | Distraction-free view with active studio switcher. | **P0** | STF-01, CLS-02 | Displays instructor's upcoming classes across branches; includes studio switcher allowing multi-studio instructors to switch context cleanly. |
| **INS-02** | Class Roster & Clinical Injury Preview | Instructor | Review student attendees and detailed injury notes before class. | **P0** | INS-01, BKG-04, STU-02| View registered list with detailed injury/modification notes for enrolled students; access protected by instructor authorization. |
| **INS-03** | Class Preparation & Sequence Linking | Instructor | Attach prepared yoga sequence to a specific scheduled class. | **P0** | INS-01, SEQ-02 | Instructor selects a published sequence from their personal/studio library to associate with an upcoming session. |
| **INS-04** | Launch Automated Class Conductor | Instructor | Initiate live guided session directly from class schedule card. | **P0** | INS-03, CND-01 | One-click button launches the Conductor player preloaded with the attached sequence, student roster, and media verification. |
| **INS-05** | Teaching Activity & Hours History | Instructor | Track teaching volume and historical classes conducted. | **P1** | INS-01, CND-07 | Personal summary of classes taught, total hours, and student attendance volume over selected month. |

---

### Module 9: Asana Library & Sequence Builder

| Feature ID | Feature Name | Primary User | Business Purpose | Priority | Dependencies | Key Acceptance Criteria |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **ASN-01** | Classical Asana Catalog & Taxonomy | Instructor / Manager | Standardized repository of classical yoga postures. | **P0** | ORG-01 | Catalog includes Sanskrit name (IAST), English name, category (Standing, Inversion, etc.), difficulty, anatomical focus, and contraindications. |
| **ASN-02** | Custom Asana & Variation Creator | Instructor | Allow studios to add studio-specific drills or variations. | **P0** | ASN-01 | Instructor can add custom posture entry with title, Sanskrit name, cues, and upload static photo reference. |
| **SEQ-01** | Step-Based Sequence Builder | Instructor | Compose structured, linear yoga practice flows. | **P0** | ASN-01 | Add asana steps in order; configure step duration (seconds) or breath/rep counts; configure rest interval following step. |
| **SEQ-02** | Bilateral Symmetry & Side Splitting | Instructor | Ensure balanced practice of left and right sides. | **P0** | SEQ-01 | Checkbox for "Bilateral Asana" automatically clones step into explicit "Right Side" and "Left Side" phases during execution. |
| **SEQ-03** | Sequence Media & Audio Cue Binding | Instructor | Attach voice cues and demo media to individual steps. | **P0** | SEQ-01 | Upload or link recorded MP3/AAC voice instructions and MP4 demo video or high-res JPG/PNG alignment image to step. |
| **SEQ-04** | Sequence Publishing & Versioning | Instructor | Prevent live class disruption when editing existing sequences. | **P0** | SEQ-01 | Sequences exist as `DRAFT` or `PUBLISHED`; editing a published sequence with historical runs creates a new version (`v1.1`). |
| **SEQ-05** | Reusable Sequence Templates | Studio Owner / Instructor | Share standardized sequences across all studio branches. | **P1** | SEQ-04 | Mark sequence as Organization Template so all teachers in the studio can attach it to their classes. |
| **SEQ-06** | Sequence Time & Intensity Calculator | Instructor | Preview total practice duration and energy curve. | **P2** | SEQ-01 | Dynamically sums all posture durations, rest intervals, and transitions; graphs intensity progression (warm-up, peak, cool-down). |

---

### Module 10: Automated Class Conductor (Offline-First Engine)

| Feature ID | Feature Name | Primary User | Business Purpose | Priority | Dependencies | Key Acceptance Criteria |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **CND-01** | Deterministic Live Execution Engine | Instructor | Run structured session strictly according to configured timing. | **P0** | SEQ-04, INS-04 | State machine executes steps linearly; triggers accurate countdown timers, step transitions, and rest periods with no AI variance. |
| **CND-02** | Large-Format Studio Display Mode | Instructor / Students | Clear visual projection for the practice hall. | **P0** | CND-01 | High-contrast UI displaying: Current Asana name (Sanskrit & English), Left/Right side indicator, large countdown timer, and next posture preview. |
| **CND-03** | Synchronized Media & Audio Playback | Instructor / Students | Deliver teacher demo video, static visuals, and voice instructions. | **P0** | CND-01, SEQ-03 | Plays attached video (with loop/freeze on final pose) or static image; plays audio cue at step start with zero sound overlap. |
| **CND-04** | Instructor Transport Controls | Instructor | Keep instructor in full physical control of class flow. | **P0** | CND-01 | Dedicated on-screen buttons and keyboard shortcuts (Space: Pause/Resume; Right Arrow: Skip Step; Left Arrow: Previous Step). |
| **CND-05** | Live Time Adjustment (+30s / -30s) | Instructor | Adapt on the fly when students need extra hold time. | **P0** | CND-01 | Instant buttons to add or subtract 30s/60s to current step countdown without corrupting the sequence template. |
| **CND-06** | Audio Autoplay Unlock & Media Verification | Instructor | Unlock browser audio and verify pre-downloaded media. | **P0** | CND-01 | User gesture unlocks Web Audio context; checks that all media files are cached and verified locally before allowing session launch. |
| **CND-07** | Session Execution Log & Anti-Auto-Complete | Instructor / Manager | Record completion metrics and audit actual class delivery. | **P0** | CND-01 | Writes immutable log. **Paused/abandoned sessions are NEVER marked `COMPLETED`**; if inactive >30m, transitions to `INTERRUPTED_ABANDONED`. |
| **CND-08** | Essential Offline Playback & Event Sync | Instructor | Ensure uninterrupted class delivery and safe post-sync. | **P0** *(Promoted from P1)* | CND-01, CND-06 | Class Conductor executes 100% locally when `OFFLINE_READY`; queues execution events in IndexedDB; synchronizes idempotently upon reconnect. |
| **CND-09** | Hardware Remote & Clicker Support | Instructor | Control player from anywhere on the mat using a handheld clicker. | **P1** | CND-04 | Standard Bluetooth presentation remote buttons (Next/Prev/Play) map directly to Conductor transport controls. |

---

### Module 11: Practitioner Experience (Future Scope)

| Feature ID | Feature Name | Primary User | Business Purpose | Priority | Dependencies | Key Acceptance Criteria |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **PRC-01** | Student Web Booking Portal | Student | Allow students to self-book classes online via studio link. | **P1** | BKG-01, MEM-02 | Web portal where authenticated students view schedule, book class, cancel booking, and see remaining credits. |
| **PRC-02** | Native Mobile App (iOS / Android) | Student | Mobile application for class booking and practice history. | **P2** | PRC-01 | Dedicated Expo/React Native mobile app with push notifications. |
| **PRC-03** | Personal Practice History & Streaks | Student | Motivate ongoing practice through attendance milestones. | **P2** | PRC-01 | Personal dashboard showing monthly class count, favorite asanas, and attendance streak badges. |
| **PRC-04** | Self-Service Digital Waiver Signing | Student | Sign studio liability waiver directly on personal device. | **P2** | STU-05 | Digital signature capture embedded in initial registration flow. |

---

### Module 12: Therapy & Clinical Workspace (Explicitly Out of Scope for V1)

| Feature ID | Feature Name | Primary User | Business Purpose | Priority | Notes / Boundary |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **THR-01** | Clinical Client Intake & Assessment | Yoga Therapist | In-depth medical history and clinical body charting. | **OUT OF SCOPE** | Requires strict healthcare regulatory compliance (HIPAA/DISHA); deferred to V3. |
| **THR-02** | Individualized Therapy Practice Plans | Yoga Therapist | Prescriptive yoga therapy protocols for pathologies. | **OUT OF SCOPE** | Product boundary: No medical claims without qualified clinical review. |
| **THR-03** | Therapy Progress Notes & Outcomes | Yoga Therapist | Clinical SOAP notes and symptom outcome metrics. | **OUT OF SCOPE** | Deferred to standalone specialized therapy module in V3. |

---

### Module 13: Graphics & Animation Systems (Explicitly Out of Scope)

| Feature ID | Feature Name | Primary User | Business Purpose | Priority | Notes / Boundary |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **GFX-01** | 3D Avatars & WebGL Renders | Instructor / Student | 3D rendering of yoga postures using Three.js/GLB. | **OUT OF SCOPE** | Violates established product constraint. High complexity, uncanny valley, low pedagogical value compared to real videos. |
| **GFX-02** | Autonomous AI Live Class Conductor | System | AI computer-vision model modifying live class pacing. | **OUT OF SCOPE** | Violates established product constraint. Live execution must remain deterministic and teacher-controlled. |
| **GFX-03** | Real-Time Posture Pose Estimation | Student | Webcam pose tracking scoring student alignment live. | **OUT OF SCOPE** | Camera/hardware intensive, prone to false corrections, distracting to authentic yoga practice. |

---
*End of Consolidated Feature Catalog & Requirements Matrix.*
