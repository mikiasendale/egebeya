Egebeya PARTIAL and GAP features — function and current state
discovery-search

  E-ds-01 Category browsing — PARTIAL

    • Lets consumers browse venues by category, city, or name with paging.
    • Egebeya has one flat directory with four fixed categories; vertical landing hubs and 15-category spine are absent.EXPAND TO (aesthetics, barbershops, beauty-salons, eyebrows-and-lashes, gym-and-fitness, hair-salons, massage, nail-salons, personal-trainers, spas, tanning-studios, tattoo-and-piercing,therapy-centers, waxing-salons)
  E-ds-02 Treatment-level search — GAP

    • Lets consumers search for a specific treatment (e.g. “acrylic nails”) rather than just a venue.
    • Egebeya searches tenant name only; no treatment entity, no treatment×geo page grammar.
  E-ds-03 Neighbourhood scoping — PARTIAL

    • Lets consumers filter venues down to a district or neighbourhood.
    • Egebeya matches city as a free-text substring on settings JSON; no structured address, no district level.
  E-ds-04 Map view — GAP

    • Shows venues on a map so consumers can choose by proximity.
    • Egebeya has no coordinates, no distance sort, no map on the directory; only an embeddable per-site map block.
  E-ds-05 Aggregate rating display — PARTIAL

    • Shows a venue’s average rating and review count so consumers can trust unfamiliar venues.
    • Egebeya prints a binary NEW badge instead; no reviews or ratings table exists.
  E-ds-06 Price-visible menus pre-booking — PARTIAL
  Shows each service’s price and duration on the listing before booking.
 Prices appear on the merchant page and booking flow, but not on directory cards; no JSON-LD structured data.
    • E-ds-07 Same-day availability surfacing — GAP

        ◦ Advertises which venues have same-day openings so consumers can book today.
        ◦ Egebeya computes availability per day but never surfaces it in the directory; only inside the booking flow.



booking-core

    • E-bc-03 Waitlist — GAP

        ◦ Lets consumers join a queue for a fully booked day and get offered cancelled slots.
        ◦ Egebeya has no waitlist construct; the nearest mechanism is the take-a-number queue and expired-slot reclaim.
    • E-bc-04 Group bookings — GAP

        ◦ Lets one person book multiple attendees or seats in a single appointment.
        ◦ Egebeya supports one customer with N services; no multi-attendee booking, no per-seat capacity.
    • E-bc-06 Service sequencing — GAP

        ◦ Enforces ordered steps (consult-then-treat) and room/resource constraints within one appointment.
        ◦ Egebeya sums services into a single contiguous block; no ordered steps, no resource concept.
    • E-bc-07 Appointment statuses & notes — PARTIAL

        ◦ Tracks status lifecycle and lets staff add per-appointment notes.
        ◦ Egebeya has statuses (pending/confirmed/completed/cancelled/no_show) but no notes field on appointments.
    • E-bc-08 Reschedule (merchant drag + client self-serve) — PARTIAL

        ◦ Lets clients self-reschedule and merchants drag appointments on a calendar.
        ◦ Egebeya has client self-serve reschedule; merchant surface is a day-filtered list with no drag or calendar grid.
    • E-bc-09 Cancellation with reason capture — PARTIAL

        ◦ Lets clients cancel and records why they cancelled for merchant insight.
        ◦ Egebeya supports self-cancel and merchant status flip, but captures no cancellation reason anywhere.
    • E-bc-10 New-appointment assignment rules — GAP

        ◦ Automatically assigns new bookings by round-robin, seniority, or custom rules.
        ◦ Egebeya lets the consumer pick staff explicitly; no assignment rules exist.

    • E-bc-11 Online availability controls — PARTIAL

        ◦ Lets merchants control which services are sellable online and set booking lead/max-notice windows.
        ◦ Egebeya has active flags on services and staff, but no per-service “sellable online” toggle or lead controls.



