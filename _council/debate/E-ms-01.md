# Debate — E-ms-01 Smart calendar (PARTIAL, Gap.md:177-180)
**Surface:** A: merchant SaaS | B: none declared per row (paper-wide gap, Law 7) | C: MS | D: merchant SaaS. No surface clash among those who declared.

## 1 · Product Owner
Smallest unit: week grid rendering the existing dashboard bookings payload — READ-ONLY first. **NEXT**; same build as the CEO's redefined E-ai-03. Half under debate here = the OWNER-everything grid of the shared-calendar bundle (E-ms-01+E-ms-02+E-bc-08-merchant+E-ai-03′, A §3). EGE-ADV collision named: grid sits *beside* the queue card stack, never replacing it (AGENTS.md:21). Cites Bookings.tsx:36-129 day-list. **MED**.

## 2 · Engineering Lead
**M**. Grid/drag/color is a frontend project on existing reads (`/api/bookings` GET bookings.ts:43; dashboard route server/api/tenantRoute.ts:56); also the surface for the re-scoped E-ai-03. Crons: none. Shared component for E-bc-08/E-ms-02/E-ai-03 — "land it once". Dep: grid ─► E-bc-08 drag. **HIGH**.

## 3 · Council
**GREEN-with-conditions** | MS. Data exists; render+drag over /api/bookings. Conditions: low-end Android law (COMPARE-02 #10 — grid must degrade to day-list on deviceMemory<2, motionGuard pattern); both locales; drag commits through server conflict checks (as E-bc-08). Collision: NO. No substitute needed. **HIGH**.

## 4 · Support/CRM
Impact: **MED, with a heresy — don't ship a grid first**. Workaround path: filtered list + queue card stack IS the product (Bookings.tsx:184-235); council already ruled "Merchant Home IS the queue" (ROADMAP §1 M2). Color-coded drag calendar = Fresha-parity for 8-chair London salons; ship week-strip on Home instead; build the grid only when E-ms-02 rosters demand one. Evidence: OBSERVED-workaround. Day-1 notice: **y**. The GRID is D's parity-theater call; D's HIGH shared-calendar rating belongs to E-ms-02 (staff week), not this owner grid.

## 5 · Challenge round
**A → D:** CEO redefined E-ai-03 as this grid build (A §4); it lives beside the queue, not instead of it — D's "sell the queue, not the calendar" concedes D's own point.
**D → A:** ROADMAP §1 M2 acceptance is queue-clearing, not drag-and-drop; "ship the week to staff, not a canvas" (D §3).
**B vs D (implied):** B's shared-grid plan feeds E-ms-02; D wants E-ms-02 delivered as a week strip with no grid at all.

## 6 · Chair log
- **Agreed:** read-only grid beside the queue, never replacing queue derivation; conflict-checked drag; low-end Android fallback; both locales.
- **Contested:**
  - D rates the owner grid MED/parity-theater vs A NEXT / B M / C GREEN.
  - Whether E-ms-02 can ship without this grid (D) or must ride it (A, B).
- **Escalation:** None.
- **Closure state:** CONTESTED-DEFER
