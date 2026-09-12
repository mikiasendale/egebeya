/**
 * Promo mint — the single honest path from "share a discount" to a real,
 * redeemable row (#49). Every share surface that quotes a percentage must
 * await one of these first: no percentage in UI text without a row behind it.
 *
 * POST /api/tenant/promo-codes validates code/discount and defaults
 * maxUses:1 — single-use by design so a hand-shared code cannot leak.
 */
import { authFetch } from './api';

/** `PREFIX` + 4 random base36 chars, uppercase — e.g. WIN10-7GK2. */
export function generatePromoCode(prefix: string): string {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}${suffix}`;
}

/**
 * Mint a percent promo and return the live code. Defaults to single-use —
 * a hand-shared code cannot leak. `validUntil` (epoch ms) makes the discount
 * — and any expiry printed in the share text — true for the same window;
 * `maxUses` opens it to a bounded crowd (flash sales) instead.
 */
export async function createPromo(
  percent: number,
  prefix: string,
  opts: { validUntil?: number; maxUses?: number } = {},
): Promise<string> {
  const code = generatePromoCode(prefix);
  const res = await authFetch('/api/tenant/promo-codes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      discountType: 'percent',
      discountValue: percent,
      maxUses: typeof opts.maxUses === 'number' && opts.maxUses > 0 ? opts.maxUses : 1,
      ...(typeof opts.validUntil === 'number' ? { validUntil: opts.validUntil } : {}),
    }),
  });
  if (!res.ok) throw new Error('Promo creation failed');
  return code;
}
