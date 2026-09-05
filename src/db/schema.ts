import { sqliteTable, text, integer, real, uniqueIndex, primaryKey, index } from 'drizzle-orm/sqlite-core';

export const tenants = sqliteTable('tenants', {
  id: text('id').primaryKey(), // uuid
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  domain: text('domain').unique(), // for custom domains
  category: text('category'), // salon, clinic, pharmacy, spa, other
  isListed: integer('is_listed', { mode: 'boolean' }).default(true),
  isSuspended: integer('is_suspended', { mode: 'boolean' }).default(false),
  // T4.5: structurally excluded from admin aggregates. Seeded fictional
  // tenants (seed.ts) + the demo slug tenant carry true so they never flatter
  // platform metrics; /discover listing behavior is unchanged.
  isDemo: integer('is_demo', { mode: 'boolean' }).default(false),
  settings: text('settings', { mode: 'json' }),
  // P1.1 founding-rate ladder: unexpired lock (UTC ms) = this tenant keeps
  // its locked price for 12 months regardless of plans-row edits.
  foundingRateLockedUntil: integer('founding_rate_locked_until'),
  // Attribution: street-agent / campaign code captured at register (?ref=).
  acquiredViaCode: text('acquired_via_code'),
  createdAt: integer('created_at').notNull(),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id), // null if platform admin, but usually populated
  name: text('name').notNull(),
  phone: text('phone').notNull().unique(), // primary identity
  email: text('email').notNull().unique(), // required for password reset links
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull(), // owner, staff, admin
  isSuperadmin: integer('is_superadmin', { mode: 'boolean' }).default(false),
  consentGivenAt: integer('consent_given_at'),
  tokenVersion: integer('token_version').default(0).notNull(),
  // Server-issued opaque jti included in every refresh-token JWT. Rotated on
  // every successful /auth/refresh so a stolen RT cannot be replayed once the
  // legitimate client has refreshed.
  refreshTokenId: text('refresh_token_id').notNull().default(''),
  createdAt: integer('created_at').notNull(),
});

export const passwordResets = sqliteTable('password_resets', {
  id: text('id').primaryKey(),
  token: text('token').notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  expiresAt: integer('expires_at').notNull(),
});

export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  price: integer('price').notNull(), // in cents ETB
  maxStaff: integer('max_staff').notNull(),
  customDomainAllowed: integer('custom_domain_allowed', { mode: 'boolean' }).default(false),
});

export const tenantSubscriptions = sqliteTable('tenant_subscriptions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull().unique(),
  planId: text('plan_id').references(() => plans.id),
  status: text('status').notNull(), // trial, active, expired
  trialEndsAt: integer('trial_ends_at'),
  startsAt: integer('starts_at'),
  endsAt: integer('ends_at'),
});

export const services = sqliteTable('services', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  name: text('name').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  price: integer('price').notNull(), // ETB cents
  imagePath: text('image_path'),
  active: integer('active', { mode: 'boolean' }).default(true),
});

export const staff = sqliteTable('staff', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  userId: text('user_id').references(() => users.id), // optional linked login
  name: text('name').notNull(),
  title: text('title'),
  bio: text('bio'),
  imagePath: text('image_path'),
  active: integer('active', { mode: 'boolean' }).default(true),
});

export const staffServices = sqliteTable('staff_services', {
  staffId: text('staff_id').references(() => staff.id).notNull(),
  serviceId: text('service_id').references(() => services.id).notNull(),
});

export const staffAvailability = sqliteTable('staff_availability', {
  id: text('id').primaryKey(),
  staffId: text('staff_id').references(() => staff.id).notNull(),
  dayOfWeek: integer('day_of_week').notNull(), // 0-6
  startTime: text('start_time').notNull(), // "HH:MM"
  endTime: text('end_time').notNull(), // "HH:MM"
});

