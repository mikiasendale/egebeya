import { Router } from 'express';
import authRoutes from './auth';
import tenantRoutes from './tenant';
import bookingsRoutes, { walkInRouter } from './bookings';
import publicRoutes from './public';
import paymentRoutes from './payments';
import testRoutes from './test';
import proSiteRoutes from './pro-site';
import siteSettingsRoutes from './site-settings';
import siteGeneratorRoutes from './site-generator';
import adminRoutes from './admin';
import healthRoutes from './health';
import aiChatRoutes from './ai-chat';
import crmRoutes from './crm';
import { intentPublicRouter, intentTenantRouter } from './intent';
import apiKeysRoutes from './api-keys';
import v1Routes from './v1';
import telegramRoutes from './telegram';
import consumerRoutes from './consumer';
import { queueOwnerRouter, queuePublicRouter } from './queue';
import { apiKeyLimiter } from '../../server/middleware/rateLimiter';
import { dbHealthMiddleware } from '../db/health';

const router = Router();

// Health check — mounted FIRST so it can respond even when DB is unreachable.
// UptimeRobot pings this to keep the app awake on Render.
router.use('/health', healthRoutes);

// Database-resilience guard — mounted before other routes so an unreachable DB
// degrades the entire API to a clean 503 instead of leaking stack traces.
router.use(dbHealthMiddleware);

router.use('/auth', authRoutes);
// F4: the queue console must be reachable by STAFF (the barber advances the
// queue), so it mounts BEFORE the owner-gated tenant router. It carries its
// own any-role requireAuth + per-tenant scoping.
router.use('/tenant/queue', queueOwnerRouter);
router.use('/tenant', tenantRoutes);
router.use('/tenant', proSiteRoutes);
router.use('/tenant', siteSettingsRoutes);
router.use('/tenant', siteGeneratorRoutes);
router.use('/tenant', aiChatRoutes);
router.use('/tenant', crmRoutes);
router.use('/public', intentPublicRouter);
router.use('/tenant', intentTenantRouter);
router.use('/tenant/api-keys', apiKeysRoutes);
router.use('/tenant/bookings', walkInRouter);
router.use('/bookings', bookingsRoutes);
// Queue-Buster consumer board must sit BEFORE the gated public routes —
// same pattern as /site-status: it serves pre-gate, opaque-token traffic.
router.use('/public', queuePublicRouter);
router.use('/public', publicRoutes);
router.use('/v1', apiKeyLimiter, v1Routes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
// Telegram bot webhook (P3.2) — public, secret-token verified inside.
router.use('/telegram', telegramRoutes);
// Consumer identity-lite endpoints (P3.4) + data-deletion (P3.7).
router.use('/consumer', consumerRoutes);

// Test-only routes must NEVER ship to production. Mounted only when
// explicitly enabled via ENABLE_TEST_ENDPOINTS=true.
if (process.env.ENABLE_TEST_ENDPOINTS === 'true') {
  router.use('/test', testRoutes);
}

// Unknown API paths return JSON 404 rather than falling through to the SPA
// catch-all (which would answer /api/admin/stats with index.html).
router.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

export default router;
