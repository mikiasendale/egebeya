/**
 * Loyalty-lite punch card engine (P5.1).
 *
 * COUNCIL GATE, ENFORCED IN CODE (ROADMAP §0 ruling): the loyalty program
 * opens only when Telegram identity is proven (P3.3 opt-in ≥ 50% on
 * confirmations) AND the north-star ≥ 0.7. This dev environment has no real
 * traffic, so the feature ships DARK: `LOYALTY_ENABLED=false` by default,
 * and even when an operator flips it on, `gateStatus()` re-reads the live
 * metrics and refuses to accrue punches or redeem rewards while either
 * threshold is unmet. No prose compliance — the DB refuses.
 *
 * Money rule: a redeemed reward lowers the next Chapa charge amount BEFORE
 * initialize and is recorded in payments.meta — merchant-funded discount,
 * never money movement.
 */

import crypto from 'crypto';
import { db } from '../../src/db';
import {
  loyaltyLedger, punchCards, customerStats, tenantSubscriptions,
  plans, telegramLinks,
} from '../../src/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { normalizePhone } from '../../src/lib/phone';

export const LOYALTY_TARGET_DEFAULT = 5;
/** North-star threshold from ROADMAP §1 (≥0.7 by Day 60). */
export const NSM_THRESHOLD = 0.7;
/** Telegram opt-in threshold from P5.1 gate (≥50%). */
export const OPT_IN_THRESHOLD = 0.5;

export interface RewardConfig {
  type: 'percent' | 'fixed_etb_cents';
  value: number;
}

export interface ConsumerCard {
  punches: number;
  target: number;
  /** punches >= target — pure ledger derivation, gate-independent. */
  matured: boolean;
  rewardReady: boolean;
  rewardConfig: RewardConfig;
  gateOpen: boolean;
}

export interface GateStatus {
  open: boolean;
  enabledFlag: boolean;
  optInRate: number | null;
  northStar: number | null;
  reasons: string[];
}

/**
 * Live gate read: env flag AND both council thresholds. Pure-ish (DB reads);
 * cheap enough to call on every loyalty touch.
 */
export async function gateStatus(now = Date.now()): Promise<GateStatus> {
  const enabledFlag = (process.env.LOYALTY_ENABLED || '').trim().toLowerCase() === 'true';
  const reasons: string[] = [];

  // Opt-in rate over customer_stats (the same population confirmations go to).
  const statRows = await db.select({ opted: customerStats.marketingOptIn }).from(customerStats).all();
  const total = statRows.length;
  const opted = statRows.filter((r) => r.opted).length;
  const optInRate = total === 0 ? null : opted / total;
  if (optInRate == null || optInRate < OPT_IN_THRESHOLD) {
    reasons.push(`opt_in_rate ${optInRate?.toFixed(2) ?? 'n/a'} < ${OPT_IN_THRESHOLD}`);
  }

  // North-star proxy over the trailing week (same definition as admin funnel:
  // confirmed/completed bookings per billing-active tenant).
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  // Raw SQL through the libsql client (same duck-type as migrations.ts).
  const driver = (db as any).session?.client ?? (db as any).$client ?? db;
  const runSql = async <T = any>(query: string, args: unknown[] = []): Promise<T[]> => {
    if (driver.execute) {
      const res = await driver.execute({ sql: query, args });
      return (res.rows ?? []) as T[];
    }
    return [];
  };
  const bookingRows = await runSql(
    `SELECT COUNT(*) AS n FROM appointments WHERE status IN ('confirmed','completed') AND start_time >= ?`,
    [weekAgo],
  );
  const tenantRows = await runSql(
    `SELECT COUNT(DISTINCT ts.tenant_id) AS n
       FROM tenant_subscriptions ts JOIN plans p ON p.id = ts.plan_id
      WHERE ts.status IN ('active','trial')`,
  );
  const bookingsN = Number((bookingRows[0] as any)?.n ?? 0);
  const tenantsN = Number((tenantRows[0] as any)?.n ?? 0);
  const northStar = tenantsN === 0 ? null : bookingsN / tenantsN;
  if (northStar == null || northStar < NSM_THRESHOLD) {
    reasons.push(`north_star ${northStar?.toFixed(2) ?? 'n/a'} < ${NSM_THRESHOLD}`);
  }

  return {
    open: enabledFlag && reasons.length === 0,
    enabledFlag,
    optInRate,
    northStar,
    reasons,
  };
}