payments-money

    • E-pm-05 Per-appointment payment-policy override — GAP

        ◦ Lets merchants override deposit/prepay rules for a single appointment at scheduling time.
        ◦ Egebeya policy is per-tenant and per-customer only; no per-appointment override.
    • E-pm-06 Card terminals — GAP

        ◦ Lets merchants accept card-present payments via hardware terminals.
        ◦ Egebeya has no hardware surface; rails are telebirr/mobile-money via Chapa only.
    • E-pm-07 Tap-to-pay / QR / self-checkout / Pay Now links — GAP

        ◦ Lets merchants collect ad-hoc payments outside a booking via QR, link, or self-checkout.
        ◦ Egebeya has no payment link, QR, or standalone checkout; money moves only inside a booking or subscription.
    • E-pm-08 Tips — GAP

        ◦ Lets clients add a gratuity at checkout or after a visit.
        ◦ Egebeya has zero tipping surface; the word appears nowhere in the client or the amount calculation.
    • E-pm-09 Gift cards (sell & redeem) — GAP

        ◦ Lets merchants sell stored-value gift cards and redeem them against future visits.
        ◦ Egebeya has promo codes but no gift-card table, no purchased value, no redemption ledger.
    • E-pm-11 Packages & service bundles — GAP

        ◦ Lets merchants sell prepaid bundles of visits or services at a discount.
        ◦ Egebeya has no packages table; multi-service selection is a single sale, not a bundle.
    • E-pm-12 BNPL (Klarna / Afterpay) — GAP
	Not in scope 
    • E-pm-15 Refunds & deposit refunds — GAP

        ◦ Lets merchants refund a sale or return a deposit through the platform.
        ◦ Egebeya has no refund API; cancel says “refund must be issued manually,” and the landing page promises automatic refunds.
    • E-pm-16 Void, raise, edit sale; receipts — PARTIAL

        ◦ Lets merchants void, raise, or edit a sale and reprint receipts for audit.
        ◦ Egebeya has invoices for platform subscription charges; consumer booking receipts are tickets, not a sale ledger.
    • E-pm-17 Taxes, service charges, surcharges — GAP

        ◦ Adds tax, service charge, or surcharge lines to the charged amount.
        ◦ Egebeya’s charged amount is price minus discounts, floored at zero; no additive tax or service-charge line exists.
    • E-pm-18 Manual/oﬄine payment types — GAP

        ◦ Lets merchants record cash or off-platform payments so revenue is not invisible.
        ◦ Egebeya’s payments table anticipates oﬄine methods, but every payment row is created by Chapa flows.
    • E-pm-19 Merchant credit (Fresha Capital) — GAP

        ◦ Offers merchant loans or capital advances repaid through platform flows.
        ◦ Egebeya has no merchant credit product; the micro-loan play is explicitly deferred pending data and licensing.

NOT IN SCOPE OF EGEEBYA
    • E-pm-20 Pay runs (merchant staff) — GAP

        ◦ Lets merchants run payroll, wages, and commissions inside the booking system.
        ◦ Egebeya has no wage, commission, or payroll model; staff rows carry no compensation fields.



consumer-account

    • E-ca-01 Client account & marketplace profile — PARTIAL

        ◦ Gives consumers an account to manage bookings, profile, and wallet.
        ◦ Egebeya has phone-keyed identity and a consumer JWT; no wallet, no bookings list on the account page, no profile editor.
    • E-ca-02 Notification & marketing preferences — PARTIAL

        ◦ Lets consumers control which marketing messages they receive and withdraw consent.
        ◦ Egebeya captures consent in three places but only the merchant CRM can toggle it; no consumer-facing preference centre.



