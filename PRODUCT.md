# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary:** Ethiopian small-business owners (salons, clinics, spas, barbershops, pharmacies, and similar service categories). They are putting their business online for the first time, in-country, often running the whole business from a single phone. Their job-to-be-done: publish a public website for the business and run it themselves — services, staff, hours, photos, contact — and optionally turn on booking and mobile-money deposit on top of that site, without a developer, designer, or website vendor.
- **Secondary:** Their customers — Ethiopian end-customers arriving at the public site either to read about the business or (when the owner enables it) to book a slot and pay a Telebirr deposit through Chapa.
- Not targeted: corporate multi-branch franchise operators or global/international deployments (explicitly out of scope per founder direction).

## Product Purpose

Egebeya is a no-code website builder for Ethiopian service businesses. From a phone, a non-technical owner assembles a one-page public site for their business — services, staff, hours, photos, contact — and can also switch on optional booking and Telebirr deposit flows on top of that site. The builder carries Ethiopia-default integrations (Addis timezone, Ethiopian calendar, Telebirr-via-Chapa, Amharic brand option) so that adding "book online" or "take a deposit before confirming" does not require a developer threading mobile-money details. Success means an owner publishes a live site, runs it on their own phone, and stops losing customers to "no answer" phone calls.

## Positioning

The only no-code website builder built with Ethiopia-default integrations pre-wired rather than shipping as localization afterthoughts. An Ethiopian service-business owner can publish a site, edit pages, add services/staff/hours, enable booking, take a Telebirr deposit via Chapa, and toggle an Ethiopian-calendar display — all from a phone, in seconds, without a developer or designer. A neighboring generic no-code builder (Wix / Squarespace / a regional SaaS) could add all of these as afterthoughts; it cannot truthfully claim them as defaults out of the box, which is the gap Egebeya is built to close.

**80 / 20 framing: the builder is the product; the integrations are why it makes sense here.** The no-code website builder is the headline (~80% of the product surface); the Telebirr/Ethiopia-default integrations on top are the contextual fit (~20% — the part that turns a generic builder into one that makes sense for an Ethiopian service business). Telebirr-via-Chapa remained an integration, not the product's bedrock.

## Operating Context

- **Timezone:** Africa/Addis_Ababa (UTC+3). Owner dashboard displays and public pages use Addis local time by default; storage stays UTC ms.
- **Calendar:** Ethiopian calendar is a first-class option (`settings.calendar_display = 'ethiopian'`); Gregorian is the default. The toggle is one switch, not a localization project.
- **Payments:** Telebirr via the Chapa SDK is **an integration owners can enable**, not the core loop. Direct charge initiate → authorize → verify is the happy path; webhook signature (HMAC-SHA256 via `verifyWebhookSignature`) confirms completion; failure rolls back the appointment and payment row.
- **Identity:** Local phone numbers (+251 / 0...), Amharic glyph as a first-class brand option (not yet a committed wordmark — see Brand Commitments).
- **Tenancy:** Each business is a tenant, addressable by subdomain (`<slug>.egebeya.et`) or, on the main domain, by `/:slug/book`. Plans gate features (Basic vs. Pro; `max_staff` and `custom_domain_allowed`).
- **Phone / message ritual** of today's Ethiopian service booking is the anti-reference; the builder replaces call-and-confirm with self-serve online sites the owner can update themselves.

## Capabilities and Constraints

- **Confirmed features:**
  - Owner auth (phone + JWT), tenant registration with unique slug (reserved words like "admin").
  - Services (name, duration, price in ETB cents, active flag), staff (name, title, image), staff↔service mapping, staff per-day-of-week availability, tenant business hours, closures.
  - Public availability endpoint with 30-min slot generation that respects closures, business hours, staff hours, and existing appointments; privacy-safe "today's queue" endpoint exposing only service name + time, never customer names (booking integration only).
  - Booking creation with double-book conflict check; pending status when upfront payment required, confirmed otherwise; booking + payment inserted transactionally.
  - Telebirr/Chapa direct charge + webhook; signature verification; rollback on charge failure.
  - Puck visual website editor per tenant; saved Puck document is rendered on the public site (item shape `{ type, props, data: {} }`).
  - Setup wizard (business hours → first service → first staff with default availability → onboarding complete).
  - Owner-facing dashboard pages: bookings, services, staff, media upload (sharp-resized), website editor, settings.
  - Plan-limit middleware enforcing `max_staff`; custom domain gated by Pro.
