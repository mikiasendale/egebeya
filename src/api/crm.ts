import { Router } from 'express';
import { db } from '../db';
import {
  customerStats,
  promoCodes,
  tenants,
} from '../db/schema';
import { eq, and, like, or, sql, lte, inArray } from 'drizzle-orm';
import crypto from 'crypto';
import { requireAuth } from './middleware/auth';
import { csrfProtection } from './middleware/csrf';
import { tenantWriteLimiter } from '../../server/middleware/rateLimiter';
import { sendSms } from '../../server/lib/sms';
import { computeHealthTag } from '../lib/customer-health';

const router = Router();

// Owner-only auth + CSRF + write throttle for all CRM routes.
router.use(requireAuth({ roles: ['owner'] }));
router.use(csrfProtection);
router.use(tenantWriteLimiter);

/**
 * GET /api/tenant/customers
 *
 * Returns customer_stats rows for the authenticated tenant. Owner-only.
 *
 * Query params:
 *   ?q=            prefix search on customer_name or customer_phone
 *   ?inactive_days=30  only customers whose last_visit_at is older than N days
 *
 * Projection: never returns internal IDs such as tenant_id.
 */
router.get('/customers', async (req, res) => {
  const { tenantId } = (req as any).user;

  try {
    const q = (req.query.q as string | undefined)?.trim();
    const inactiveDays = parseInt(String(req.query.inactive_days || ''), 10);

    const filters: any[] = [eq(customerStats.tenantId, tenantId)];

    if (q) {
      filters.push(
        or(
          like(customerStats.customerName, `${q}%`),
          like(customerStats.customerPhone, `${q}%`),
        ),
      );
    }

    if (!isNaN(inactiveDays) && inactiveDays > 0) {
      const cutoff = Date.now() - inactiveDays * 86400000;
      filters.push(
        or(
          lte(customerStats.lastVisitAt, cutoff),
          sql`${customerStats.lastVisitAt} IS NULL`,
        ),
      );
    }

    const rows = await db.select({
      phone: customerStats.customerPhone,
      name: customerStats.customerName,
      marketingOptIn: customerStats.marketingOptIn,
      visitCount: customerStats.visitCount,
      noShowCount: customerStats.noShowCount,
      totalSpend: customerStats.totalSpendEtbCents,
      lastVisit: customerStats.lastVisitAt,
      lastCancelledAt: customerStats.lastCancelledAt,
    })
      .from(customerStats)
      .where(and(...filters))
      .orderBy(sql`${customerStats.lastVisitAt} DESC NULLS LAST`)
      .all();

    // Compute the health tag on the fly so it always reflects current stats,
    // regardless of how stale the cached health_tag column may be.
    const enriched = rows.map((r) => ({
      ...r,
      healthTag: computeHealthTag(r.visitCount, r.noShowCount, r.lastVisit),
    }));

    res.json(enriched);
  } catch (error) {
    console.error('Customers fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

/**
 * POST /api/tenant/promo-codes
 *
 * Creates a new promo code for the tenant. Owner-only.
 *
 * Body: { code, discountType, discountValue, maxUses?, validFrom?, validUntil? }
 */
router.post('/promo-codes', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { code, discountType, discountValue, maxUses, validFrom, validUntil } = req.body || {};

  if (!code || typeof code !== 'string' || !code.trim()) {
    return res.status(400).json({ error: 'code is required' });
  }
  if (!discountType || !['percent', 'fixed_etb_cents'].includes(discountType)) {
    return res.status(400).json({ error: 'discountType must be "percent" or "fixed_etb_cents"' });
  }
  if (typeof discountValue !== 'number' || discountValue <= 0) {
    return res.status(400).json({ error: 'discountValue must be a positive number' });
  }
  if (discountType === 'percent' && (discountValue > 100 || !Number.isInteger(discountValue))) {
    return res.status(400).json({ error: 'percent discount must be an integer between 1 and 100' });
  }

  const now = Date.now();
  const id = crypto.randomUUID();

  try {
    // Check for duplicate code within the same tenant.
    const existing = await db.select({ id: promoCodes.id })
      .from(promoCodes)
      .where(and(eq(promoCodes.tenantId, tenantId), eq(promoCodes.code, code.trim())))
      .get();
    if (existing) {
      return res.status(409).json({ error: 'A promo code with this value already exists' });
    }

    await db.insert(promoCodes).values({
      id,
      tenantId,
      code: code.trim(),
      discountType,
      discountValue,
      maxUses: typeof maxUses === 'number' && maxUses > 0 ? maxUses : 1,
      usedCount: 0,
      validFrom: typeof validFrom === 'number' ? validFrom : null,
      validUntil: typeof validUntil === 'number' ? validUntil : null,
      isActive: true,
      createdAt: now,
    });

    const created = await db.select().from(promoCodes).where(eq(promoCodes.id, id)).get();
    res.status(201).json(created);
  } catch (error) {
    console.error('Create promo code error:', error);
    res.status(500).json({ error: 'Failed to create promo code' });
  }
});

/**
 * GET /api/tenant/promo-codes
 *
 * Lists all promo codes for the authenticated tenant. Owner-only.
 */
router.get('/promo-codes', async (req, res) => {
  const { tenantId } = (req as any).user;

  try {
    const rows = await db.select()
      .from(promoCodes)
      .where(eq(promoCodes.tenantId, tenantId))
      .orderBy(sql`${promoCodes.createdAt} DESC`)
      .all();
    res.json(rows);
  } catch (error) {
    console.error('List promo codes error:', error);
    res.status(500).json({ error: 'Failed to fetch promo codes' });
  }
});

/**
 * POST /api/tenant/marketing/blast
 *
 * Send an SMS marketing blast to customers who have opted in
 * (marketing_opt_in = true on their customer_stats row).
 *
 * Body: { message: string }
 *
 * Every message automatically appends an "Reply STOP" opt-out keyword
 * so customers can opt out of future marketing messages.
 */
router.post('/marketing/blast', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { message } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }
  if (message.length > 480) {
    return res.status(400).json({ error: 'message is too long (max 480 chars)' });
  }

  try {
    // Only send to customers who explicitly opted in to marketing.
    const recipients = await db.select({
      phone: customerStats.customerPhone,
      name: customerStats.customerName,
    })
      .from(customerStats)
      .where(and(
        eq(customerStats.tenantId, tenantId),
        eq(customerStats.marketingOptIn, true),
      ))
      .all();

    const OPT_OUT_SUFFIX = ' Reply STOP to opt out.';
    const fullText = message.trim() + OPT_OUT_SUFFIX;

    let sent = 0;
    const errors: { phone: string; error: string }[] = [];

    for (const r of recipients) {
      try {
        await sendSms({
          to: r.phone,
          text: fullText,
        });
        sent += 1;
      } catch (err: any) {
        errors.push({ phone: r.phone.slice(0, 7) + '****', error: err.message || 'send failed' });
      }
    }

    res.json({ success: true, sent, skipped: recipients.length - sent, errors });
  } catch (error) {
    console.error('Marketing blast error:', error);
    res.status(500).json({ error: 'Failed to send marketing blast' });
  }
});

/**
 * PATCH /api/tenant/customers/:phone/marketing-opt-in
 *
 * Set marketing_opt_in for a specific customer by phone.
 * Owner-only. The customer's consent must already exist (the row is created
 * only when a booking is confirmed/completed).
 */
router.patch('/customers/:phone/marketing-opt-in', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { phone } = req.params;
  const { marketing_opt_in } = req.body || {};

  if (typeof marketing_opt_in !== 'boolean') {
    return res.status(400).json({ error: 'marketing_opt_in must be a boolean' });
  }

  try {
    const existing = await db.select()
      .from(customerStats)
      .where(and(eq(customerStats.tenantId, tenantId), eq(customerStats.customerPhone, phone)))
      .get();

    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    await db.update(customerStats)
      .set({ marketingOptIn: marketing_opt_in })
      .where(and(eq(customerStats.tenantId, tenantId), eq(customerStats.customerPhone, phone)));

    res.json({ success: true });
  } catch (error) {
    console.error('Marketing opt-in update error:', error);
    res.status(500).json({ error: 'Failed to update marketing opt-in status' });
  }
});

