# Rulings Summary — 68 in-scope Gap.md features

CP5-APPROVED 2026-09-12 (CEO). Money YES ⇒ CAUTION — every such change lands with a new case in server/tests/chain-payments-billing.test.ts (rule 6). Source: _council/rulings/{id}.md; authority: _council/ceo-rulings-cp4.md.

## Sorted by decision

| ID | Name | Decision | Surface | Category | Effort | Money | Confidence |
|---|---|---|---|---|---|---|---|
| E-mg-05 | Review engine (collect / reply / report) | BUILD | consumer marketplace + merchant SaaS | marketing-growth | L |  | MEDI |
| E-ai-03 | Calendar sync — CEO-redefined to shared busine | BUILD NEXT | merchant SaaS | api-integrations (INFRA-BLOCKED grouping in Gap.md) | M |  | HIGH |
| E-an-06 | Birthday / welcome / milestone / reward-loyal  | BUILD NEXT | merchant SaaS + consumer marketplace | automation-notifications | M | YES | MEDI |
| E-ar-02 | Automation performance | BUILD NEXT | merchant SaaS | analytics-reporting | M |  | MEDI |
| E-ar-04 | Client-source attribution & ads conversion tra | BUILD NEXT | merchant SaaS | analytics-reporting | M |  | HIGH |
| E-bc-07 | Appointment statuses & notes | BUILD NEXT | merchant SaaS | booking-core | M |  | HIGH |
| E-bc-08 | Reschedule (merchant drag + client self-serve) | BUILD NEXT | merchant SaaS | booking-core | M |  | HIGH |
| E-bc-09 | Cancellation with reason capture | BUILD NEXT | consumer marketplace | booking-core | S |  | HIGH |
| E-bc-11 | Sell-online toggle + lead/max-notice controls | BUILD NEXT | merchant SaaS | booking-core | S/M |  | HIGH |
| E-cm-01 | Client profiles & history | BUILD NEXT | merchant SaaS | client-management | M |  | HIGH |
| E-cm-02 | Allergy & patch-test records | BUILD NEXT | merchant SaaS | client-management | S |  | HIGH |
| E-cm-04 | Tags & segments | BUILD NEXT | merchant SaaS | client-management | S |  | HIGH |
| E-cm-06 | Files on client profiles | BUILD NEXT | merchant SaaS | client-management | S |  | HIGH |
| E-cm-07 | Block clients from booking | BUILD NEXT | merchant SaaS + consumer marketplace | client-management | S |  | HIGH |
| E-cs-05 | Custom domain (verification) | BUILD NEXT | merchant SaaS | content-site | M |  | HIGH |
| E-cs-06 | Book button / embed / share link (QR + snippet | BUILD NEXT | merchant SaaS | content-site | S |  | HIGH |
| E-ds-01 | Category browsing | BUILD NEXT | consumer marketplace | discovery-search | S |  | MEDI |
| E-ds-03 | Neighbourhood scoping | BUILD NEXT | consumer marketplace | discovery-search | M |  | MEDI |
| E-ds-07 | Same-day availability surfacing | BUILD NEXT | consumer marketplace | discovery-search | M |  | MEDI |
| E-mg-01 | Blast campaigns (email & text) — scheduling, b | BUILD NEXT | merchant SaaS | marketing-growth | M | YES | MEDI |
| E-ml-01 | Multiple business locations | BUILD NEXT | merchant SaaS + platform | multi-location | L |  | HIGH |
| E-ml-02 | Independent merchants / workspace (chair-rente | BUILD NEXT | merchant SaaS + platform | multi-location | L | YES | MEDI |
| E-ms-01 | Smart calendar | BUILD NEXT | merchant SaaS | merchant-scheduling | M |  | HIGH |
| E-ms-02 | Shift scheduling / rosters | BUILD NEXT | merchant SaaS | merchant-scheduling | M |  | HIGH |
| E-pm-08 | Tips | BUILD NEXT | consumer marketplace + merchant SaaS | payments-money | M | YES | HIGH |
| E-pm-09 | Gift cards (sell & redeem) | BUILD NEXT | consumer marketplace + merchant SaaS | payments-money | L | YES | HIGH |
| E-pm-11 | Packages & service bundles | BUILD NEXT | merchant SaaS | payments-money | L | YES | MEDI |
| E-pm-15 | Refunds & deposit refunds | BUILD NEXT | consumer marketplace + merchant SaaS | payments-money | S | YES | HIGH |
| E-pm-16 | Void, raise, edit sale; receipts | BUILD NEXT | merchant SaaS | payments-money | M | YES | HIGH |
| E-pm-17 | Taxes, service charges, surcharges | BUILD NEXT | merchant SaaS | payments-money | M | YES | HIGH |
| E-pm-18 | Manual/offline payment types | BUILD NEXT | merchant SaaS | payments-money | M | YES | HIGH |
| E-tp-01 | Team member profiles | BUILD NEXT | merchant SaaS | team-permissions | S |  | HIGH |
| E-tp-04 | Wages, commissions & per-member pricing | BUILD NEXT | merchant SaaS | team-permissions | M | YES | HIGH |
| E-tp-05 | Login permissions & member lifecycle | BUILD NEXT | merchant SaaS | team-permissions | S |  | HIGH |
| E-ts-03 | No-show protection as a policy engine | BUILD NEXT | merchant SaaS | trust-safety | S |  | HIGH |
| E-an-01 | Appointment reminder lead time | BUILD NOW | merchant SaaS | automation-notifications | S |  | HIGH |
| E-an-03 | Rescheduled / cancelled notices | BUILD NOW | merchant SaaS | automation-notifications | S |  | HIGH |
| E-an-04 | Did-not-show / thank-you / tip / waitlist / sl | BUILD NOW | merchant SaaS | automation-notifications | S/M |  | HIGH |
| E-ar-01 | Reporting & analytics (merchant) | BUILD NOW | merchant SaaS | analytics-reporting | S |  | HIGH |
| E-ca-02 | Notification & marketing preferences (consumer | BUILD NOW | consumer marketplace | consumer-account | M |  | HIGH |
| E-ds-06 | Price-visible menus pre-booking | BUILD NOW | consumer marketplace | discovery-search | S |  | HIGH |
| E-l10n-01 | Bilingual UI (Amharic-first) — default-locale  | BUILD NOW | consumer marketplace | localization | S/M |  | HIGH |
| E-ms-03 | Blocked time & closures (write path) | BUILD NOW | merchant SaaS | merchant-scheduling | S |  | HIGH |
| E-bc-03 | Waitlist | DEFER | consumer marketplace | booking-core | L |  | MEDI |
| E-bc-04 | Group bookings | DEFER | consumer marketplace | booking-core | L | YES | MEDI |
| E-bc-06 | Service sequencing / rooms | DEFER | merchant SaaS | booking-core | L |  | HIGH |
| E-bc-10 | New-appointment assignment rules | DEFER | merchant SaaS | booking-core | M |  | MEDI |
| E-ca-01 | Client account & marketplace profile | DEFER | consumer marketplace | consumer-account | M |  | HIGH |
| E-cm-03 | Custom intake & consultation forms | DEFER | merchant SaaS | client-management | S |  | MEDI |
| E-ds-02 | Treatment-level search | DEFER | consumer marketplace | discovery-search | M |  | MEDI |
| E-ds-05 | Aggregate rating display | DEFER | consumer marketplace | discovery-search | M |  | HIGH |
| E-mg-06 | Referral program (client-to-client loop with r | DEFER | merchant SaaS + consumer marketplace | marketing-growth | M |  | HIGH |
| E-ml-03 | Cross-location continuity / operator visibilit | DEFER | merchant SaaS + platform | multi-location | M |  | HIGH |
| E-ms-04 | Time-off types (absence taxonomy + request/app | DEFER | merchant SaaS | merchant-scheduling | M |  | HIGH |
| E-pm-05 | Per-appointment payment-policy override | DEFER | merchant SaaS | payments-money | M | YES | MEDI |
| E-tp-02 | Custom permission roles | DEFER | merchant SaaS | team-permissions | L |  | HIGH |
| E-tp-03 | Timesheets & clock in/out | DEFER | merchant SaaS | team-permissions | M |  | MEDI |
| E-ts-02 | Report / reply to reviews (moderation) | DEFER behind E-mg-05 | consumer marketplace + platform | trust-safety | M |  | HIGH |
| E-ms-05 | Processing & finishing times / buffers & extra | DEFER behind T6.4 | merchant SaaS | merchant-scheduling | M |  | HIGH |
| E-ai-04 | Social-surface booking (Google Reserve / Meta) | SKIP | consumer marketplace | api-integrations | M |  | HIGH |
| E-pm-06 | Card terminals | SKIP | merchant SaaS | payments-money | n/a |  | HIGH |
| E-pm-19 | Merchant credit (Fresha Capital) | SKIP | platform | payments-money | n/a |  | HIGH |
| E-cm-05 | Client list import/export/merge/delete | SPLIT | merchant SaaS | client-management | S |  | HIGH |
| E-pm-07 | Tap-to-pay / QR / self-checkout / Pay Now link | SPLIT | merchant SaaS + consumer marketplace | payments-money | S | YES | HIGH |
| E-ai-05 | Data export / BI connector | SUBSTITUTE | merchant SaaS | api-integrations (INFRA-BLOCKED grouping in Gap.md) | M |  | HIGH |
| E-ds-04 | Map view | SUBSTITUTE | consumer marketplace | discovery-search | L |  | HIGH |
| E-mg-07 | Marketplace visibility boosting (quality rank  | SUBSTITUTE / NOW-half: free quality-rank r | consumer marketplace + platform | marketing-growth | S |  | HIGH |
| E-mg-02 | Deals & promotions | SPLIT: widget-lie fix NOW / wrapper NEXT | merchant SaaS | marketing-growth | M | YES | HIGH |

## Tally

- **34** × BUILD NEXT
- **14** × DEFER
- **8** × BUILD NOW
- **3** × SKIP
- **2** × SUBSTITUTE
- **2** × SPLIT
- **1** × SPLIT: widget-lie fix NOW / wrapper NEXT (E-mg-02)
- **1** × BUILD
- **1** × SUBSTITUTE / NOW-half: free quality-rank r
- **1** × DEFER behind T6.4
- **1** × DEFER behind E-mg-05  
Money-path rows (CAUTION): **15**

## Sorted by surface

| ID | Name | Decision | Surface | Category | Effort | Money | Confidence |
|---|---|---|---|---|---|---|---|
| E-ai-04 | Social-surface booking (Google Reserve / Meta) | SKIP | consumer marketplace | api-integrations | M |  | HIGH |
| E-bc-03 | Waitlist | DEFER | consumer marketplace | booking-core | L |  | MEDI |
| E-bc-04 | Group bookings | DEFER | consumer marketplace | booking-core | L | YES | MEDI |
| E-bc-09 | Cancellation with reason capture | BUILD NEXT | consumer marketplace | booking-core | S |  | HIGH |
| E-ca-01 | Client account & marketplace profile | DEFER | consumer marketplace | consumer-account | M |  | HIGH |
| E-ca-02 | Notification & marketing preferences (consumer | BUILD NOW | consumer marketplace | consumer-account | M |  | HIGH |
| E-ds-01 | Category browsing | BUILD NEXT | consumer marketplace | discovery-search | S |  | MEDI |
| E-ds-02 | Treatment-level search | DEFER | consumer marketplace | discovery-search | M |  | MEDI |
| E-ds-03 | Neighbourhood scoping | BUILD NEXT | consumer marketplace | discovery-search | M |  | MEDI |
| E-ds-04 | Map view | SUBSTITUTE | consumer marketplace | discovery-search | L |  | HIGH |
| E-ds-05 | Aggregate rating display | DEFER | consumer marketplace | discovery-search | M |  | HIGH |
| E-ds-06 | Price-visible menus pre-booking | BUILD NOW | consumer marketplace | discovery-search | S |  | HIGH |
| E-ds-07 | Same-day availability surfacing | BUILD NEXT | consumer marketplace | discovery-search | M |  | MEDI |
| E-l10n-01 | Bilingual UI (Amharic-first) — default-locale  | BUILD NOW | consumer marketplace | localization | S/M |  | HIGH |
| E-mg-05 | Review engine (collect / reply / report) | BUILD | consumer marketplace + merchant SaaS | marketing-growth | L |  | MEDI |
| E-pm-08 | Tips | BUILD NEXT | consumer marketplace + merchant SaaS | payments-money | M | YES | HIGH |
| E-pm-09 | Gift cards (sell & redeem) | BUILD NEXT | consumer marketplace + merchant SaaS | payments-money | L | YES | HIGH |
| E-pm-15 | Refunds & deposit refunds | BUILD NEXT | consumer marketplace + merchant SaaS | payments-money | S | YES | HIGH |
| E-mg-07 | Marketplace visibility boosting (quality rank  | SUBSTITUTE / NOW-half: free quality-rank r | consumer marketplace + platform | marketing-growth | S |  | HIGH |
| E-ts-02 | Report / reply to reviews (moderation) | DEFER behind E-mg-05 | consumer marketplace + platform | trust-safety | M |  | HIGH |
| E-ai-03 | Calendar sync — CEO-redefined to shared busine | BUILD NEXT | merchant SaaS | api-integrations (INFRA-BLOCKED grouping in Gap.md) | M |  | HIGH |
| E-ai-05 | Data export / BI connector | SUBSTITUTE | merchant SaaS | api-integrations (INFRA-BLOCKED grouping in Gap.md) | M |  | HIGH |
| E-an-01 | Appointment reminder lead time | BUILD NOW | merchant SaaS | automation-notifications | S |  | HIGH |
| E-an-03 | Rescheduled / cancelled notices | BUILD NOW | merchant SaaS | automation-notifications | S |  | HIGH |
| E-an-04 | Did-not-show / thank-you / tip / waitlist / sl | BUILD NOW | merchant SaaS | automation-notifications | S/M |  | HIGH |
| E-ar-01 | Reporting & analytics (merchant) | BUILD NOW | merchant SaaS | analytics-reporting | S |  | HIGH |
| E-ar-02 | Automation performance | BUILD NEXT | merchant SaaS | analytics-reporting | M |  | MEDI |
| E-ar-04 | Client-source attribution & ads conversion tra | BUILD NEXT | merchant SaaS | analytics-reporting | M |  | HIGH |
| E-bc-06 | Service sequencing / rooms | DEFER | merchant SaaS | booking-core | L |  | HIGH |
| E-bc-07 | Appointment statuses & notes | BUILD NEXT | merchant SaaS | booking-core | M |  | HIGH |
| E-bc-08 | Reschedule (merchant drag + client self-serve) | BUILD NEXT | merchant SaaS | booking-core | M |  | HIGH |
| E-bc-10 | New-appointment assignment rules | DEFER | merchant SaaS | booking-core | M |  | MEDI |
| E-bc-11 | Sell-online toggle + lead/max-notice controls | BUILD NEXT | merchant SaaS | booking-core | S/M |  | HIGH |
| E-cm-01 | Client profiles & history | BUILD NEXT | merchant SaaS | client-management | M |  | HIGH |
| E-cm-02 | Allergy & patch-test records | BUILD NEXT | merchant SaaS | client-management | S |  | HIGH |
| E-cm-03 | Custom intake & consultation forms | DEFER | merchant SaaS | client-management | S |  | MEDI |
| E-cm-04 | Tags & segments | BUILD NEXT | merchant SaaS | client-management | S |  | HIGH |
| E-cm-05 | Client list import/export/merge/delete | SPLIT | merchant SaaS | client-management | S |  | HIGH |
| E-cm-06 | Files on client profiles | BUILD NEXT | merchant SaaS | client-management | S |  | HIGH |
| E-cs-05 | Custom domain (verification) | BUILD NEXT | merchant SaaS | content-site | M |  | HIGH |
| E-cs-06 | Book button / embed / share link (QR + snippet | BUILD NEXT | merchant SaaS | content-site | S |  | HIGH |
| E-mg-01 | Blast campaigns (email & text) — scheduling, b | BUILD NEXT | merchant SaaS | marketing-growth | M | YES | MEDI |
| E-mg-02 | Deals & promotions | SPLIT: widget-lie fix NOW / wrapper NEXT | merchant SaaS | marketing-growth | M | YES | HIGH |
| E-ms-01 | Smart calendar | BUILD NEXT | merchant SaaS | merchant-scheduling | M |  | HIGH |
| E-ms-02 | Shift scheduling / rosters | BUILD NEXT | merchant SaaS | merchant-scheduling | M |  | HIGH |
| E-ms-03 | Blocked time & closures (write path) | BUILD NOW | merchant SaaS | merchant-scheduling | S |  | HIGH |
| E-ms-04 | Time-off types (absence taxonomy + request/app | DEFER | merchant SaaS | merchant-scheduling | M |  | HIGH |
| E-ms-05 | Processing & finishing times / buffers & extra | DEFER behind T6.4 | merchant SaaS | merchant-scheduling | M |  | HIGH |
| E-pm-05 | Per-appointment payment-policy override | DEFER | merchant SaaS | payments-money | M | YES | MEDI |
| E-pm-06 | Card terminals | SKIP | merchant SaaS | payments-money | n/a |  | HIGH |
| E-pm-11 | Packages & service bundles | BUILD NEXT | merchant SaaS | payments-money | L | YES | MEDI |
| E-pm-16 | Void, raise, edit sale; receipts | BUILD NEXT | merchant SaaS | payments-money | M | YES | HIGH |
| E-pm-17 | Taxes, service charges, surcharges | BUILD NEXT | merchant SaaS | payments-money | M | YES | HIGH |
| E-pm-18 | Manual/offline payment types | BUILD NEXT | merchant SaaS | payments-money | M | YES | HIGH |
| E-tp-01 | Team member profiles | BUILD NEXT | merchant SaaS | team-permissions | S |  | HIGH |
| E-tp-02 | Custom permission roles | DEFER | merchant SaaS | team-permissions | L |  | HIGH |
| E-tp-03 | Timesheets & clock in/out | DEFER | merchant SaaS | team-permissions | M |  | MEDI |
| E-tp-04 | Wages, commissions & per-member pricing | BUILD NEXT | merchant SaaS | team-permissions | M | YES | HIGH |
| E-tp-05 | Login permissions & member lifecycle | BUILD NEXT | merchant SaaS | team-permissions | S |  | HIGH |
| E-ts-03 | No-show protection as a policy engine | BUILD NEXT | merchant SaaS | trust-safety | S |  | HIGH |
| E-an-06 | Birthday / welcome / milestone / reward-loyal  | BUILD NEXT | merchant SaaS + consumer marketplace | automation-notifications | M | YES | MEDI |
| E-cm-07 | Block clients from booking | BUILD NEXT | merchant SaaS + consumer marketplace | client-management | S |  | HIGH |
| E-mg-06 | Referral program (client-to-client loop with r | DEFER | merchant SaaS + consumer marketplace | marketing-growth | M |  | HIGH |
| E-pm-07 | Tap-to-pay / QR / self-checkout / Pay Now link | SPLIT | merchant SaaS + consumer marketplace | payments-money | S | YES | HIGH |
| E-ml-01 | Multiple business locations | BUILD NEXT | merchant SaaS + platform | multi-location | L |  | HIGH |
| E-ml-02 | Independent merchants / workspace (chair-rente | BUILD NEXT | merchant SaaS + platform | multi-location | L | YES | MEDI |
| E-ml-03 | Cross-location continuity / operator visibilit | DEFER | merchant SaaS + platform | multi-location | M |  | HIGH |
| E-pm-19 | Merchant credit (Fresha Capital) | SKIP | platform | payments-money | n/a |  | HIGH |