client-management

    • E-cm-01 Client profiles & history — PARTIAL

        ◦ Gives merchants a full client record: history, notes, preferences, forms, files, wallet, chat.
        ◦ Egebeya’s profile is derived from transactions only; notes, preferences, forms, files, and chat are absent.
    • E-cm-02 Allergy & patch-test records — GAP

        ◦ Stores allergy and patch-test data so merchants can treat safely and document it.
        ◦ Egebeya has no clinical field on appointments or customer_stats.
    • E-cm-03 Custom intake & consultation forms — GAP

        ◦ Lets merchants define custom intake forms and consultation questionnaires.
        ◦ Egebeya’s booking capture is a fixed zod schema: name, phone, optional email.
    • E-cm-04 Tags & segments — PARTIAL

        ◦ Lets merchants tag clients and build custom segments for targeting.
        ◦ Egebeya computes health tags and inactive_days only; no free-form tags, no custom segments.
    • E-cm-05 Client list import/export/merge/delete — PARTIAL

        ◦ Lets merchants import a client list, export it, merge duplicates, and delete records.
        ◦ Egebeya has programmatic CSV export with no UI; import, merge, and per-client delete are absent.
    • E-cm-06 Files on client profiles — GAP

        ◦ Lets merchants attach files (photos, consent forms) to a client record.
        ◦ Egebeya’s media library is tenant-scoped; nothing can be attached to a customer.
    • E-cm-07 Block clients from booking — GAP

        ◦ Lets merchants permanently refuse a client’s future bookings.
        ◦ Egebeya’s block vector runs the other way: consumers can hide a merchant, but merchants cannot block a client.



merchant-scheduling

    • E-ms-01 Smart calendar — PARTIAL

        ◦ Gives merchants a visual calendar grid with color coding, drag, and display settings.
        ◦ Egebeya’s merchant day view is a filtered list plus a queue card stack; no calendar grid, no drag, no color coding.
    • E-ms-02 Shift scheduling / rosters — GAP

        ◦ Lets merchants publish shift rosters and give staff a schedule surface.
        ◦ Egebeya has per-weekday availability windows the owner edits; nothing is published to staff, and staff have no roster view.
    • E-ms-03 Blocked time & breaks — PARTIAL

        ◦ Lets merchants block ad-hoc time, breaks, and closures so they are never bookable.
        ◦ Egebeya enforces closures at read time, but no endpoint or UI can create one; the closure table is write-orphaned.
    • E-ms-04 Time-off types — GAP

        ◦ Lets merchants record absence with types (sick, holiday) and request/approval flows.
        ◦ Egebeya has no time-off table, no absence record, no request or approval.

    • E-ms-05 Processing & finishing times / extra time — GAP

        ◦ Adds buffer time and per-appointment extra time so the calendar reflects real chair time.
        ◦ Egebeya has one duration per service, a fixed 30-minute grid, and no buffers or extra-time fields.



multi-location

    • E-ml-01 Multiple business locations — GAP

        ◦ Lets one merchant operate multiple locations under one account.
        ◦ Egebeya is one tenant = one location; tenants.slug is unique, and no location/branch entity exists.
    • E-ml-02 Independent merchants / workspace — GAP

        ◦ Lets independent merchants (e.g. chair renters) operate inside one workspace with attributed sales.
        ◦ Egebeya staff are logins scoped to one tenant; they are not separable merchants with attributed sales.
    • E-ml-03 Cross-location continuity / operator visibility — GAP

        ◦ Gives operators a cross-location view of clients, staff, and channels.
        ◦ Egebeya’s platform-wide read surface is the superadmin console for Egebeya itself, not for operators of many shops.

trust-safety

    • E-ts-02 Report / reply to reviews — GAP

        ◦ Lets merchants and consumers report, reply to, and moderate reviews.
        ◦ Egebeya has no reviews table; there is nothing to report or reply to.

    • E-ts-03 No-show protection as a policy engine — PARTIAL

        ◦ Protects the calendar from no-shows through fees, deposits, or prepay requirements.
        ◦ Egebeya has the behavioural half (no-show counter, health tag, per-phone forced prepay); monetary fee capture is prohibited by design.



