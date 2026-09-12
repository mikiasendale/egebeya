# Debate — E-cs-05 Custom domain
**Surface (declared per persona):** A: merchant SaaS | B: n.d. per row | C: MS | D: merchant SaaS

## 1 · Product Owner
- Smallest unit: DNS TXT verification before the domain binds (PUT /api/tenant/domain verified HIGH in repo-map; format-check-only per matrix).
- **NEXT**; domain purchase **DEFER**. Band 2 #13. **MED**

## 2 · Engineering Lead
- **M**. PUT /api/tenant/domain is format-check + Pro (tenant.ts:406-448); resolution happens by Host header (ARCHITECTURE.md:92-100) → "an unverified domain claim is a takeover waiting for DNS to point."
- Fix: TXT-token challenge (outbound DNS lookup) before active. "Purchase = reseller decision, out." Crons: none. **MED**

## 3 · Council
- **AMBER-with-conditions** | MS. The named gap is DNS-ownership verification; an unverified claim is a takeover vector (competitor's domain pointed at platform infra / cert-issuance abuse).
- Conditions: TXT challenge before serving; idempotent guarded ADD COLUMN for any new column (AGENTS:38). Domain *purchase* = **RED** (registrar rail, money move outside booking — "E-pm-07's ruling covers the payment mechanic first"). Collision: NO. **HIGH**

## 4 · Support/CRM
- Impact **LOW**: workaround is `slug.egebeya.et` printed on the shop's Telegram stickers; "Addis discovery runs on Telegram, not address bars."
- Explicit reframe: "The missing *verification* is the security debt to note, not a merchant pain." Evidence: UNDOCUMENTED. Day 1: **n**.

## 5 · Challenge round
**D → A:** A sequences TXT verification as ordinary NEXT product work; D rates the merchant demand at zero — the row's only justification is B/C's takeover vector, i.e. a security fix, not a feature.
**C → A:** purchase is RED-needs-CEO-ruling territory for C (money move outside booking, coupled to E-pm-07) vs A's plain "DEFER" and B's "reseller decision, out."

## 6 · Chair log
- **Agreed:** the verification challenge ships; it stands on security grounds independent of D's zero-demand rating.
- **Contested:** purchase classification (quiet defer A/B vs CEO-ruling-gated C); whether the row is "feature" or "debt" for ladder purposes.
- **Escalation:** None. (Purchase, if ever pursued, rides the existing E-pm-07 CEO question C already filed.)
- **Closure state:** CLEARED