export const tenantBusinessHours = sqliteTable('tenant_business_hours', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  dayOfWeek: integer('day_of_week').notNull(),
  openTime: text('open_time'),
  closeTime: text('close_time'),
  isClosed: integer('is_closed', { mode: 'boolean' }).default(false),
});

export const tenantClosures = sqliteTable('tenant_closures', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  reason: text('reason'),
});

export const appointments = sqliteTable('appointments', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  customerEmail: text('customer_email'),
  staffId: text('staff_id').references(() => staff.id).notNull(),
  serviceId: text('service_id').references(() => services.id).notNull(),
  startTime: integer('start_time').notNull(), // UTC timestamp ms
  endTime: integer('end_time').notNull(),
  status: text('status').notNull(), // pending, confirmed, cancelled, completed, no_show
  reminderSent: integer('reminder_sent', { mode: 'boolean' }).default(false),
  sentVia: text('sent_via'), // 'sms', 'email', 'both' — audit which channel a reminder went out on
  cancelsAt: integer('cancels_at'), // UTC epoch ms; set when payment pending so stale slots free up
  recurringSeriesId: text('recurring_series_id'), // FK to recurring_series.id, nullable
  opaqueId: text('opaque_id').notNull().unique(), // Public-facing ID for booking URLs (short, unguessable)
  // P3.4: consumer identity backfill. Nullable — walk-ins and pre-P3.4 rows
  // have no consumer profile; new bookings upsert consumers by phone.
  consumerId: text('consumer_id').references(() => consumers.id),
  // ── P4.1 Queue-Buster columns (audit P0.4 ruling: appointment columns,
  // not a new table — walk-ins already write plain 'confirmed' rows here,
  // so the queue derives from THIS table to avoid dual sources of truth).
  // 1..N among today's active entries; NULL = not queued (done/out-of-day).
  queuePosition: integer('queue_position'),
  // waiting | serving | done — the whole queue lifecycle.
  queueState: text('queue_state'),
  // UTC ms the entry entered the queue (first seen by the console).
  checkedInAt: integer('checked_in_at'),
  // online | walk_in — drives the Queue-Buster badge + booked-before-walk-in
  // float ordering. Defaults preserve legacy-row semantics ('online').
  bookingSource: text('booking_source').notNull().default('online'),
});

export const appointmentServices = sqliteTable('appointment_services', {
  appointmentId: text('appointment_id').references(() => appointments.id).notNull(),
  serviceId: text('service_id').references(() => services.id).notNull(),
  priceAtBooking: integer('price_at_booking').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.appointmentId, table.serviceId] }),
}));

export const recurringSeries = sqliteTable('recurring_series', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  staffId: text('staff_id').references(() => staff.id).notNull(),
  serviceId: text('service_id').references(() => services.id).notNull(),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  customerEmail: text('customer_email'),
  interval: text('interval').notNull(), // 'weekly', 'biweekly', 'monthly'
  startDate: text('start_date').notNull(), // Ethiopian date string
  endDate: text('end_date').notNull(), // Ethiopian date string
  timeslotMinutes: integer('timeslot_minutes').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
});

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  appointmentId: text('appointment_id').references(() => appointments.id),
  amount: integer('amount').notNull(),
  gateway: text('gateway'), // tellbirr, chapa
  method: text('method'), // telebirr, mpesa, ...
  gatewayReference: text('gateway_reference'), // for chapa, this is the tx_ref
  status: text('status').notNull(), // pending, success, failed, completed
  // P1.7 collected-vs-invoiced: Chapa settles T+2/T+3 AFTER the charge
  // succeeds. NULL = legacy row predating tracking; 'pending'|'settled'|'failed'.
  settledAt: integer('settled_at'),
  settlementStatus: text('settlement_status'),
  // UTC ms when the payment row was created. NULL on legacy rows.
  createdAt: integer('created_at'),
  // P1.2 (A): the moment THIS payment granted its Pro cycle. Set inside the
  // same transaction as activation. A redelivery (settlement webhook with a
  // different eventId) checks it BEFORE any activation so a partially-
  // succeeded original charge can't double-grant.
  subscriptionGrantedAt: integer('subscription_granted_at'),
  meta: text('meta', { mode: 'json' }), // raw chapa verify/charge payloads for support
});