marketing-growth

    • E-mg-01 Blast campaigns (email & text) — PARTIAL

        ◦ Lets merchants send bulk email or SMS campaigns with a builder, scheduling, and performance view.
        ◦ Egebeya has one-shot SMS blast with a “Reply STOP” suffix and a Pro gate; no email campaigns, builder, scheduling, or performance view.
    • E-mg-02 Deals & promotions — PARTIAL

        ◦ Lets merchants create flash sales, last-minute deals, and track deal performance.
        ◦ Egebeya has promo codes and quiet-hours discounts; no flash-sale engine, no deal performance view.
    • E-mg-05 Review engine (collect/reply/report) — GAP

        ◦ Automatically prompts reviews after visits and gives merchants a reply/moderation surface.
        ◦ Egebeya has no review entity, no post-visit review invite, no reply surface, no Google sync.
    • E-mg-06 Referral program — PARTIAL

        ◦ Lets clients refer friends and rewards both parties.
        ◦ Egebeya has supply-side agent attribution; no client-to-client referral loop or referrer reward.
    • E-mg-07 Marketplace visibility boosting — GAP
        ◦ Lets merchants improve their ranking in the marketplace through profile quality or paid boost.
        ◦ Egebeya orders the directory alphabetically by tenant name; no ranking levers, no boost product.



automation-notifications

    • E-an-01 Appointment reminder — PARTIAL

        ◦ Sends a reminder before an appointment to reduce no-shows.
        ◦ Egebeya fires at a hardcoded cannot set lead time.
to
window; merchant
    • E-an-03 Rescheduled / cancelled notices — GAP

        ◦ Notifies the customer and owner when an appointment is rescheduled or cancelled.
        ◦ Egebeya has the transitions but no dedicated reschedule or cancel message template dispatched to the consumer.
    • E-an-04 Did-not-show / thank-you / tip / waitlist / slot-available messages — GAP
        ◦ Closes the loop after a no-show, a visit, a tip, a waitlist join, or a slot opening.
        ◦ Egebeya has no template, trigger, or channel decision for any of these lifecycle messages.
    • E-an-06 Birthday / welcome / milestone / reward-loyal messages — GAP

        ◦ Sends birthday greetings, welcome offers, milestone congratulations, and loyalty rewards.
        ◦ Egebeya has no birth date captured, no welcome template, no milestone trigger, no reward-loyal message.



analytics-reporting

    • E-ar-01 Reporting & analytics (merchant) — PARTIAL

        ◦ Gives merchants 7-day revenue, bookings, top services, and repeat-customer counts.
        ◦ Egebeya’s endpoint computes all of it, but the dashboard fetches it and never renders it.
    • E-ar-02 Automation performance — GAP

        ◦ Shows which automations, campaigns, and messages drive bookings and revenue.
        ◦ Egebeya has platform-wide channel success rates only; no per-message or per-campaign attribution.
    • E-ar-04 Client-source attribution & ads conversion tracking — GAP

        ◦ Tells merchants which channel (Telegram, directory, Instagram, ads) brought each booking.
        ◦ Egebeya has tenant-level acquired_via_code only; no booking-level source field, no GA/Meta Pixel/Google Ads tags.



team-permissions

    • E-tp-01 Team member profiles — PARTIAL

        ◦ Lets merchants showcase staff profiles with bio, image, and specialties.
        ◦ Egebeya staff carry name/title/bio/imagePath, but the UI edits only name and title; bio and image have no picker.
    • E-tp-02 Custom permission roles — GAP

        ◦ Lets merchants define per-member permission matrices beyond fixed roles.
        ◦ Egebeya has three fixed roles (owner/staff/admin) with server-side checks; no per-member permission matrix.
    • E-tp-03 Timesheets & clock in/out — GAP

        ◦ Lets staff clock in and out, and merchants track actual hours.
        ◦ Egebeya has planned availability only; no timesheet entity, no clock-in/out.

    • E-tp-04 Wages, commissions & per-member pricing — GAP

        ◦ Lets merchants set wages, commissions, and per-member service pricing.
        ◦ Egebeya has no compensation fields on staff and no per-member pricing; price and duration live on the service only.
    • E-tp-05 Login permissions & member lifecycle — PARTIAL

        ◦ Lets merchants invite, archive, suspend, and off-board staff with history intact.
        ◦ Egebeya has invite and delete; no archive-with-history, no suspend, no login-only restriction.



