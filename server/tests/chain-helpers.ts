/**
 * Shared helpers for the chain-*.test.ts cross-API integration suite.
 *
 * Each chain test mounts the real Express app (handler → service → DB,
 * no intermediate mocks) and drives it through Supertest. Only EXTERNAL
 * providers (Chapa SDK, Telegram HTTP API) are stubbed — via vi.mock at the
 * file level or the lib's official __setTelegramFetch seam — because the
 * sandbox has no network.
 */
import express from 'express';
import request from 'supertest';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq, and, inArray } from 'drizzle-orm';

import { db } from '../../src/db';
import {
  tenants, users, plans, tenantSubscriptions, services, staff,
  staffAvailability, tenantBusinessHours, appointments, appointmentServices,
  payments, invoices, pages, customerStats, punchCards, notificationLog,
  activationEvents, securityEvents, processedWebhookEvents, otpCodes,
  telegramLinks, tenantBusinessHours as hoursTable,
} from '../../src/db/schema';
import { getWebhookSecret } from '../../server/lib/chapa';

export type App = ReturnType<typeof express>;

/** Mount the production API exactly like server.ts (raw body for HMAC). */
export async function mountApp(): Promise<App> {
  const app = express();
  app.use(express.json({
    verify: (req, _res, buf) => { (req as any).rawBody = buf; },
  }));
  const { default: apiRoutes } = await import('../../src/api');
  app.use('/api', apiRoutes);
  return app;
}

export function tokenFor(userId: string, tenantId: string | null, role = 'owner'): string {
  return jwt.sign(
    { userId, tenantId, role, tokenVersion: 0 },
    process.env.JWT_SECRET as string,
    { expiresIn: '15m' },
  );
}

export function consumerTokenFor(consumerId: string, phone: string): string {
  return jwt.sign(
    { consumerId, phone },
    process.env.JWT_SECRET as string,
    { audience: 'consumer', subject: consumerId, expiresIn: '24h' },
  );
}

export interface OwnerContext {
  tenantId: string;
  userId: string;
  token: string;
  slug: string;
}

/**
 * Seed a tenant + owner user. `subscription` optionally creates a
 * tenant_subscriptions row (status/trial/active with plan).
 */
export async function makeOwner(opts: {
  name?: string;
  category?: string | null;
  isListed?: boolean;
  settings?: Record<string, unknown>;
  subscription?: { planName: 'free' | 'pro'; status: string; endsAt?: number | null; startsAt?: number | null };
} = {}): Promise<OwnerContext> {
  const tenantId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const slug = `chain-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  await db.insert(tenants).values({
    id: tenantId,
    name: opts.name ?? 'Chain Salon',
    slug,
    category: opts.category ?? 'Salon',
    isListed: opts.isListed ?? true,
    settings: opts.settings ?? {},
    createdAt: Date.now(),
  });

  const token = tokenFor(userId, tenantId);
  await db.insert(users).values({
    id: userId,
    tenantId,
    name: 'Chain Owner',
    phone: `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
    email: `${slug}@egebeya.test`,
    passwordHash: await bcrypt.hash('Xk9#mQv2$Lp8@Wz3', 10),
    role: 'owner',
    createdAt: Date.now(),
  });

  if (opts.subscription) {
    const plan = await db.select().from(plans).where(eq(plans.name, opts.subscription.planName)).get();
    await db.insert(tenantSubscriptions).values({
      id: crypto.randomUUID(),
      tenantId,
      planId: plan!.id,
      status: opts.subscription.status,
      startsAt: opts.subscription.startsAt ?? Date.now(),
      endsAt: opts.subscription.endsAt ?? null,
    });
  }

  return { tenantId, userId, token, slug };
}

