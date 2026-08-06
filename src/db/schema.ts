import { sqliteTable, text, integer, real, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core';

export const tenants = sqliteTable('tenants', {
  id: text('id').primaryKey(), // uuid
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  domain: text('domain').unique(), // for custom domains
  category: text('category'), // salon, clinic, pharmacy, spa, other
  isListed: integer('is_listed', { mode: 'boolean' }).default(true),
  isSuspended: integer('is_suspended', { mode: 'boolean' }).default(false),
  settings: text('settings', { mode: 'json' }),
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
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const otpCodes = sqliteTable('otp_codes', {
  id: text('id').primaryKey(),
  phone: text('phone').notNull(),
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
