# Debate — E-ar-04 Client-source attribution & ads conversion tracking
**Surface (declared per persona):** A: merchant SaaS | B: n.d. per row | C: CM+MS | D: merchant SaaS

## 1 · Product Owner
- Smallest unit: carry a `src` param from the share/widget URL through POST bookings into the existing **`appointments.bookingSource`** column (verified HIGH in repo-map — "half the plumbing already exists").
- Ads pixels = G2-dead rails. **NEXT** (T7.16 minus the pixel tail). **HIGH**

## 2 · Engineering Lead
- **M** (T7.16) attribution / **defer** pixels. bookingSource exists with walk_in/online semantics (schema.ts:145-147); add `booking_source_detail` carried through BookingSchema (public.ts:596-621) + widget URL.
- GA/Meta pixels = "consumer-PII consent surface Egebeya doesn't have → separate one-way decision; ship owned attribution first." Crons: none. **MED**

## 3 · Council
- **AMBER (split)** | CM+MS. Attribution half: bookingSource exists; LEDGER:26's "worth more when paid acquisition exists, which Season 0 forbids" doesn't block an owned-channel column.
- Pixel half: **RED-needs-CEO-ruling** — third-party tracking on consumer pages without a consent banner is PDPL exposure + cross-border transfer; §4 ruling request 12. Collision: NO. **HIGH**

## 4 · Support/CRM
- Impact **LOW** (D is "honest about why"): T7.16 waits per LEDGER.md:26; tenant-level `acquired_via_code` exists.
- Note: `booking_source` *does* exist (repo-map column list; queue.ts:9-12) "with the docstring-vs-code disagreement flagged in COMPARE-02 §G" — what's missing is marketing-channel attribution, not the walk-in/online split.
- Evidence: DECISION-recorded. Notice day 1: **n**.

## 5 · Challenge round
**C → A:** A files pixels as "G2-dead rails" (a rail kill); C keeps the pixel half RED-needs-CEO-ruling — a dead rail and a ruling-pending surface reopen on different triggers.
**D → A:** A's "half the plumbing verified HIGH" premise is contested at the read — D cites the §G docstring-vs-code disagreement over bookingSource semantics.

## 6 · Chair log
- **Agreed:** attribution half ships NEXT on the existing column; pixels ship never without a ruling.
- **Contested:** how much of the bookingSource plumbing is trustworthy as-is (A vs D/§G); pixel classification (dead rail vs ruling-pending).
- **Escalation:** None. (Pixel consent posture already stands in C's §4 ruling list, request 12.)
- **Closure state:** CLEARED