export interface PunchResult {
  recorded: boolean;
  punches: number;
  target: number;
  rewardReady: boolean;
  gateReasons?: string[];
}

/**
 * Record one punch for a completed visit. Idempotent per (tenant, phone,
 * reason, refId) via the ledger UNIQUE index — cron replays and double taps
 * cannot double-punch. Appends only; the trigger rejects any mutation.
 */
export async function recordPunch(input: {
  tenantId: string;
  consumerPhone: string;
  reason?: 'visit' | 'bonus' | 'manual';
  refType?: string;
  refId?: string;
}): Promise<PunchResult> {
  const gate = await gateStatus();
  if (!gate.open) {
    // GATE CLOSED: touch NOTHING that persists — no ledger row, no card row.
    // (A dark program must not leave FK-bearing rows on tenants.)
    return { recorded: false, punches: 0, target: LOYALTY_TARGET_DEFAULT, rewardReady: false, gateReasons: gate.reasons };
  }
  const card = await ensureCard(input.tenantId, input.consumerPhone);

  const refId = input.refId ?? crypto.randomUUID();
  try {
    await db.insert(loyaltyLedger).values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      consumerPhone: normalizePhone(input.consumerPhone) ?? input.consumerPhone,
      pointsDelta: 1,
      reason: input.reason ?? 'visit',
      refType: input.refType ?? 'appointment',
      refId,
      createdAt: Date.now(),
    });
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (!msg.includes('UNIQUE')) throw err; // duplicate visit → already punched
  }

  // Recompute punches from the ledger — the ledger is truth, the card is a cache.
  return refreshCard(input.tenantId, input.consumerPhone);
}

function rewardReady(card: { punches: number; target: number }): boolean {
  return card.punches >= card.target && card.target > 0;
}

async function ensureCard(tenantId: string, consumerPhone: string) {
  const phone = normalizePhone(consumerPhone) ?? consumerPhone;
  const existing = await db.select().from(punchCards)
    .where(and(eq(punchCards.tenantId, tenantId), eq(punchCards.consumerPhone, phone))).get();
  if (existing) return existing;
  try {
    await db.insert(punchCards).values({
      id: crypto.randomUUID(),
      tenantId,
      consumerPhone: phone,
      punches: 0,
      target: LOYALTY_TARGET_DEFAULT,
      rewardConfig: { type: 'percent', value: 10 },
      createdAt: Date.now(),
    });
  } catch (err: any) {
    if (!String(err?.message || '').includes('UNIQUE')) throw err;
  }
  return (await db.select().from(punchCards)
    .where(and(eq(punchCards.tenantId, tenantId), eq(punchCards.consumerPhone, phone))).get())!;
}

/** Ledger is truth: rebuild the card counter from appended rows. */
async function refreshCard(tenantId: string, consumerPhone: string): Promise<PunchResult> {
  const phone = normalizePhone(consumerPhone) ?? consumerPhone;
  const sumRows = await db.select({
    sum: sql<number>`COALESCE(SUM(${loyaltyLedger.pointsDelta}), 0)`.as('sum'),
  })
    .from(loyaltyLedger)
    .where(and(eq(loyaltyLedger.tenantId, tenantId), eq(loyaltyLedger.consumerPhone, phone)))
    .get();
  const punches = Math.max(0, Number(sumRows?.sum ?? 0));
  const card = await ensureCard(tenantId, consumerPhone);
  if (card.punches !== punches) {
    // punch_cards is a CACHE of the append-only ledger — updating it is not
    // a ledger mutation, so the append-only trigger does not apply here.
    await db.update(punchCards).set({ punches }).where(eq(punchCards.id, card.id));
  }
  const fresh = { ...card, punches };
  return { recorded: true, punches, target: fresh.target, rewardReady: rewardReady(fresh) };
}

