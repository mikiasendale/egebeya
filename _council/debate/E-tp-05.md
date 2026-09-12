# Debate — E-tp-05 Login permissions & member lifecycle
**Surface (declared per persona):** A: merchant SaaS | B: n.d. per row | C: MS | D: merchant SaaS

## 1 · Product Owner
- Smallest unit: a `staff.status` enum (active/suspended/archived) so owners *archive* instead of DELETE (delete endpoint verified HIGH, tenant.ts:248) and history survives.
- **NEXT**, small integrity win; Band 2 #9, Staff-record bundle with E-tp-01. **HIGH**

## 2 · Engineering Lead
- **S**. Invite+delete exist (tenant.ts:129-260); "DELETE of a staff with appointment history is the current cliff" — add archive/suspend flags; `users.tokenVersion` exists (schema.ts:35) so force-logout is one update; "stop hard-deleting." Crons: none; first-weeks-eligible. **HIGH**

## 3 · Council
- **GREEN-with-conditions** | MS. Soft-delete flag + tokenVersion kill.
- Condition: appointment attribution (staffId) must survive archive — "history intact is the whole point"; delete path keeps working. Collision: NO. **HIGH**

## 4 · Support/CRM
- Impact **MED, "the data-loss one"**: a stylist leaving = delete (loses attribution) or keep-active ("pays for a ghost / steals a plan slot — staff is plan-gated, tenant.ts:101"). Workaround: a disabled-thing with a fake name. Feeds E-cm-01 (regulars die in a departing stylist's head).
- Evidence: OBSERVED-workaround (delete-only surface). Day 1: **n** — **y** at first staff exit (INFERRED-from-industry).

## 5 · Challenge round
**D → A:** A's unit is an enum so history survives; D's workaround exists because keeping-active costs money and a plan slot — the archive flag must also free the plan gate or the fake-name workaround survives the feature.
**A → B:** A holds the S diff for Band 2 #9 (bundled with E-tp-01); B lists it first-weeks-eligible — two slots for one diff.

## 6 · Chair log
- **Agreed:** archive/suspend (soft delete) + tokenVersion kill, with staffId attribution surviving archive; ships NEXT.
- **Contested:** whether the archive flag must carry plan-slot release (D's billing angle) — not in A/B/C's stated units.
- **Escalation:** None.
- **Closure state:** CLEARED