export const pages = sqliteTable('pages', {
  tenantId: text('tenant_id').references(() => tenants.id).primaryKey(),
  content: text('content', { mode: 'json' }), // Puck document JSON
});

export const proSiteFiles = sqliteTable('pro_site_files', {
  id: text('id').primaryKey(), // uuid
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  // Path within the WebContainer project, e.g. "src/App.jsx" or "package.json".
  // Unique per tenant: a tenant only ever has one row per file path so PUTs
  // can upsert by (tenantId, file_path) without an id roundtrip.
  filePath: text('file_path').notNull(),
  content: text('content').notNull(), // raw file content (UTF-8)
  updatedAt: integer('updated_at').notNull(),
}, (table) => ([
  uniqueIndex('pro_site_files_tenant_path_unique')
    .on(table.tenantId, table.filePath),
]));

export const media = sqliteTable('media', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  path: text('path').notNull(), // public URL path e.g. /uploads/<tenantId>/<filename>
  originalName: text('original_name'),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const otpCodes = sqliteTable('otp_codes', {
  id: text('id').primaryKey(),
  phone: text('phone').notNull(),
  // SHA-256 hex of the 6-digit code (P0.5) — never the plaintext code.
  code: text('code').notNull(),
  expiresAt: integer('expires_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
  used: integer('used', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
});

// Website Builder state: builder mode ('puck' | 'code') + published Code-Mode
// HTML. Created by migrations.ts (CREATE TABLE IF NOT EXISTS) on boot.
export const siteConfig = sqliteTable('site_config', {
  tenantId: text('tenant_id').references(() => tenants.id).primaryKey(),
  builderMode: text('builder_mode').notNull().default('puck'),
  publishedCodeHtml: text('published_code_html'),
  // Pointer to the active publish build for Code Mode. Set by the publish
  // endpoint after writing files to storage/pro-builds/{tenantId}/{buildId}/.
  // Null when no build has been published yet. The value is a build UUID (the
  // directory name under storage/pro-builds/{tenantId}/).
  activeBuildId: text('active_build_id'),
  updatedAt: integer('updated_at').notNull(),
});

export const securityEvents = sqliteTable('security_events', {
  id: text('id').primaryKey(),
  eventType: text('event_type').notNull(),
  tenantId: text('tenant_id'),
  ip: text('ip'),
  result: text('result').notNull().default('failure'),
  details: text('details', { mode: 'json' }),
  createdAt: integer('created_at').notNull(),
});

// Matches the CREATE TABLE shipped in src/db/migrations.ts. The
// (provider, event_id) unique index makes duplicate webhook replays a
// race-free detection.
export const processedWebhookEvents = sqliteTable('processed_webhook_events', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  eventId: text('event_id').notNull(),
  txRef: text('tx_ref'),
  paymentId: text('payment_id'),
  action: text('action').notNull(),
  raw: text('raw'),
  receivedAt: integer('received_at').notNull(),
}, (table) => ([
  uniqueIndex('processed_webhook_events_provider_event_unique')
    .on(table.provider, table.eventId),
]));

export const customerStats = sqliteTable('customer_stats', {
  tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  customerPhone: text('customer_phone').notNull(),
  customerName: text('customer_name').notNull(),
  firstVisitAt: integer('first_visit_at'),
  lastVisitAt: integer('last_visit_at'),
  visitCount: integer('visit_count').notNull().default(0),
  totalSpendEtbCents: integer('total_spend_etb_cents').notNull().default(0),
  lastCancelledAt: integer('last_cancelled_at'),
  marketingOptIn: integer('marketing_opt_in', { mode: 'boolean' }).notNull().default(false),
  // P3.7 consent baseline: UTC ms timestamp captured when the customer
  // actively opted in (booking checkbox / CRM toggle). NULL = never opted in
  // (the flag alone may predate explicit-consent capture).
  marketingOptInGivenAt: integer('marketing_opt_in_given_at'),
  healthTag: text('health_tag').notNull().default('healthy'),
  noShowCount: integer('no_show_count').notNull().default(0),
  automationState: text('automation_state').notNull().default('active'),
  lastAutomationSentAt: integer('last_automation_sent_at'),
  createdAt: integer('created_at').notNull(),
}, (table) => ([
  primaryKey({ columns: [table.tenantId, table.customerPhone] }),
]));

export const promoCodes = sqliteTable('promo_codes', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  code: text('code').notNull(),
  discountType: text('discount_type').notNull(), // 'percent' or 'fixed_etb_cents'
  discountValue: integer('discount_value').notNull(),
  maxUses: integer('max_uses').notNull().default(1),
  usedCount: integer('used_count').notNull().default(0),
  validFrom: integer('valid_from'),
  validUntil: integer('valid_until'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
}, (table) => ([
  // A merchant can't define the same promo code twice — lookup is per-tenant.
  uniqueIndex('promo_codes_tenant_code_unique')
    .on(table.tenantId, table.code),
]));

// Subscription invoices/receipts (P1.2). Created by migrations.ts on boot.
// Money is ETB cents, matching payments.amount. `number` is the human-facing
// sequential-ish document number for PLC bookkeeping; `chapa_tx_ref` ties the
// invoice to the payments row that settled it (no duplicated money records).
export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  number: text('number').notNull().unique(),
  amount: integer('amount').notNull(), // ETB cents
  currency: text('currency').notNull().default('ETB'),
  periodStart: integer('period_start'),
  periodEnd: integer('period_end'),
  status: text('status').notNull(), // draft | paid | void
  chapaTxRef: text('chapa_tx_ref'),
  issuedAt: integer('issued_at').notNull(),
  paidAt: integer('paid_at'),
  // P1.7: settlement mirrors payments.settlement_status — invoiced ≠ collected
  // until Chapa settles (T+2/T+3). NULL = legacy row.
  settledAt: integer('settled_at'),
  settlementStatus: text('settlement_status'),
});