/** The consumer-facing card view (ring data, P5.2). Consumer JWT required upstream. */
export async function getCardForConsumer(tenantId: string, consumerPhone: string): Promise<ConsumerCard> {
  // Ledger is truth: recompute from appended rows and sync the cache row.
  const refreshed = await refreshCard(tenantId, consumerPhone);
  const phone = normalizePhone(consumerPhone) ?? consumerPhone;
  const card = await db.select().from(punchCards)
    .where(and(eq(punchCards.tenantId, tenantId), eq(punchCards.consumerPhone, phone))).get();
  const gate = await gateStatus();
  const target = card?.target ?? LOYALTY_TARGET_DEFAULT;
  return {
    punches: refreshed.punches,
    target,
    // Pure derivation: the card holds ≥ target punches.
    matured: refreshed.punches >= target && target > 0,
    // Gate-gated: maturity only becomes redeemable when the council gate is
    // open. Split so tests (and the ring UI) can show honest progress while
    // the program is dark.
    rewardReady: gate.open && refreshed.punches >= target && target > 0,
    rewardConfig: (card?.rewardConfig as RewardConfig | null) ?? { type: 'percent', value: 10 },
    gateOpen: gate.open,
  };
}

/**
 * Merchant manual card issuance (T4.2). Gate-first, engine-only.
 *
 * A clerk hands a physical punch card to a customer by phone without waiting
 * for consumer Telegram opt-in — but ONLY through the engine's own API, and
 * ONLY while the council gate is open. With the gate closed the card row is
 * never created: a card written into a dead feature is ghost data nothing in
 * the booking flow consumes (pendingRewardDiscount / consumeReward both
 * short-circuit on !gate.open), so we refuse instead of accreting orphans.
 * Issuing reuses getCardForConsumer, so the ledger stays truth, the card
 * cache is sync'd, and punches are recomputed from appended rows — never a
 * hand-rolled punch_cards insert that could bypass the engine's ledger math.
 */
export async function issueCard(input: {
  tenantId: string;
  consumerPhone: string;
}): Promise<{ issued: boolean; gateOpen: boolean; card: ConsumerCard | null }> {
  const gate = await gateStatus();
  if (!gate.open) {
    return { issued: false, gateOpen: false, card: null };
  }
  const card = await getCardForConsumer(input.tenantId, input.consumerPhone);
  return { issued: true, gateOpen: true, card };
}

/**
 * Redemption preview + application helper for the charge path.
 * Returns the ETB-cents discount to apply to the NEXT Chapa charge, or 0.
 * Does NOT consume anything here — consumption happens when the discounted
 * charge is actually created (recordPunch with negative delta + reason).
 */
export async function pendingRewardDiscount(
  tenantId: string,
  consumerPhone: string,
  amountEtbCents: number,
): Promise<{ discountEtbCents: number; config: RewardConfig | null }> {
  const gate = await gateStatus();
  if (!gate.open) return { discountEtbCents: 0, config: null };

  const phone = normalizePhone(consumerPhone) ?? consumerPhone;
  const card = await db.select().from(punchCards)
    .where(and(eq(punchCards.tenantId, tenantId), eq(punchCards.consumerPhone, phone))).get();
  if (!card || card.punches < card.target) return { discountEtbCents: 0, config: null };

  const cfg = (card.rewardConfig as RewardConfig | null) ?? { type: 'percent', value: 10 };
  let discount = 0;
  if (cfg.type === 'percent') discount = Math.floor(amountEtbCents * cfg.value / 100);
  else discount = cfg.value;
  return { discountEtbCents: Math.min(discount, amountEtbCents), config: cfg };
}

/**
 * Consume a matured reward after a discounted charge was created: append a
 * negative redemption row so the next cycle starts fresh (append-only —
 * consumption is another append, never an edit).
 */
export async function consumeReward(input: {
  tenantId: string;
  consumerPhone: string;
  refType?: string;
  refId?: string;
}): Promise<boolean> {
  const gate = await gateStatus();
  if (!gate.open) return false;

  const phone = normalizePhone(input.consumerPhone) ?? input.consumerPhone;
  const card = await db.select().from(punchCards)
    .where(and(eq(punchCards.tenantId, input.tenantId), eq(punchCards.consumerPhone, phone))).get();
  if (!card || card.punches < card.target) return false;

  try {
    await db.insert(loyaltyLedger).values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      consumerPhone: phone,
      pointsDelta: -card.target,
      reason: 'redemption',
      refType: input.refType ?? 'booking',
      refId: input.refId ?? crypto.randomUUID(),
      createdAt: Date.now(),
    });
  } catch (err: any) {
    if (!String(err?.message || '').includes('UNIQUE')) throw err;
    return false; // this ref already consumed a reward
  }
  await refreshCard(input.tenantId, phone);
  return true;
}
