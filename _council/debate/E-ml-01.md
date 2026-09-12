# Debate — E-ml-01 Multiple business locations (GAP, Gap.md:203-206)
**Surface:** A: platform-scale merchant SaaS | B: none declared per row | C: MS + PL | D: merchant SaaS. Flag: A's "platform-scale" phrasing vs C's MS+PL split — same family, no hard blend.

## 1 · Product Owner
Smallest unit: none — **DEFER**. One-tenant-one-location is load-bearing (verified HIGH: `tenants.slug` unique; every query carries inline eq(tenantId) per AGENTS.md:29-30). "A location entity re-shapes the entire tenancy law. Company-shaped." Listed in Deferred-as-a-ruling. **HIGH**.

## 2 · Engineering Lead
**L+ (XL)**. Tenant == location today: slug unique, Host/X-Tenant-Slug resolution middleware (ARCHITECTURE.md:92-100), 41 tables keyed tenant_id, disk layout storage/pro-builds/{tenantId} (site-settings.ts:16-18), Pro price per-tenant (billing.ts). "One-way door of the year. Defer until a paying multi-shop tenant exists." Crons: all read tenant-scoped. §3 audit reclassifies tail row to XL, "a company decision". **HIGH**.

## 3 · Council
**RED-needs-CEO-ruling (schema law)** | MS. Location entity is either a parent-above-tenant refactor (all 41 tables) or intra-tenant scope (every booking/availability read in public.ts); both are schema-migration events with money-path parity. Names the strategic coupling: "this is the honest downstream of the DB decision in Gap.md:401-411 — if multi-location is the strategy, the Turso single-writer ceiling matters now, not later." Recommend ruling the WANT first (Season 0 density-first, ROADMAP:23), defer the build. Collision: NO; prerequisite for E-ml-03. §4 ask 9. **HIGH**.

## 4 · Support/CRM
Impact: **none-in-addis-today.** One tenant = one slug = one door (Gap.md:206); founding cohort single-chair by design (ROADMAP §0, "one vertical with paying density"). Listed under "what NOT to build". frequency: UNDOCUMENTED. Day-1: **n**.

## 5 · Challenge round
**C → A/B:** C makes the Turso/Postgres ceiling *contingently urgent* (if multi-location is the strategy) while A votes "stay on libSQL/Turso… revisit only on measured evidence" and B says "defer the dialect decision… revisit at ~100 tenants".
**B vs C on sequencing:** B defers to a paying multi-shop tenant; C defers to a CEO ruling on intent.

## 6 · Chair log
- **Agreed:** build deferred by all; tenancy law (inline eq, unique slug) is the collision surface; nobody contests XL/L+ cost.
- **Contested:** trigger for revisiting the DB decision (paying tenant [B] vs CEO strategy ruling [C] vs measured evidence [A]).
- **Escalation:** ESCALATE: Is multi-location (and multi-merchant) THE strategy? (C §4 ask 9, coupled with E-ml-02; sets urgency of the Gap.md:401-411 DB decision.)
- **Closure state:** AWAITING-CEO
