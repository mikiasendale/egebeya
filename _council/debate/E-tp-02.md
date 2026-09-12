# Debate — E-tp-02 Custom permission roles
**Surface (declared per persona):** A: merchant SaaS | B: n.d. per row | C: MS | D: merchant SaaS

## 1 · Product Owner
- **DEFER** — three fixed roles are the security model (schema.ts:31 role text verified HIGH: owner/staff/admin); a per-member matrix is "L-effort with no activation payoff." **HIGH**

## 2 · Engineering Lead
- **M, security-sensitive**. Three fixed roles checked server-side (auth.ts:120-127; per-route `requireAuth({roles})` everywhere); a matrix = permission store + middleware swap + auditing all 134 endpoints' gates.
- "Defer until a tenant literally begs." Crons: none. **MED**

## 3 · Council
- **AMBER (recommend defer)** | MS. Fixed roles are an auditable security posture; a matrix multiplies auth-bug surface in a solo codebase "where one missed check is a tenant-isolation breach (the inline-eq law exists because isolation is existential)."
- Rule-20-style substitute offered: "staff visibility" settings (which nav/data a staff login sees) *within* the fixed roles. Trade-off: enterprise-ish checklists unchecked. Collision: NO. **HIGH**

## 4 · Support/CRM
- **none-in-addis-today**: three fixed roles fit 1-3 staff shops exactly; listed in §3 "What NOT to build" (HR-grade surfaces for 1-3 person shops).
- Evidence: UNDOCUMENTED. Notice day 1: **n**.

## 5 · Challenge round
**A → B:** effort disagreement on the same DEFER — A scores the matrix **L**, B scores it **M** (security-sensitive); the ladder and the audit-table cost land differently.
**C → A:** C carries a buildable substitute (staff-visibility settings inside fixed roles) that neither A's bare DEFER nor B's wait-and-see includes.

## 6 · Chair log
- **Agreed:** three fixed roles stand; no per-member matrix this season.
- **Contested:** L vs M effort classification; whether C's staff-visibility substitute is worth a ticket of its own.
- **Escalation:** None.
- **Closure state:** CLEARED
