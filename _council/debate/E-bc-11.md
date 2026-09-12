# Debate — E-bc-11 Online availability controls
**Surface (declared per persona):** A: merchant SaaS | B: not declared per row | C: MS+CM — ⚠ blend vs A's MS | D: paper-level CM+MS

## 1 · Product Owner
- Smallest unit: per-service `sellableOnline` flag + min-notice/max-lead settings-blob fields enforced in the availability generator.
- **NEXT** — "shares T7.2's settings-blob seam (`tenant.ts:1185`), genuinely requested merchant hygiene".
- Cites COMPARE-01 F-sa-98: active flags exist (schema.ts:74 verified HIGH), no lead controls. MED.

## 2 · Engineering Lead
- **S/M**: `services.active` + `staff.active` exist (schema.ts:74,85); add `sellable_online` + lead/max-notice on settings blob (tenant.ts:1185-1204 pattern). Enforce in `assertSlotAllowed` (**public.ts:623-714**) + grid start offset.
- Condition: the walk-in path (bookings.ts:345) must bypass "online" toggles by design (EGE-ADVANTAGE E-bc-12 semantics). Crons: none. HIGH.

## 3 · Council
- **GREEN-with-conditions**: per-service sellable-online flag + lead/max-notice windows, enforced in `assertSlotAllowed` (**public.ts:802, OBSERVED path**).
- Condition: min-notice must compose with the pending-payment slot-expiry reclaim (sendReminders expired-slot sweep) — "do not create windows where a slot is bookable but always expires unfunded". Collision: NO. HIGH.

## 4 · Support/CRM
- Impact MED. frequency: OBSERVED-workaround (only blunt flag exists; schema.ts:74 `active`).
- Workaround: an owner who doesn't want 9pm online bookings sets the service inactive **for everyone** — losing in-shop demand to protect the calendar; the "forced-blunt-instrument class of pain". Day-1: **y** the first busy Saturday.

## 5 · Challenge round
No challenges. C's reclaim-composition condition and B's walk-in-bypass condition are complementary guardrails on the same seam; D's forced-blunt pain is the demand A and B both cite.

## 6 · Chair log
- **Agreed:** build it (NEXT / S-M / GREEN / MED-pain); settings-blob seam tenant.ts:1185-1204; walk-ins bypass online toggles (EGE-ADV E-bc-12); min-notice must not fight the pending-slot reclaim.
- **Contested:**
  - Citation: B locates `assertSlotAllowed` at public.ts:623-714, C at public.ts:802 — same function, different lines; clerical, no effect on the verdict.
  - Surface label: A MS vs C MS+CM (blend vs Rule 1).
- **Escalation:** None.
- **Closure:** CLEARED
