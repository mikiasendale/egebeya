import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';

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

// Website Builder state: builder mode ('puck' | 'code') + published Code-Mode
// HTML. Created by migrations.ts (CREATE TABLE IF NOT EXISTS) on boot.
export const siteConfig = sqliteTable('site_config', {
  tenantId: text('tenant_id').references(() => tenants.id).primaryKey(),
  builderMode: text('builder_mode').notNull().default('puck'),
  publishedCodeHtml: text('published_code_html'),
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
