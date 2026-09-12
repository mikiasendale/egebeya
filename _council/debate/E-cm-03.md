# Debate — E-cm-03 Custom intake & consultation forms

**Surface (declared per persona):** A: merchant SaaS | B: undeclared (per-row) | C: MS | D: MS (client-management) — flag: B carries no surface (Rule 1).

## 1 · Product Owner
Form-definition engine = **DEFER**. Minimal substitute: one optional free-text "notes for the salon" at booking feeding E-cm-02 (PublicBooking.tsx:15-23 fixed capture verified MED) — **ship inside T7.11**. **MED**.

## 2 · Engineering Lead
Effort **M**. Booking capture is fixed zod (public.ts:596-621; PublicBooking.tsx). Ship 2–3 **preset** forms (consult, wax-aftercare) with JSON answers on the appointment — "a merchant form *builder* is the Fresha depth and is L; don't confuse them." Dep: E-cm-01 identity. Crons: none; no money-path work. **MED**.

## 3 · Council
**AMBER-with-conditions** (MS). Custom fields = arbitrary PII capture — "health answers arrive in 'any questions?' boxes, **laundering E-cm-02 past its ruling**." Conditions: question-type allowlist (no free-text clinical prompts), per-form retention label, answers stored phone-keyed → erasure matrix, and the fixed zod booking capture (PublicBooking.tsx:15-23) **stays the identity contract**. No CEO-ruling request of its own; inherits E-cm-02's exposure via laundering. **MEDIUM**.

## 4 · Support/CRM
Impact **LOW**. Workaround (code path): "intake happens in Telegram chat post-booking — the product outsources the form to the messaging app, which is honest but invisible to analytics" (Gap.md:155). OBSERVED-workaround (fixed schema, code-proven). Day-1: n.

## 5 · Challenge round
**C → A:** A's free-text "notes for the salon" is precisely the unbounded capture C's question-allowlist condition exists to prevent — the substitute as specced violates the ruling on its sibling row (E-cm-02).
**B → A:** B wants preset structured forms at M; A wants one free-text field — different smallest units for the same ticket.
**D → A/B:** both plan an intake capture in-app while D rates the pain LOW with a working (if invisible) Telegram workaround.

## 6 · Chair log
- **Agreed:** no merchant form-builder this cycle (A DEFER, B's "don't confuse them", C's scope); fixed zod booking capture stays the identity contract.
- **Contested:** substitute shape — free-text note (A) vs preset JSON forms (B) vs allowlisted questions only (C); whether anything ships before E-cm-02's ruling (C's laundering warning vs A's "feeds E-cm-02").
- **Escalation:** None of its own — the E-cm-02 PDPL ruling (already escalated) binds any clinical-adjacent capture here; A's plan to feed the note "into E-cm-02" hits a row that is itself AWAITING-CEO.
- **Closure state:** CONTESTED-DEFER
