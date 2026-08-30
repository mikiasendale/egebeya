/**
 * CHAIN 2 (P1.7): settlement webhook → metadata refresh (no re-activation).
 *
 *   charge webhook (event id A)  → activation + 'paid' invoice, settlement pending
 *   settlement webhook (event id B, same tx_ref, event: 'charge.settlement')
 *     → payments.settlement_status 'settled', invoice settlement fields move,
 *       subscription endsAt UNCHANGED (deriveSettlementStatus → payments.ts
 *       alreadyGranted guard → billing.activateProSubscription NOT re-run).
 *
 * Failure mode: an exact replay (same event id) short-circuits to
 * { duplicate: true } with zero side effects.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

vi.mock('../../server/lib/chapa', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/lib/chapa')>();
  return {
    ...actual,
    verifyPayment: vi.fn(async () => ({ status: 'success', amount: '1000', tx_ref: '', raw: {} })),
  };
});

import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { tenantSubscriptions, payments, invoices } from '../../src/db/schema';
import {
  mountApp, makeOwner, deliverWebhook, deleteTenantCascade, seedProPayment,
} from './chain-helpers';
import type { App } from './chain-helpers';

describe('CHAIN: settlement webhook refreshes metadata without re-activating', () => {
  let app: App;
  let tenantId: string;
  const createdTxRefs: string[] = [];

  beforeAll(async () => {
    app = await mountApp();
    const owner = await makeOwner({
      subscription: { planName: 'free', status: 'active' },
    });
    tenantId = owner.tenantId;
  });

  afterAll(async () => {
    await deleteTenantCascade(tenantId);
    void createdTxRefs;
  });

  it('happy path: charge webhook activates; settlement webhook only refreshes settlement fields', async () => {
    const pay = seedProPayment(tenantId, { cycleDays: 30 });
    createdTxRefs.push(pay.txRef);
    await db.insert(payments).values(pay.row);

    // 1. Original charge webhook — activates the cycle.
    const charge = await deliverWebhook(app, {
      tx_ref: pay.txRef, status: 'success', reference: `charge-${crypto.randomUUID()}`,
    });
    expect(charge.status).toBe(200);
    expect(charge.body.invoice).toBe('created');

    const subAfterCharge = await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    expect(subAfterCharge!.status).toBe('active');
    const endsAtAfterCharge = subAfterCharge!.endsAt;

    let invoice = await db.select().from(invoices)
      .where(eq(invoices.chapaTxRef, pay.txRef)).get();
    expect(invoice!.status).toBe('paid');
    expect(invoice!.settlementStatus).toBe('pending'); // collected ≠ settled

    // 2. Settlement webhook — DIFFERENT event id, same tx_ref.
    const settlement = await deliverWebhook(app, {
      tx_ref: pay.txRef,
      status: 'success',
      reference: `settle-${crypto.randomUUID()}`, // new event id
      event: 'charge.settlement', // the settlement marker settlements.ts reads
    });
    expect(settlement.status).toBe(200);
    expect(settlement.body.duplicate ?? false).toBe(false);

    // 3. endsAt UNCHANGED — the settlement redelivery must not extend the cycle.
    const subAfterSettlement = await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    expect(subAfterSettlement!.endsAt).toBe(endsAtAfterCharge);

    // 4. Settlement metadata moved on both money records.
    invoice = await db.select().from(invoices)
      .where(eq(invoices.chapaTxRef, pay.txRef)).get();
    expect(invoice!.settlementStatus).toBe('settled');
    expect(typeof invoice!.settledAt).toBe('number');

    const payment = await db.select().from(payments)
      .where(eq(payments.gatewayReference, pay.txRef)).get();
    expect(payment!.settlementStatus).toBe('settled');
    expect(typeof payment!.settledAt).toBe('number');

    // 5. Exactly one invoice — no duplicate money record.
    const invoiceRows = await db.select().from(invoices)
      .where(eq(invoices.chapaTxRef, pay.txRef)).all();
    expect(invoiceRows.length).toBe(1);
  });

  it('failure mode: exact replay of the settlement event short-circuits with no side effects', async () => {
    const pay = seedProPayment(tenantId, { cycleDays: 30 });
    await db.insert(payments).values(pay.row);

    const chargeRef = `charge-${crypto.randomUUID()}`;
    const settleRef = `settle-${crypto.randomUUID()}`;
    await deliverWebhook(app, { tx_ref: pay.txRef, status: 'success', reference: chargeRef });
    const firstSettle = await deliverWebhook(app, {
      tx_ref: pay.txRef, status: 'success', reference: settleRef, event: 'charge.settlement',
    });
    expect(firstSettle.status).toBe(200);

    const endsAt = (await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId)).get())!.endsAt;
    const invoiceRowsBefore = (await db.select().from(invoices)
      .where(eq(invoices.chapaTxRef, pay.txRef)).all()).length;
    const settledAtBefore = (await db.select().from(payments)
      .where(eq(payments.gatewayReference, pay.txRef)).get())!.settledAt;

    // Same reference → same event id → idempotency guard.
    const replay = await deliverWebhook(app, {
      tx_ref: pay.txRef, status: 'success', reference: settleRef, event: 'charge.settlement',
    });
    expect(replay.status).toBe(200);
    expect(replay.body.duplicate).toBe(true);

    const invoiceRowsAfter = (await db.select().from(invoices)
      .where(eq(invoices.chapaTxRef, pay.txRef)).all()).length;
    expect(invoiceRowsAfter).toBe(invoiceRowsBefore);
    const settledAtAfter = (await db.select().from(payments)
      .where(eq(payments.gatewayReference, pay.txRef)).get())!.settledAt;
    expect(settledAtAfter).toBe(settledAtBefore);
    expect((await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId)).get())!.endsAt).toBe(endsAt);
  });
});