export const inventoryItems = sqliteTable('inventory_items', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  serviceId: text('service_id').references(() => services.id),
  name: text('name').notNull(),
  sku: text('sku'),
  quantityOnHand: integer('quantity_on_hand').notNull().default(0),
  reorderThreshold: integer('reorder_threshold').notNull().default(5),
  unit: text('unit').notNull().default('unit'),
  createdAt: integer('created_at').notNull(),
});

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  keyPrefix: text('key_prefix').notNull(),
  keyHash: text('key_hash').notNull(),
  scopes: text('scopes', { mode: 'json' }).notNull(),
  expiresAt: integer('expires_at'),
  lastUsedAt: integer('last_used_at'),
  createdAt: integer('created_at').notNull(),
});

// Local buying-intent signals from /discover. Each row is one anonymized
// action (a search/filter or a card click). Aggregated by the cron into
// per-(category, city) demand pulses. No customer PII.
export const searchIntent = sqliteTable('search_intent', {
  id: text('id').primaryKey(),
  category: text('category'),
  city: text('city'),
  action: text('action').notNull(), // 'view' | 'search'
  createdAt: integer('created_at').notNull(),
});

// Pro-merger demand alerts emitted by the aggregation cron. One row per
// (tenant, category, city, window) pulse so the dashboard can render a history.
export const proAlerts = sqliteTable('pro_alerts', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  category: text('category').notNull(),
  city: text('city').notNull(),
  actionCount: integer('action_count').notNull(),
  message: text('message').notNull(),
  createdAt: integer('created_at').notNull(),
});

