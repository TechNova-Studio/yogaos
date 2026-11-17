# YogaOS — Known Limitations & Operational Considerations

**Document Reference:** `docs/operations/KNOWN_LIMITATIONS.md`  
**Version:** 1.0.0 (Release Hardening Baseline — Phase P20)  
**Status:** Approved Documentation  

---

## 1. Conductor & Offline Playback Limitations

1. **Browser Storage Eviction:**
   - Modern browsers (Safari iOS in particular) may evict IndexedDB or Cache API storage if device storage drops below 5% capacity or if the website has not been accessed for 7 days.
   - *Operational Mitigation:* Instructors must verify the "Pre-flight Asset Status" prior to class start; YogaOS explicitly displays `OFFLINE_READY` status and alerts if assets need re-caching.
2. **Audio Autoplay Policies:**
   - Chrome and Safari enforce strict audio autoplay policies requiring a user gesture (e.g. clicking "Start Session" or "Play") before playing unmuted audio.
   - *Design Implementation:* Conductor audio playback is explicitly tied to the instructor's physical "Start" or "Resume" tap gesture. Background automatic autoplay without gesture is avoided by design.
3. **Simulated vs Physical Hardware Offline Testing:**
   - In automated vitest integration testing, offline mode is simulated via mock network disconnection and Cache API / IndexedDB interception.
   - Physical device Wi-Fi toggling and sleep mode behavior on Android / iPadOS tablets must be verified during studio on-site pilot trials.

---

## 2. Financial & GST Considerations

1. **GST Registration Variations:**
   - In YogaOS, GST calculations (CGST/SGST 9%+9% vs IGST 18%) apply based on studio configuration (`isGstRegistered: true/false`).
   - Studios operating below the ₹20 Lakh / ₹40 Lakh aggregate turnover threshold who choose not to register for GST must configure `isGstRegistered: false`, which generates bills of supply without tax line items.
   - *Tax Disclaimer:* Studio owners must consult a qualified Indian Chartered Accountant regarding exact SAC code classification (999299 vs 999799) and composition scheme rules.
2. **Payment Gateway Settlement Timelines:**
   - Razorpay and Stripe settlements (T+2 / T+3 banking days in India) are asynchronous. Payment transactions record real-time authorization success; actual bank payouts must be reconciled via gateway monthly payout reports.

---

## 3. Infrastructure & Deployment Limitations

1. **In-Memory Rate Limiting:**
   - The built-in `RateLimitGuard` operates on an in-memory sliding window per API process.
   - In horizontally scaled multi-pod Kubernetes or cluster deployments, rate-limiting should be offloaded to Redis or Cloudflare WAF to maintain global rate-limit state across instances.
2. **Local Media vs Cloud CDN:**
   - The default development environment stores media asset URLs locally or on S3 mock URLs. Production deployments require configuring AWS S3 or Cloudflare R2 bucket credentials with CloudFront / CDN distribution for high-throughput video delivery.