/** Seed service + staff + all-7-days-open business hours (00:00–23:59 Addis). */
export async function seedBusiness(tenantId: string, opts: {
  serviceName?: string;
  durationMinutes?: number;
  priceCents?: number;
  staffName?: string;
} = {}): Promise<{ serviceId: string; staffId: string }> {
  const serviceId = crypto.randomUUID();
  const staffId = crypto.randomUUID();

  await db.insert(services).values({
    id: serviceId,
    tenantId,
    name: opts.serviceName ?? 'Chain Service',
    durationMinutes: opts.durationMinutes ?? 30,
    price: opts.priceCents ?? 30000,
    active: true,
  });
  await db.insert(staff).values({
    id: staffId,
    tenantId,
    name: opts.staffName ?? 'Chain Staff',
    active: true,
  });
  await db.insert(hoursTable).values(
    [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      id: crypto.randomUUID(),
      tenantId,
      dayOfWeek,
      openTime: '00:00',
      closeTime: '23:59',
      isClosed: false,
    })),
  );
  return { serviceId, staffId };
}

const ADDIS_OFFSET_MS = 3 * 60 * 60 * 1000;
const SLOT_MS = 30 * 60 * 1000;

/** Addis-day [start, end) in UTC ms. */
export function addisDayBounds(now = Date.now()): { start: number; end: number } {
  const addis = new Date(now + ADDIS_OFFSET_MS);
  const midnightUtc = Date.UTC(addis.getUTCFullYear(), addis.getUTCMonth(), addis.getUTCDate());
  const start = midnightUtc - ADDIS_OFFSET_MS;
  return { start, end: start + 24 * 60 * 60 * 1000 };
}

/**
 * Next 30-min-aligned slot that is BOTH in the future and inside today's
 * Addis day (the queue scopes entries to the Addis day). Null when the
 * remaining Addis-day window is under one slot — callers fall back to
 * direct DB inserts (documented in each test).
 */
export function nextSlotInAddisToday(now = Date.now()): number | null {
  const { end } = addisDayBounds(now);
  const slot = Math.ceil((now + 5 * 60 * 1000) / SLOT_MS) * SLOT_MS;
  return slot + SLOT_MS <= end ? slot : null;
}

/**
 * A future 30-min-aligned UTC slot at a fixed Addis wall-clock time
 * (e.g. 10:30 Addis two days from now) — independent of the Addis-day
 * boundary, so it never falls out of a day-scoped window.
 */
export function futureSlotAtAddisHour(daysAhead = 2, hour = 10, minute = 0): number {
  const addis = new Date(Date.now() + ADDIS_OFFSET_MS + daysAhead * 24 * 60 * 60 * 1000);
  const utcMs = Date.UTC(
    addis.getUTCFullYear(), addis.getUTCMonth(), addis.getUTCDate(),
    hour - 3, minute, 0, 0,
  );
  return utcMs;
}

