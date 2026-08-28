/**
 * P0.5(a) — promo_codes UNIQUE(tenant_id, code) enforcement.
 *
 * A merchant must not be able to define the same promo code twice; two
 * different merchants MAY both define the same code (lookup is per-tenant).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import { eq, inArray } from 'drizzle-orm';

import { db } from '../../src/db';
import { tenants, promoCodes } from '../../src/db/schema';

describe('promo_codes tenant-scoped uniqueness (P0.5)', () => {
  const tenantIds: string[] = [];
  const promoIds: string[] = [];

  async function makeTenant(): Promise<string> {
    const id = crypto.randomUUID();
    await db.insert(tenants).values({
      id,
      name: `Promo Unique ${id.slice(0, 6)}`,
      slug: `promo-uniq-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      settings: {},
      createdAt: Date.now(),
    });
    tenantIds.push(id);
    return id;
  }

  function insertPromo(tenantId: string, code: string) {
    const row = {
      id: crypto.randomUUID(),
      tenantId,
      code,
      discountType: 'percent',
      discountValue: 10,
      maxUses: 1,
      usedCount: 0,
      isActive: true,
      createdAt: Date.now(),
    };
    promoIds.push(row.id);
    return db.insert(promoCodes).values(row);
  }

  afterAll(async () => {
    if (promoIds.length > 0) {
      await db.delete(promoCodes).where(inArray(promoCodes.id, promoIds)).catch(() => {});
    }
    for (const id of tenantIds) {
      await db.delete(promoCodes).where(eq(promoCodes.tenantId, id)).catch(() => {});
      await db.delete(tenants).where(eq(tenants.id, id)).catch(() => {});
    }
  });

  it('rejects a duplicate code within the same tenant', async () => {
    const tenantId = await makeTenant();
    await insertPromo(tenantId, 'WELCOME10');

    let rejected = false;
    try {
      await insertPromo(tenantId, 'WELCOME10');
    } catch (err: any) {
      rejected = true;
      const code = String(err?.code || err?.cause?.code || '');
      const msg = String(err?.message || err?.cause?.message || '');
      expect(code.includes('SQLITE_CONSTRAINT') || msg.includes('UNIQUE')).toBe(true);
    }
    expect(rejected).toBe(true);

    // Exactly one row survived.
    const rows = await db.select().from(promoCodes)
      .where(eq(promoCodes.tenantId, tenantId));
    expect(rows.length).toBe(1);
  });

  it('allows the same code under a different tenant', async () => {
    const t1 = await makeTenant();
    const t2 = await makeTenant();

    await insertPromo(t1, 'SHARED1');
    await insertPromo(t2, 'SHARED1'); // must NOT throw

    const rows = await db.select().from(promoCodes)
      .where(eq(promoCodes.code, 'SHARED1'));
    expect(rows.length).toBe(2);
    expect(new Set(rows.map((r) => r.tenantId)).size).toBe(2);
  });
});