content-site

    • E-cs-05 Custom domain — PARTIAL

        ◦ Lets merchants connect a custom domain to their Fresha-powered website.
        ◦ Egebeya supports connect-a-domain (Pro) with format checks; no DNS-ownership verification and no domain purchase.
    • E-cs-06 Book button / embed / share link — PARTIAL

        ◦ Gives merchants a booking link, embeddable button, QR code, and one-link-for-everything.
        ◦ Egebeya has an iframe embed and share links; no QR codes, no WordPress path, no one-link-for-everything.



api-integrations

    • E-ai-04 Social-surface booking (Google Reserve / Meta) — GAP
        ◦ Lets consumers book directly from Google, Facebook, or Instagram.
        ◦ Egebeya has profile links only; no Google Reserve, no Facebook/Instagram booking integration.



localization

    • E-l10n-01 Bilingual UI (Amharic-first) — PARTIAL
        ◦ Provides the product UI in Amharic and English with parity enforced.
        ◦ Egebeya has en + am resources and a language toggle, but default resolves to English unless the browser signals “am,” and several surfaces are English-only.



INFRA-BLOCKED

    • E-ai-03 Calendar sync with external calendars — INFRA-BLOCKED
        ◦ Two-way sync between Egebeya and Google/Apple/ICS calendars so external bookings don’t double-book the chair.
        ◦ Egebeya publishes a one-way feed only; two-way sync needs a durable subscription and retry loop the single-process stack cannot carry.

CORRECTED TO A SHARED CALENDER FOR THE BUSINESS WHERE STUFF CAN SEE THEIR SCEDULE AND THE TENANT(OWNER) HAS ALL THIS STUFF SCEDULE THE UI WILL BE A CALENDER 
    • E-ai-05 Data export / BI connector — INFRA-BLOCKED

        ◦ Continuous export of bookings, clients, and payments to an external BI or spreadsheet system.
        ◦ Egebeya has one-shot CSV export with no UI; continuous ETL needs a worker and queue, not a request handler.
If you’re refactoring Egebeya with infrastructure as the first consideration, the single most important thing to switch is the execution model itself — from “everything runs in one web process” to a web process + message queue + worker pool. Everything else (database, event patterns, sync architecture) follows from that.
Here’s the target architecture, component by component.



The core problem you’re solving

Right now Egebeya is a single Node.js process. Every cron, every background job, every API request, every notification dispatch, every export — all share one event loop and one database connection.
That shape cannot carry two-way calendar sync, continuous BI export, or bulk campaign sends at scale, because those are exactly the workloads that need durable retries, independent scaling, and crash isolation — none of which a single process provides. If two instances ever run simultaneously (e.g. during a rolling deploy), all 7 crons double-run, because there is no distributed lock. This is the root constraint.



The target: web + queue + workers



Web process handles only HTTP request/response. It enqueues jobs and returns. It never runs a cron, never sends a message, never exports a CSV. Target response time: under 500 ms. Requests that take 1–2+ seconds are the signal that the work belongs in a worker.
Message queue is the durable buffer. It survives process restarts, provides at-least-once delivery, retries with exponential backoff, and a dead-letter queue for poison messages. The queue is what lets you scale producers and consumers independently.
Worker pool consumes jobs. You run N workers, each with a concurrency cap. They can be scaled based on queue length. A worker crash loses one job, not the whole system.
Workers own:

    • All 7 existing crons (now scheduled as recurring jobs in the queue, with a distributed lock)
    • Notification dispatch (email, SMS, Telegram)
    • Calendar sync (inbound webhooks + outbound writes)
    • CSV/BI export generation
    • Bulk campaign sends (no longer “50 at 1/sec inside the web process”)
    • Loyalty ledger writes, settlement reconciliation, dunning



What to switch, specifically
    1. Execution model	Queue-backed workers

