/**
 * Trust & safety API (Wayfinder #14/#19 — Apple 1.2, DSA Art 16).
 *
 * Two additive surfaces, decided platform-direct (Q2a):
 *   POST /api/public/report          — file a report about a merchant
 *                                      (works signed-out; phone optional)
 *   POST /api/consumer/blocks        — block a merchant (authed consumer)
 *   DELETE /api/consumer/blocks/:tenantId — unblock
 *   GET  /api/consumer/blocks        — list own blocks
 *
 * Reports go to a platform-reviewed queue (GET/PATCH under /api/admin/reports).
 * Stated SLA shown in the UI: review within 7 days (decision Q5).
 *
 * Mounted at the API ROOT (src/api/index.ts): the report route carries the
 * /public prefix itself; the blocks router mounts under /consumer/blocks.
 */
import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db';
import { contentReports, consumerBlocks, tenants, consumers } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { logSecurityEvent, ipFromRequest } from '../../server/lib/securityLog';
import { requireConsumerAuth } from './middleware/consumerAuth';
import { consumerLimiter } from '../../server/middleware/rateLimiter';

const router = Router();

const REASONS = ['spam', 'fraud_or_scam', 'inappropriate_content', 'impersonation', 'other'] as const;

const ReportSchema = z.object({
  tenantId: z.string().uuid(),
  reason: z.enum(REASONS),
  details: z.string().max(2000).optional(),
  reporterPhone: z.string().max(20).optional(),
});

/**
 * POST /api/public/report — file a report about a merchant listing.
 * Rate-limited, logged as a security event, never throws into the caller
 * (a failed report write returns 500 JSON, not a crash).
 */
router.post('/public/report', async (req, res) => {
  try {
    const parsed = ReportSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'A valid business and reason are required.' });
    }
    const { tenantId, reason, details, reporterPhone } = parsed.data;

    const tenant = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) return res.status(404).json({ error: 'Business not found.' });

    // At most one OPEN report per reporter+merchant (dupes dismissed at
    // review time); anonymous reporters are per-IP abuse-limited upstream.
    const id = crypto.randomUUID();
    await db.insert(contentReports).values({
      id,
      tenantId,
      reporterPhone: reporterPhone?.trim() || null,
      reason,
      details: details?.trim() || null,
      status: 'open',
      createdAt: Date.now(),
    });

    logSecurityEvent({
      type: 'content_report_filed',
      tenantId,
      ip: ipFromRequest(req),
      result: 'success',
      details: { reportId: id, reason },
    });

    return res.status(201).json({
      ok: true,
      ackEn: 'Thank you. Our team reviews reports within 7 days and removes content that violates our terms.',
      ackAm: 'እናመሰግናለን። ቡድናችን ውሳኔ በ7 ቀናት ውስጥ ያገኛል፤ በውሎቻችን የሚስማማ ይዘት ካለ ይነሳል።',
    });
  } catch (err: any) {
    console.error('[trust] report error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to file the report. Please try again.' });
  }
});

// ── Consumer blocks (authed) ────────────────────────────────────────────────
const blocks = Router();

const BlockSchema = z.object({ tenantId: z.string().uuid() });

blocks.use(requireConsumerAuth());
blocks.use(consumerLimiter);

/** GET /api/consumer/blocks — the caller's blocked merchants. */
blocks.get('/', async (req, res) => {
  try {
    const { consumerId } = (req as any).consumer;
    const rows = await db.select({ tenantId: consumerBlocks.tenantId, createdAt: consumerBlocks.createdAt })
      .from(consumerBlocks)
      .where(eq(consumerBlocks.consumerId, consumerId))
      .all();
    res.json(rows);
  } catch (err: any) {
    console.error('[trust] blocks list error:', err?.message || err);
    res.status(500).json({ error: 'Failed to list blocked businesses' });
  }
});

/** POST /api/consumer/blocks — block a merchant (personal filter). */
blocks.post('/', async (req, res) => {
  try {
    const parsed = BlockSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'A valid business is required.' });
    const { consumerId } = (req as any).consumer;
    const { tenantId } = parsed.data;

    const tenant = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) return res.status(404).json({ error: 'Business not found.' });

    const existing = await db.select({ id: consumerBlocks.id })
      .from(consumerBlocks)
      .where(and(eq(consumerBlocks.consumerId, consumerId), eq(consumerBlocks.tenantId, tenantId)))
      .get();
    if (existing) return res.json({ ok: true, alreadyBlocked: true });

    await db.insert(consumerBlocks).values({
      id: crypto.randomUUID(),
      consumerId,
      tenantId,
      createdAt: Date.now(),
    });
    res.status(201).json({ ok: true });
  } catch (err: any) {
    console.error('[trust] block error:', err?.message || err);
    res.status(500).json({ error: 'Failed to block the business. Please try again.' });
  }
});

/** DELETE /api/consumer/blocks/:tenantId — unblock. */
blocks.delete('/:tenantId', async (req, res) => {
  try {
    const { consumerId } = (req as any).consumer;
    const tenantId = String(req.params.tenantId || '');
    if (!tenantId) return res.status(400).json({ error: 'Business is required.' });
    await db.delete(consumerBlocks)
      .where(and(eq(consumerBlocks.consumerId, consumerId), eq(consumerBlocks.tenantId, tenantId)));
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[trust] unblock error:', err?.message || err);
    res.status(500).json({ error: 'Failed to unblock the business. Please try again.' });
  }
});

router.use('/consumer/blocks', blocks);

export default router;