export function makeSuperadmin(): Promise<{ userId: string; token: string }> {
  return (async () => {
    const userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      tenantId: null,
      name: 'Chain Ops',
      phone: `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
      email: `chain-ops-${crypto.randomUUID().slice(0, 8)}@egebeya.test`,
      passwordHash: await bcrypt.hash('Xk9#mQv2$Lp8@Wz3', 10),
      role: 'owner',
      isSuperadmin: true,
      tokenVersion: 0,
      createdAt: Date.now(),
    });
    return { userId, token: tokenFor(userId, null) };
  })();
}

// ── Chapa webhook helpers ────────────────────────────────────────────────

export function signWebhook(rawBody: string): string {
  return crypto.createHmac('sha256', getWebhookSecret()).update(rawBody, 'utf8').digest('hex');
}

/** Deliver a correctly-signed Chapa webhook over real HTTP. */
export function deliverWebhook(app: App, payload: Record<string, unknown>) {
  const bodyStr = JSON.stringify(payload);
  return request(app)
    .post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('x-chapa-signature', signWebhook(bodyStr))
    .send(bodyStr);
}

export function seedProPayment(tenantId: string, opts: {
  cycleDays?: number;
  amountCents?: number;
} = {}) {
  const txRef = `TX-chain-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const paymentId = crypto.randomUUID();
  return {
    txRef,
    paymentId,
    row: {
      id: paymentId,
      tenantId,
      amount: opts.amountCents ?? 100000,
      gateway: 'chapa',
      method: 'checkout',
      gatewayReference: txRef,
      status: 'pending',
      createdAt: Date.now(),
      meta: {
        purpose: 'pro_subscription',
        product: `pro-${opts.cycleDays ?? 30}d`,
        cycleDays: opts.cycleDays ?? 30,
      },
    },
  };
}

// ── Loyalty gate opening (real rows, loyalty-redemption pattern) ─────────

export interface GateFixture {
  /** DB cleanup is handled by deleteTenantCascade(tenantId). */
  tenantId: string;
  staffId: string;
  serviceId: string;
  fillerAppointmentIds: string[];
  optedStatPhones: string[];
}

/**
 * Open the council loyalty gate with REAL rows scoped to one fixture tenant:
 *   - opt-in rate ≥ 50%: enough opted-in customer_stats rows to dominate
 *     whatever the shared DB already holds;
 *   - north-star ≥ 0.7: enough confirmed bookings this week for an active
 *     Pro subscription owned by this tenant.
 */
export async function openLoyaltyGate(fixture: {
  tenantId: string;
  staffId: string;
  serviceId: string;
}): Promise<GateFixture> {
  process.env.LOYALTY_ENABLED = 'true';

  const proPlan = await db.select().from(plans).where(eq(plans.name, 'pro')).get();
  await db.insert(tenantSubscriptions).values({
    id: crypto.randomUUID(),
    tenantId: fixture.tenantId,
    planId: proPlan!.id,
    status: 'active',
    startsAt: Date.now() - 24 * 60 * 60 * 1000,
  }).onConflictDoNothing();

  // (1) Opt-in dominance: count the shared table, add enough opted rows.
  const statRows = await db.select({ opted: customerStats.marketingOptIn }).from(customerStats).all();
  const total = statRows.length;
  const opted = statRows.filter((r) => r.opted).length;
  const needForOptIn = Math.max(0, total - 2 * opted + 10);
  const optedStatPhones: string[] = [];
  for (let i = 0; i < needForOptIn; i++) {
    const phone = `+25186${String(i).padStart(8, '0')}`;
    optedStatPhones.push(phone);
    await db.insert(customerStats).values({
      tenantId: fixture.tenantId,
      customerPhone: phone,
      customerName: `Gate Seed ${i}`,
      marketingOptIn: true,
      visitCount: 1,
      createdAt: Date.now(),
    }).catch(() => {});
  }

  // (2) North-star dominance: confirmed bookings in the trailing week.
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const driver = (db as any).session?.client ?? (db as any).$client;
  const countRow = await driver.execute({
    sql: `SELECT
            (SELECT COUNT(*) FROM appointments WHERE status IN ('confirmed','completed') AND start_time >= ?) AS bookings,
            (SELECT COUNT(DISTINCT tenant_id) FROM tenant_subscriptions WHERE status IN ('active','trial')) AS active_tenants`,
    args: [weekAgo],
  });
  const row: any = countRow.rows?.[0] ?? {};
  const bookingsN = Number(row.bookings ?? 0);
  const tenantsN = Math.max(1, Number(row.active_tenants ?? 1));
  const need = Math.max(10, Math.ceil(0.7 * tenantsN) - bookingsN + 10);

  const fillerAppointmentIds: string[] = [];
  const base = Date.now() - 3 * 24 * 60 * 60 * 1000;
  for (let i = 0; i < need; i++) {
    const id = crypto.randomUUID();
    fillerAppointmentIds.push(id);
    await db.insert(appointments).values({
      id,
      tenantId: fixture.tenantId,
      customerName: `Filler ${i}`,
      customerPhone: '+251887000000',
      staffId: fixture.staffId,
      serviceId: fixture.serviceId,
      startTime: base + i * 60_000,
      endTime: base + i * 60_000 + 1800_000,
      status: 'confirmed',
      reminderSent: false,
      opaqueId: crypto.randomBytes(16).toString('hex'),
    }).catch(() => {});
  }

  return { ...fixture, fillerAppointmentIds, optedStatPhones };
}

/** Append one +1 visit punch past the gate (ledger is truth, card is cache). */
export async function appendVisitPunch(tenantId: string, phone: string, refId: string): Promise<void> {
  const driver = (db as any).session?.client ?? (db as any).$client;
  await driver.execute({
    sql: `INSERT OR IGNORE INTO loyalty_ledger
            (id, tenant_id, consumer_phone, points_delta, reason, ref_type, ref_id, created_at)
          VALUES (?, ?, ?, 1, 'visit', 'appointment', ?, ?)`,
    args: [crypto.randomUUID(), tenantId, phone, refId, Date.now()],
  });
}

// ── Cleanup ──────────────────────────────────────────────────────────────

/** FK-safe teardown of everything a chain test created for one tenant. */
export async function deleteTenantCascade(tenantId: string): Promise<void> {
  const apptIds = (await db.select({ id: appointments.id }).from(appointments)
    .where(eq(appointments.tenantId, tenantId)).all()).map((r) => r.id);

  if (apptIds.length > 0) {
    await db.delete(appointmentServices).where(inArray(appointmentServices.appointmentId, apptIds)).catch(() => {});
  }
  await db.delete(processedWebhookEvents).where(eq(processedWebhookEvents.paymentId, tenantId)).catch(() => {});
  // processedWebhookEvents keyed by txRef → payment rows of this tenant.
  const payIds = (await db.select({ id: payments.id }).from(payments)
    .where(eq(payments.tenantId, tenantId)).all()).map((r) => r.id);
  for (const pid of payIds) {
    await db.delete(processedWebhookEvents).where(eq(processedWebhookEvents.paymentId, pid)).catch(() => {});
  }
  await db.delete(invoices).where(eq(invoices.tenantId, tenantId)).catch(() => {});
  await db.delete(payments).where(eq(payments.tenantId, tenantId)).catch(() => {});
  await db.delete(appointments).where(eq(appointments.tenantId, tenantId)).catch(() => {});
  await db.delete(customerStats).where(eq(customerStats.tenantId, tenantId)).catch(() => {});
  await db.delete(punchCards).where(eq(punchCards.tenantId, tenantId)).catch(() => {});
  await db.delete(notificationLog).where(eq(notificationLog.tenantId, tenantId)).catch(() => {});
  await db.delete(activationEvents).where(eq(activationEvents.tenantId, tenantId)).catch(() => {});
  await db.delete(pages).where(eq(pages.tenantId, tenantId)).catch(() => {});
  await db.delete(staffAvailability).where(eq(staffAvailability.staffId, tenantId)).catch(() => {});
  await db.delete(tenantBusinessHours).where(eq(tenantBusinessHours.tenantId, tenantId)).catch(() => {});
  await db.delete(services).where(eq(services.tenantId, tenantId)).catch(() => {});
  await db.delete(staff).where(eq(staff.tenantId, tenantId)).catch(() => {});
  await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId)).catch(() => {});
  await db.delete(users).where(eq(users.tenantId, tenantId)).catch(() => {});
  await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => {});
  // loyalty_ledger rows are append-only (DB triggers block DELETE) — they
  // stay, keyed by the now-deleted tenant id, exactly like the existing
  // loyalty tests leave them.
}

export async function deleteSecurityEvents(tenantId: string | null): Promise<void> {
  if (tenantId) {
    await db.delete(securityEvents).where(eq(securityEvents.tenantId, tenantId)).catch(() => {});
  }
}

export async function deleteOtpAndLink(phone: string, chatId?: string): Promise<void> {
  await db.delete(otpCodes).where(eq(otpCodes.phone, phone)).catch(() => {});
  if (chatId) {
    await db.delete(telegramLinks).where(eq(telegramLinks.chatId, chatId)).catch(() => {});
  } else {
    await db.delete(telegramLinks).where(eq(telegramLinks.phone, phone)).catch(() => {});
  }
}

/** Poll until `predicate` sees a matching row (async fire-and-forget writes). */
export async function waitFor<T>(
  probe: () => Promise<T | undefined | null>,
  timeoutMs = 5000,
  stepMs = 100,
): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const row = await probe();
    if (row) return row;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return null;
}

export { eq, and, inArray, crypto, request };
