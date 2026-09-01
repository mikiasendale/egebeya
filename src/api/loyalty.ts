/**
 * Merchant loyalty operations (T4.2) — manual card issuance behind the gate.
 *
 * Mounted at /api/tenant/loyalty (owner-only). The engine ALONE decides
 * whether a card can exist:
 *   - GET  /gate-status — the UI's honest gate read, so the form can render
 *     an explainer ("cards you issue will activate when the program
 *     launches") instead of a silent bypass when the program is dark.
 *   - POST /cards       — upsert the consumer (P3.7 consent stamped) then
 *     issue through the engine. The engine refuses while the gate is closed,
 *     so we never write a card a dead feature cannot consume.
 *
 * The consumer-facing ring (GET /api/consumer/loyalty/:tenantId) is
 * untouched — two audiences, one data source.
 */
import { Router } from 'express';
import { requireAuth } from './middleware/auth';
import { csrfProtection } from './middleware/csrf';
import { tenantWriteLimiter } from '../../server/middleware/rateLimiter';
import { gateStatus, issueCard } from '../../server/lib/loyalty';
import { upsertConsumerByPhone } from '../../server/lib/consumers';
import { normalizePhone } from '../lib/phone';

const router = Router();

router.use(requireAuth({ roles: ['owner'] }));

/** GET /api/tenant/loyalty/gate-status — the UI's honest gate read. */
router.get('/gate-status', async (req, res) => {
  try {
    const gate = await gateStatus();
    res.json({
      gateOpen: gate.open,
      enabledFlag: gate.enabledFlag,
      optInRate: gate.optInRate,
      northStar: gate.northStar,
      reasons: gate.reasons,
    });
  } catch (err: any) {
    console.error('[loyalty] gate-status error:', err?.message || err);
    res.status(500).json({ error: 'Failed to read loyalty gate' });
  }
});

/** POST /api/tenant/loyalty/cards — issue a punch card behind the gate. */
router.post('/cards', csrfProtection, tenantWriteLimiter, async (req, res) => {
  const { tenantId } = (req as any).user;
  const { phone } = req.body || {};
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    return res.status(400).json({ error: 'phone is required' });
  }
  // Audit fix: an unparseable phone is a CLIENT error — normalize here and
  // answer 400 instead of letting the consumer upsert throw a 500.
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return res.status(400).json({ error: 'Invalid Ethiopian phone number' });
  }
  try {
    // P3.7: a consumer row only ever lands with a stamped consent moment.
    await upsertConsumerByPhone({ phone: normalized, basis: 'merchant_card' });
    const result = await issueCard({ tenantId, consumerPhone: normalized });
    if (!result.issued) {
      // Gate closed: no card was written — tell the UI so it explains.
      return res.json({ gateOpen: false, issued: false, card: null });
    }
    res.status(201).json({ gateOpen: true, issued: true, card: result.card });
  } catch (err: any) {
    console.error('[loyalty] issue card error:', err?.message || err);
    res.status(500).json({ error: 'Failed to issue punch card' });
  }
});

export default router;