/**
 * POST /api/tenant/customers/:phone/require-upfront
 *
 * Toggle whether a specific customer (identified by phone) must pay a Telebirr
 * deposit upfront before their booking is confirmed. The flag is stored as a
 * phone list (settings.require_upfront_phones) on the tenant row so the public
 * booking flow can enforce it per-customer without a customer table join.
 *
 * Body: { require: boolean }
 */
router.post('/customers/:phone/require-upfront', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { phone } = req.params;
  const { require } = req.body || {};

  if (typeof require !== 'boolean') {
    return res.status(400).json({ error: 'require must be a boolean' });
  }

  try {
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const settings = (tenant.settings as any) || {};
    const list: string[] = Array.isArray(settings.require_upfront_phones)
      ? settings.require_upfront_phones.slice()
      : [];

    const idx = list.indexOf(phone);
    const alreadySet = idx !== -1;

    if (require && !alreadySet) {
      list.push(phone);
    } else if (!require && alreadySet) {
      list.splice(idx, 1);
    }

    const newSettings = { ...settings, require_upfront_phones: list };
    await db.update(tenants).set({ settings: newSettings }).where(eq(tenants.id, tenantId));

    res.json({ success: true, require_upfront: list.includes(phone) });
  } catch (error) {
    console.error('Require-upfront toggle error:', error);
    res.status(500).json({ error: 'Failed to update upfront-payment requirement' });
  }
});

/**
 * GET /api/tenant/settings/upfront-phones
 *
 * Returns the list of customer phone numbers flagged to require upfront
 * Telebirr payment. Used by the Customer Health UI to render toggle state.
 * Owner-only.
 */
router.get('/settings/upfront-phones', async (req, res) => {
  const { tenantId } = (req as any).user;

  try {
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    const settings = (tenant.settings as any) || {};
    const list: string[] = Array.isArray(settings.require_upfront_phones)
      ? settings.require_upfront_phones
      : [];

    res.json({ require_upfront_phones: list });
  } catch (error) {
    console.error('Upfront-phones fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch upfront-phones list' });
  }
});

export default router;