Switch to: A queue library with durable storage. For Node.js, the pragmatic choices are BullMQ (Redis-backed, mature, type-safe, supports retries, DLQ, stalled-job detection, and per-queue concurrency) or Bull (lighter, also Redis). If you want managed infrastructure, AWS SQS with a Node.js consumer is another option.
What this unlocks immediately:

        ◦ Two-way calendar sync (E-ai-03) becomes possible: inbound webhooks enqueue calendar.event.created / updated / deleted jobs; a worker consumes them with durable retry. Without a queue, there is no durable retry loop and the sync cannot be built safely.
        ◦ Continuous BI export (E-ai-05) becomes a scheduled job that writes objects to storage, not a request handler that streams CSV inside API latency.
        ◦ Bulk campaign sends (E-mg-01) move out of the web process entirely.
        ◦ All crons become idempotent, distributed-lock-protected jobs. No more double-run during deploys.
Why not in-memory queues (p-queue, fastq): They work for rate-limiting a third-party API client within one process, but they lose all jobs on crash. You need persistence, retries, and DLQ — that’s distributed queue territory.

    2. Database	Postgres (or Turso embedded replicas, depending on your ceiling)
The Turso/libSQL constraint: Turso is SQLite-compatible with built-in replication, and embedded replicas give you sub-ms local reads with writes going to the primary. The migration path from SQLite is low-effort: same Drizzle dialect, just swap the driver and DATABASE_URL . But embedded replicas introduce eventual consistency — a replica may briefly serve stale data after a write. For a booking platform, that’s a problem: a consumer on one node might not see a slot that was just booked on another node until the replica syncs.
Recommendation: If you plan to stay on a single primary with read replicas, Postgres is the safer target. It gives you:
        ◦ Native EXCLUDE USING gist constraints for date-range double-booking prevention at the database level (structurally impossible, not application-enforced)
        ◦ Full MVCC with strong consistency on writes
        ◦ Read replicas for reporting without impacting transactional load
        ◦ Mature connection pooling (PgBouncer) for the worker pool
The cost is a breaking dialect switch (different column types, different migration files).
The benefit is that your booking correctness no longer depends on application-level serialization inside a single writer.
If you stay on Turso: Then you must not run multiple writer nodes. You can have one primary writer and N read-replica nodes, and all writes route to the primary. That is compatible with a web+worker split (web nodes read from replicas, workers write to primary), but it caps your write throughput at one primary and introduces replica lag into the read path. Acceptable if your write volume stays low; not acceptable if booking throughput grows.

    3. Application structure	Modular monolith

Do not go microservices yet. For a team of your size and a booking platform of your maturity, microservices add network calls, service discovery, distributed tracing, and deployment overhead before you have the operational muscle to justify it. A modular monolith — clear domain boundaries inside one deployable, with a message queue between modules — gives you the decoupling benefits without the distributed-systems tax.
Boundaries that map to your missing features:

        ◦ Booking module (appointments, availability, scheduling, Ethiopian calendar logic)
        ◦ Money module (Chapa integration, prepay, refunds, taxes, oﬄine ledger)
        ◦ Messaging module (notifications, templates, consent, delivery log, market pulse)
        ◦ Clients module (profiles, notes, tags, segments, consent)
        ◦ Site module (block document, builder, publish pipeline, domains)
        ◦ Trust module (reports, blocks, PDPL deletion)
        ◦ Analytics module (funnel, north-star, exports, attribution)

Modules communicate through the queue (events) and through a small set of internal APIs. This lets you later extract a module into its own process if it needs independent scaling — e.g. the messaging module becomes its own worker pool, the site module becomes its own render service. But you don’t pay that cost until you need it.

    4. Calendar sync	Provider-abstracted sync service

