# Debate — E-cm-06 Files on client profiles

**Surface (declared per persona):** A: merchant SaaS | B: undeclared (per-row) | C: MS | D: MS (client-management) — flag: B carries no surface (Rule 1).

## 1 · Product Owner
Smallest unit: link existing tenant upload (`tenant.ts:1401` verified HIGH in repo-map) to a phone. **NEXT**, T7.11 bundle; "PDPL erasure assertion included." **MED**.

## 2 · Engineering Lead
Effort **S**. Upload + media exist (tenant.ts:1401-1470, schema.ts:217-225 tenant-scoped); add nullable `customer_phone` link. Dep: E-cm-01. PDPL erasure. Crons: none; no money-path work. **HIGH**.

## 3 · Council
**AMBER-with-conditions** (MS). A customer FK is additive, but: "consent-form photos are *the* legal record pair to E-cm-03 answers — **retention differs (keep signed consent, purge clinical photos on request)**; file-type/size limits; the erasure matrix must delete customer-linked **media objects, not just rows**." No CEO-ruling request. Collision: NO. **HIGH**.

## 4 · Support/CRM
Impact **LOW**. Workaround (code path): "Reference photos travel on Telegram — which is honestly *better* for now" (Gap.md:167). UNDOCUMENTED. Day-1: n.

## 5 · Challenge round
**C → B (fact):** B's S is a link column; C's condition set adds split retention classes (consent vs clinical) and blob-level erasure — that is more than "add nullable customer_phone," an effort/materiality disagreement.
**D → A:** A bundles files NEXT into T7.11 while D grades the pain LOW with Telegram as an adequate current store — priority, not possibility.

## 6 · Chair log
- **Agreed:** the mechanism is small and rides existing upload + media plumbing; PDPL erasure must reach the blobs, not just rows (B and C state the duty; A promises it).
- **Contested:** effort/materiality (B's S vs C's dual-retention conditions); demand class (D: LOW/UNDOCUMENTED, no workaround pain).
- **Escalation:** None. — Register check: no money; the consent-photo/clinical-photo split keys off the E-cm-02/E-cm-03 rulings but adds no new authority question of its own.
- **Closure state:** CLEARED