- **Tech constraints:** Express + Drizzle over SQLite (dev) and MySQL/MariaDB (prod via Plesk); react-router on the frontend; Puck for visual editing; date-fns-tz + a custom Addis timezone helper for time math. Vite is used in middleware mode inside Express for HMR (dev) and for the production build.
- **Terminology:** "Tenant" = one business; "slug" = its public identifier; "tx_ref" = the Chapa transaction reference; "gateway_reference" = stored Chapa tx_ref on payments; "integration" = a switch-on feature the builder exposes (e.g. booking, Telebirr deposit, Ethiopian-calendar display).
- **Open decisions (not yet decided):** SMS gateway provider (a `SMS_API_KEY` env slot exists but the actual reminder cron uses email today); the depth and breadth of the no-code builder's component library beyond what Puck ships with; the full integration catalog that should ship pre-wired (calendar, Amharic copy, additional payment rails, etc.); if/when internationalization matters beyond the Addis/Ethiopian context.

## Brand Commitments

- **Locked:** none.
- **Not locked:** product name (currently "Egebeya"), the ኢ-ገበያ wordmark, specific colors, typography, logo treatment, photography, voice/copy — all open for a future redesign pass. The visual world previously recorded in DESIGN.md was authored against the older "Telebirr-first" positioning and is **not binding** under the current 80 / 20 framing; a fresh visual world will be chosen in a redesign / new-work pass.

## Evidence on Hand

- `README.md` — feature list, deployment notes (Plesk), env vars.
- `server/seed.ts` — two real tenant fixtures: `luxnails` ("Lux Nails & Spa", salon, no upfront payment, Ethiopian calendar display) and `testpayment` ("Test Payment Barbershop", salon, requires Chapa upfront payment, Gregorian calendar). Both have seeded business hours, staff availability, and a Puck page template.
- `qa_runner.ts` — passes the Chapa payment + booking + webhook + availability flow end-to-end.
- Real working end-to-end flow verified on the running dev server: slot generation in Addis time, Addis-offset booking timestamps stored as correct UTC ms, plan-limit 403 on exceeding `max_staff`, webhook 403 on invalid signature and 200 on valid HMAC.
- Known absences that future work must not fabricate: no real customer testimonials, no published pricing in the repo, no Ethiopian phone-format input masks, no Ethiopian-language full UI copy (only a brand glyph + a few labels today).
- The live marketing page already in `index.html` (hero copy "Bookings confirmed by Telebirr"; meta description "The Telebirr-first booking site…") is **a candidate to be replaced** under the new positioning, not a binding claim. It belongs to the upcoming visual-world work, not to durable product truth.

## Product Principles

1. **The builder is the product.** Every owner action lives inside the builder's flow: publish a site, edit a page, change hours, toggle an integration. Anything that pushes the owner out of the builder (a developer, a config file, a vendor) is a product failure.
2. **Integrations are pre-wired, not patchwork.** When a feature matters for the Ethiopian audience it ships as a default or as a one-switch toggle — never as a developer task. Telebirr-via-Chapa, Ethiopian calendar, Amharic glyph, Addis time are all in this category; a "neutral international" framing betrays the audience.
3. **Local first, always (as default, not as a phase).** Addis timezone, Ethiopian-calendar default, +251 phones, Amharic brand option are on by default. Localization is the starting state, not a post-launch fix.
4. **Self-serve on a phone.** Schema, migrations, builder config surgery are product failures when visible to the owner. The closing-the-loop surface is the phone screen.
5. **The lender of attention is the queue (when booking is on).** Privacy-safe upcoming-appointments visibility (service + time only) earns the customer's trust when the booking integration is enabled; never expose customer names publicly. Builder surfaces without booking don't render a queue and aren't bound by this rule.
6. **Identity is earned in precise details.** The Ethiopia-default integrations themselves are identity moments — not localizations layered on top of a generic SaaS. Generic Tailwind chrome undersells the differentiator.

## Accessibility & Inclusion

- Ethiopia-first: design must work on small, older Android devices on 3G, often in Amharic-first or Afaan Oromo-first circumstances. No keyboard-trap interactions anywhere; the customer-facing booking flow (when enabled) must be touch-dominant and tolerable on narrow screens.
- Customer-facing surfaces are reachable without an account (public site, public booking page, public queue view when booking is on) — a confirmed product commitment, not an accident.
- **The builder itself must remain usable on small Android screens — owner-on-phone is the operating mode, not a fallback.** This is now an explicit accessibility commitment, not an implicit one.
- No formal accessibility standard (WCAG level) was set as a binding requirement yet; this is recorded as an open decision rather than invented.