// Refresh token families for multi-device session management.
// Each login creates a new family; the refresh token carries a child JTI.
// Rotation updates the family's current child JTI; reuse revokes the whole family.
export const refreshTokenFamilies = sqliteTable('refresh_token_families', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  parentJti: text('parent_jti').notNull(),
  childJti: text('child_jti').notNull(),
  createdAt: integer('created_at').notNull(),
  lastUsedAt: integer('last_used_at'),
  revokedAt: integer('revoked_at'),
});

// P1.4 dunning-lite idempotency markers. One row per (tenant, stage, cycle)
// proves a renewal/past-due notice went out — UNIQUE index makes concurrent
// cron runs race-free. cycle_start identifies which subscription cycle the
// notice belongs to (subscription.startsAt of that cycle).
export const billingReminderSends = sqliteTable('billing_reminder_sends', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  stage: text('stage').notNull(), // renewal_3d | renewal_due | past_due_2d | past_due_5d
  cycleStart: integer('cycle_start').notNull(),
  channel: text('channel'), // email | telegram (future)
  sentAt: integer('sent_at').notNull(),
}, (table) => ([
  uniqueIndex('billing_reminders_tenant_stage_cycle_unique')
    .on(table.tenantId, table.stage, table.cycleStart),
]));

// P3.2 — Telegram bot channel. One row per chat that completed the opt-in
// deep link ("ማስታወሻ በ Telegram"). The Bot API forbids bots from initiating
// contact, so every row here traces back to a user-initiated /start.
export const telegramLinks = sqliteTable('telegram_links', {
  chatId: text('chat_id').primaryKey(), // Telegram chat id (string — may exceed int32)
  // Canonical normalized phone (+2519xxxxxxxx) via src/lib/phone.ts.
  phone: text('phone').notNull(),
  // Tenant context captured from the booking reference at link time; nullable
  // because one chat may later link through another tenant's booking.
  tenantId: text('tenant_id'),
  // P3.7: messaging-consent timestamp — set at the moment the user taps
  // Start in the bot. No row is ever created without it.
  consentGivenAt: integer('consent_given_at').notNull(),
  linkedAt: integer('linked_at').notNull(),
}, (table) => ([
  index('telegram_links_phone_idx').on(table.phone),
]));

// P3.3 — delivery outcome ledger written by the NotificationAdapter on every
// dispatch attempt (P3.1 seam). Feeds GET /api/admin/notification-stats and
// the SMS revive/kill decision.
export const notificationLog = sqliteTable('notification_log', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id'),
  channel: text('channel').notNull(), // email | sms | telegram
  template: text('template').notNull(), // reminder | bookingCustomer | otp | ...
  refType: text('ref_type'), // appointment | subscription | consumer | ...
  refId: text('ref_id'),
  status: text('status').notNull(), // sent | failed | unlinked | disabled
  error: text('error'),
  createdAt: integer('created_at').notNull(),
}, (table) => ([
  index('notification_log_channel_created_idx').on(table.channel, table.createdAt),
]));

// P3.4 — consumer identity-lite. Phone-keyed login for end customers
// (distinct from merchant `users`). P3.7 gate: consent_given_at is NOT NULL —
// no consumer row is created without a recorded consent timestamp.
export const consumers = sqliteTable('consumers', {
  id: text('id').primaryKey(),
  phone: text('phone').notNull().unique(), // canonical +2519xxxxxxxx
  name: text('name'),
  consentGivenAt: integer('consent_given_at').notNull(),
  createdAt: integer('created_at').notNull(),
});

// P3.7 — GDPR/PDPL-style deletion requests. v1 fulfillment is manual (SOP in
// the route comment); the request itself is logged + acked immediately.
export const dataDeletionRequests = sqliteTable('data_deletion_requests', {
  id: text('id').primaryKey(),
  phone: text('phone').notNull(), // canonical +2519xxxxxxxx
  status: text('status').notNull().default('requested'), // requested | fulfilled
  requestedAt: integer('requested_at').notNull(),
  fulfilledAt: integer('fulfilled_at'),
  note: text('note'),
}, (table) => ([
  index('data_deletion_requests_phone_idx').on(table.phone),
]));


