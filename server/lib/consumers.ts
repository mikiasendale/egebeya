/**
 * Consumer profile helpers (P3.4) — phone-keyed identity for END CUSTOMERS,
 * distinct from merchant `users` accounts.
 *
 * P3.7 invariant enforced here: a consumer row is NEVER created without a
 * consent timestamp. The caller states the basis:
 *   - 'booking'        → service-necessity basis: the customer gave us their
 *                        phone to receive booking service messages.
 *   - 'consumer_login' → explicit identity login via OTP verify.
 *   - 'merchant_card'  → a merchant issued a loyalty punch card on the
 *                        customer's phone; the customer provided it in person.
 * Marketing contact is a SEPARATE, opt-in flag (customer_stats.marketing_opt_in)
 * and is never implied by either basis.
 */

import crypto from 'crypto';
import { db } from '../../src/db';
import { consumers } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { normalizePhone } from '../../src/lib/phone';

export type ConsentBasis = 'booking' | 'consumer_login' | 'merchant_card';

export async function upsertConsumerByPhone(input: {
  phone: string;
  name?: string | null;
  /** Consent basis — recorded in the audit trail of this module's callers. */
  basis: ConsentBasis;
}): Promise<string> {
  const normalized = normalizePhone(input.phone);
  if (!normalized) throw new Error('Invalid Ethiopian phone number');

  const existing = await db.select({ id: consumers.id }).from(consumers)
    .where(eq(consumers.phone, normalized)).get();
  if (existing) return existing.id;

  const id = crypto.randomUUID();
  try {
    await db.insert(consumers).values({
      id,
      phone: normalized,
      name: input.name ?? null,
      // P3.7 gate: no row without a stamped consent moment.
      consentGivenAt: Date.now(),
      createdAt: Date.now(),
    });
    return id;
  } catch (err: any) {
    // Lost a UNIQUE(phone) race against a concurrent booking/login → the
    // winner's row is just as good.
    const winner = await db.select({ id: consumers.id }).from(consumers)
      .where(eq(consumers.phone, normalized)).get();
    if (winner) return winner.id;
    throw err;
  }
}