Do not build Google/Outlook sync directly into the booking module. Two-way sync has a well-known failure mode: the echo loop. Your write triggers a webhook, the webhook looks like a new change, your handler writes it again, and the loop never ends.
The architecture that works:

    • A sync service (running as a worker) owns the mapping table: internal_record_id external_event_id	grant_id , plus a content hash and timestamp.
    • Outbound: when a booking is created/updated, enqueue calendar.push with the internal ID. The worker writes to the provider with the internal ID stamped in metadata, saves the mapping row before making the API call, then makes the call. If the call fails, retry from a known row.
    • Inbound: provider webhooks enqueue calendar.pull with the external event ID. The worker looks up the mapping table. If a match exists, update the linked row instead of creating a second one. If no match exists, it’s a genuinely new external event — create a local booking.
    • Tag the origin of each change to break the echo loop. A change that originated in Egebeya carries origin: egebeya ; a change that originated in Google carries
. The worker never re-pushes a change it just pulled.

This is a worker-shaped problem. Without a queue, you cannot build it safely. With a queue, it’s a mapping table and two job types.

    5. Observability	Structured logs + queue depth + delivery ledger

Your current delivery log (	with  sent|failed|unlinked|disabled ) is the
right idea. Extend it into a general job ledger: every queued job gets a row with
queued_at , started_at , This gives you:
,
,
,
, and  tenant_id .
    • Queue depth per job type (the autoscaling signal)
    • Per-tenant delivery success rates (the SMS revive/kill decision you already make)
    • Dead-letter visibility (poison messages stop silently disappearing)
    • Audit trail for money-adjacent jobs (CAUTION flag in COMPARE-04)

Without this, a worker pool is a black box. With it, you can answer “which automations
are failing for which tenants” — which is exactly the gap.



Migration sequence
Automation performance

Do not refactor everything at once. The infrastructure change is the foundation; features land on top of it in dependency order.
Phase 0 — Queue + worker skeleton (1–2 weeks)

    • Add Redis (or SQS) and BullMQ.

    • Stand up a worker process with one job type: send-notification . Move all notification dispatch out of the web process and into the queue.
    • Move one cron (e.g. lock.
) into a recurring queue job with a distributed
    • Prove: two web instances + one worker, no double-sends, no double-cron-runs.

Phase 1 — Move the remaining crons (1–2 weeks)

    • All 7 crons become queue jobs.
    • Bulk campaign sends move to the queue.
    • Delivery ledger extends to job ledger.

Phase 2 — Database decision (2–4 weeks)

    • If staying on Turso: enforce single-writer, route all writes through the queue (web enqueues, workers write), accept replica lag on reads.
    • If moving to Postgres: dialect migration, exclusion constraints for booking overlap, read replicas for reporting.
Phase 3 — Calendar sync + BI export (2–4 weeks)

    • Build the sync service as a worker with the mapping table and echo-loop protection.
    • Build the export as a scheduled worker that writes to object storage.
    • Both are now cheap because the infrastructure exists.

Phase 4 — Feature backlog on top (ongoing)

    • T7.1–T7.4 (automation catalog) land on the messaging worker.
    • T7.5 (money ledger) lands on the money module.
    • T7.8 (render analytics) needs no infra change — it’s a UI fix.
    • T7.11 (authored client record) is schema + UI, no infra change.



What NOT to switch

    • Do not go microservices. You don’t have the operational maturity yet, and the booking domain is tightly coupled (availability	booking	payment	notification). A modular monolith with a queue gives you 80% of the decoupling at 20% of the cost.
    • Do not switch databases purely for “scale” if your write volume is low. Turso with a single writer and read replicas is fine until it isn’t. The trigger to move to Postgres is either (a) you need multi-writer, or (b) you need database-level
exclusion constraints for booking correctness, or © replica lag is causing user-visible bugs.
    • Do not build calendar sync before the queue. Without durable retry, the sync will silently drop events and you’ll spend months debugging phantom double-bookings.



The one-line answer

Switch the execution model, not the framework. Add a message queue and a worker pool. Keep the web process thin. Make every background operation a durable, retryable, observable job. Then calendar sync, BI export, bulk sends, and the entire automation catalog become ordinary features instead of infrastructure projects. The database decision (Turso vs Postgres) is downstream of that — and you can defer it until the queue is in place and you can measure whether replica lag or write throughput is actually your ceiling.
