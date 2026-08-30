/**
 * Settlement reconciliation (P1.7) — the collected-vs-invoiced distinction.
 *
 * Chapa charges settle T+2/T+3 AFTER the webhook confirms payment. A
 * 'completed' payment / 'paid' invoice is therefore REVENUE EARNED but not
 * yet CASH COLLECTED until settlement lands. Rows whose settlement stays
 * 'pending' past SETTLEMENT_STALE_MS need manual comparison against the
 * Chapa dashboard export.
 *
 * Lifecycle: NULL (legacy) → 'pending' → 'settled' | 'failed'.
 */
import { db } from '../../src/db';
import { payments, invoices } from '../../src/db/schema';
import { eq, and, lt, sql } from 'drizzle-orm';

/** A pending settlement older than this is stale and needs manual review. */
export const SETTLEMENT_STALE_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * Decide the initial settlement status from what the provider told us in the
 * webhook. Chapa's standard charge webhooks do NOT confirm settlement — those
 * stay 'pending'. Only an explicit settlement confirmation flips to 'settled'
 * at delivery time; everything else ages into the reconciliation report.
 */
export function deriveSettlementStatus(
  verifiedStatus: string,
  webhookBody: any,
  verificationRaw: any,
): { settlementStatus: 'pending' | 'settled' | 'failed'; settledAt: number | null } {
  if (verifiedStatus === 'failed') {
    return { settlementStatus: 'failed', settledAt: null };
  }
  if (verifiedStatus !== 'completed') {
    return { settlementStatus: 'pending', settledAt: null };
  }

  // Explicit settlement confirmation — either a settlement-typed webhook event
  // or the verify payload carrying Chapa's settlement marker.
  const eventIsSettlement =
    webhookBody?.event === 'charge.settlement' || webhookBody?.type === 'settlement';
  const rawSettled =
    verificationRaw?.data?.settlement_status === 'success' ||
    verificationRaw?.data?.settlement_status === 'successful';

  if (eventIsSettlement || rawSettled) {
    return { settlementStatus: 'settled', settledAt: Date.now() };
  }
  return { settlementStatus: 'pending', settledAt: null };
}

/**
 * Timestamp convention (payments table has no created/completed_at): while
 * `settlement_status` is 'pending', `settled_at` holds WHEN THE CHARGE WAS
 * CONFIRMED (the moment settlement tracking started); once 'settled', it
 * holds when settlement landed. Staleness is therefore always measurable.
 * Invoices anchor staleness on paidAt instead.
 */

/** Paid-but-unsettled payments older than the stale threshold, oldest first. */
export async function findStalePendingPayments(now: number = Date.now()) {
  return db.select().from(payments)
    .where(and(
      sql`${payments.settlementStatus} = 'pending'`,
      sql`${payments.status} IN ('completed', 'success')`,
      lt(payments.settledAt, now - SETTLEMENT_STALE_MS),
    ))
    .all();
}

/** Paid-but-unsettled invoices older than the stale threshold, oldest first. */
export async function findStalePendingInvoices(now: number = Date.now()) {
  return db.select().from(invoices)
    .where(and(
      eq(invoices.settlementStatus, 'pending'),
      eq(invoices.status, 'paid'),
      lt(invoices.paidAt, now - SETTLEMENT_STALE_MS),
    ))
    .all();
}

export interface SettlementReconciliationReport {
  generatedAt: number;
  staleThresholdMs: number;
  stalePayments: Array<{ id: string; txRef: string | null; amountCents: number; tenantId: string; pendingSince: number | null }>;
  staleInvoices: Array<{ id: string; number: string; amountCents: number; tenantId: string; paidAt: number | null }>;
}

/** Weekly manual-reconciliation input for comparison with the Chapa export. */
export async function settlementReconciliationReport(now: number = Date.now()): Promise<SettlementReconciliationReport> {
  const stalePayments = await findStalePendingPayments(now);
  const staleInvoices = await findStalePendingInvoices(now);
  return {
    generatedAt: now,
    staleThresholdMs: SETTLEMENT_STALE_MS,
    stalePayments: stalePayments.map((p) => ({
      id: p.id,
      txRef: p.gatewayReference,
      amountCents: p.amount,
      tenantId: p.tenantId,
      pendingSince: p.settledAt,
    })),
    staleInvoices: staleInvoices.map((i) => ({
      id: i.id,
      number: i.number,
      amountCents: i.amount,
      tenantId: i.tenantId,
      paidAt: i.paidAt,
    })),
  };
}