// P5.1 — Loyalty-lite ledger. APPEND-ONLY is enforced at the storage layer
// by triggers (see migrations): rows may be inserted, never edited or
// erased. Phone-keyed, merchant-scoped; punches accrue from completed
// visits without any merchant action.
export const loyaltyLedger = sqliteTable('loyalty_ledger', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  // Canonical normalized phone (+2519xxxxxxxx) — the consumer identity key.
  consumerPhone: text('consumer_phone').notNull(),
  pointsDelta: integer('points_delta').notNull(),
  reason: text('reason').notNull(), // visit | bonus | manual | redemption
  refType: text('ref_type'),
  refId: text('ref_id'),
  createdAt: integer('created_at').notNull(),
}, (table) => ([
  uniqueIndex('loyalty_ledger_tenant_phone_ref_unique')
    .on(table.tenantId, table.consumerPhone, table.reason, table.refId),
]));

// One live punch card per (tenant, consumer). Reward redemption lowers the
// next Chapa charge (merchant-funded discount) — never money movement.
export const punchCards = sqliteTable('punch_cards', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  consumerPhone: text('consumer_phone').notNull(),
  punches: integer('punches').notNull().default(0),
  target: integer('target').notNull().default(5),
  // { type: 'percent' | 'fixed_etb_cents', value: number }
  rewardConfig: text('reward_config', { mode: 'json' }),
  createdAt: integer('created_at').notNull(),
}, (table) => ([
  uniqueIndex('punch_cards_tenant_phone_unique')
    .on(table.tenantId, table.consumerPhone),
]));

// P3.5 — server-side activation funnel events. Append-only; aggregated by
// GET /api/admin/funnel into weekly conversion + the north-star metric.
export const activationEvents = sqliteTable('activation_events', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id'),
  event: text('event').notNull(), // site_generated | hours_confirmed | ... (canonical set in server/lib/analytics.ts)
  meta: text('meta', { mode: 'json' }),
  createdAt: integer('created_at').notNull(),
}, (table) => ([
  index('activation_events_tenant_event_idx').on(table.tenantId, table.event),
  index('activation_events_created_idx').on(table.createdAt),
]));

// Wayfinder #14/#19 — UGC notice-and-action (Apple 1.2, DSA Art 16).
// Reports are filed by consumers about a merchant (optionally anonymous) and
// reviewed platform-direct. Deliberately NOT stored on the tenant settings
// JSON: that blob is owner-writable, and the reported party must never hold
// the evidence against them (decision #14 Q4).
export const contentReports = sqliteTable('content_reports', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  reporterPhone: text('reporter_phone'), // null = anonymous report
  reason: text('reason').notNull(), // spam | fraud_or_scam | inappropriate_content | impersonation | other
  details: text('details'),
  status: text('status').notNull().default('open'), // open | actioned | dismissed
  resolutionNote: text('resolution_note'),
  createdAt: integer('created_at').notNull(),
  resolvedAt: integer('resolved_at'),
}, (table) => ([
  index('content_reports_status_created_idx').on(table.status, table.createdAt),
]));

// Personal consumer→merchant filter (decision #14 Q3a): hides the merchant
// from that consumer's /discover results only — no effect on other consumers,
// no takedown (takedown is what the report SLA does). Many-to-many edge that
// no single tenant's settings JSON can hold.
export const consumerBlocks = sqliteTable('consumer_blocks', {
  id: text('id').primaryKey(),
  consumerId: text('consumer_id').references(() => consumers.id).notNull(),
  tenantId: text('tenant_id').references(() => tenants.id).notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => ([
  uniqueIndex('consumer_blocks_pair_unique').on(table.consumerId, table.tenantId),
]));
