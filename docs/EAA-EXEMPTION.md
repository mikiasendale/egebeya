# EAA Microenterprise Exemption — internal record

**Claim made:** egebeya relies on the microenterprise exemption in **Article 4(5) of Directive (EU) 2019/882** (the European Accessibility Act) for its services, including when offered to consumers in the Union.

**Date recorded:** 2026-09-05 (Wayfinder decision [#15](https://github.com/mikiasendale/egebeya/issues/15))

## Facts relied on (Art. 3(23) definition)

| Criterion | Threshold | egebeya (at recording) |
|---|---|---|
| Employees | fewer than 10 persons | **below threshold** — update this number on any hire |
| Annual turnover | not exceeding €2,000,000 **or** | well below — re-check each fiscal year |
| Annual balance-sheet total | not exceeding €2,000,000 (the financial test is *OR*) | well below |

The enterprise-size test follows Commission Recommendation 2003/361/EC, which counts **linked/partner enterprises**. If egebeya ever shares capital or control with another entity, recount before relying on the exemption.

## What the exemption covers

- Art. 4(5) exempts **microenterprises providing services** from the accessibility requirements of Annex I Sections III/IV **and from the obligations relating to compliance** — which includes the Art. 13(2) accessibility-statement obligation and the Art. 14(8) notification duty.
- Self-assessed. **No filing, registration, or notification is required.** Market-surveillance authorities may ask for the facts; this document plus the yearly re-check below is the evidence file.
- Scope catch (Art. 3(4)): the directive reaches any provider "on the Union market **or makes offers to provide such a service to consumers in the Union**" — so the analysis (and this record) applies even though egebeya is Ethiopia-based and Ethiopia-directed.

## What we do anyway (voluntary, decision #15 Q2/Q3)

- A public accessibility statement (`/accessibility`, EN 301 549 Annex B/C shape) states the exemption basis, targets WCAG 2.1 AA, and takes barrier reports as priority feedback.
- Accessibility basics on the highest-traffic customer surfaces (booking flow, Discover directory) are maintained as ordinary quality work.
- Accessibility reports arriving through `/accessibility` or `/api/public/report` are triaged as priority feedback.

## Re-check triggers (the exemption dies with no grace period)

1. **Headcount reaches 10** (any hire — count on every onboarding).
2. **Turnover or balance sheet crosses €2,000,000** (annual fiscal review).
3. **Ownership/control changes** creating linked or partner enterprises.
4. **EU consumer offer becomes deliberate** (marketing targeting EU users) — re-run the full compliance question then, including EN 301 549 conformance and the statement obligations that stop being voluntary.

When any trigger fires: re-audit against WCAG 2.1 AA (EN 301 549), update or retire the `/accessibility` statement, and record the change here.

## Sources (verified 2026-09-05 via Wayfinder research ticket #9)

- Directive (EU) 2019/882 text: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32019L0882 (Art. 3(4), 3(23), 4(5), 13, 14(8))
- Commission EAA page: https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/union-equality-strategy-rights-persons-disabilities-2021-2030/european-accessibility-act_en
- WCAG: https://www.w3.org/WAI/standards-guidelines/wcag/ · EN 301 549: https://www.etsi.org/deliver/etsi_en/301500_301599/301549/

*This document is an internal compliance record, not legal advice.*
