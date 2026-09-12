ID: E-ca-02 (+ Fresha pair F-mp-71)
Name: Notification & marketing preferences (consumer consent centre)
Surface: consumer marketplace
Category: consumer-account
Class: PARTIAL (COMPARE-01 — consent capture + STOP suffix present; no consumer-facing preference centre; toggle lives on the merchant CRM)
Fresha behaviour: Consumer-side notification & marketing preference management (hc/103992 FAQ block). KB provenance: OBSERVED.
Egebeya current state: Consent is captured in three stores — customer_stats.marketingOptIn (schema.ts:288-292), consumers.consentGivenAt (:455-461), telegram_links.consentGivenAt (:420-429) — but withdrawable only by the merchant (src/api/crm.ts:246-291); the SMS "Reply STOP" suffix (crm.ts:206) has NO inbound path — sms.ts is send-only (B's finding: the suffix is a lie today).
Blockers: legal (PDPL 1321/2024 withdrawal parity) + infra half (SMS inbound provider does not exist)
Debate summary: A called it NOW as a DUTY, not a scored candidate — capture in three places, withdrawal in one, PDPL wants parity; B re-scored COMPARE-04's S to M (three consent stores must move atomically) and proved the SMS-STOP half NOT-feasible-without-an-inbound-provider, so the promise must be deleted or footnoted; C ruled GREEN-as-duty shipping before any marketing expansion and gating E-mg-01/E-an-06 on it; D: "every un-honored STOP is a PDPL exposure and a support ticket to the founder." The only contest was A's "STOP everything" wording vs B's provider fact; the Chair cleared it with the duty flag.
Council ruling: BUILD NOW (as a DUTY — T7.12)
Closure method (if BUILD): Scope: consumer consent centre — prefs GET/PUT + "STOP everything" + Telegram `/stop` consumed in the live webhook (telegram.ts:36). Entity changes: none new; withdrawal timestamps stamped across all three consent stores (schema.ts:288-292, :420-429, :455-461) atomically — "withdrawal as easy as grant". Endpoint changes: consumer-facing GET/PUT preferences. UI changes: consumer prefs surface (both locales, AGENTS.md:36). STOP-inbound: Telegram handler ships; the SMS "Reply STOP" promise is DELETED or footnoted until an inbound SMS provider exists (B's finding) — an honored STOP must never be a dead suffix. Blast (crm.ts:182) and winback (cron W) read the opt-in SQL-side; `marketing_opt_in` stays real consent, never fabricated (loyalty-opening Do-Not). Tests: no chain-payments-billing case (outside the payments register); parity test for the three-store lowering + i18n parity per ritual.
Substitute method (if SUBSTITUTE/DEFER-with-substitute): n/a (BUILD NOW). The SMS-inbound half is the named NOT-feasible-without-X carve-out, trade-off: SMS-only consumers cannot withdraw by reply until a provider exists.
Owner: Engineering Lead (the duty stands for Support-CRM's queue)
Effort: M (B §3 audit overrides COMPARE-04's S — three consent stores, "the 'S' was counting the column, not the file")
Money path: NO (consent state only; not in the payments register)
Protected decision referenced (if any): none; merchant_card consent stays loyalty-participation-only and is NOT touched here (AGENTS.md law)
EGE-ADVANTAGE collision (if any): none — EGE-ADV #13 (PDPL-as-product) is strengthened, not collided (C)
Merchant evidence: HIGH as a duty / LOW as a feature; day-1: y for the spammed consumer, which is the merchant's reputation; OBSERVED-workaround: the suffix that nothing reads (FSD-002:189).
Confidence: HIGH
CEO ruling (final): Not escalated — council ruling stands (Chair: CLEARED; ships before marketing expansion, gates E-mg-01 blasts per the Chair's E-mg-01 ruling). Ruling 9's decoupling note confirms the T7.11 bundle split logic this row anchors.
