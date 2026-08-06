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
import intentRoutes from './intent';
import apiKeysRoutes from './api-keys';
import v1Routes from './v1';
import { apiKeyLimiter } from '../../server/middleware/rateLimiter';
import { dbHealthMiddleware } from '../db/health';

const router = Router();

// Database-resilience guard — mounted FIRST so an unreachable DB degrades
// the entire API to a clean 503 instead of leaking per-route stack traces.
router.use(dbHealthMiddleware);

router.use('/auth', authRoutes);
router.use('/tenant', tenantRoutes);
router.use('/tenant', proSiteRoutes);
router.use('/tenant', siteSettingsRoutes);
router.use('/tenant', siteGeneratorRoutes);
router.use('/tenant', aiChatRoutes);
router.use('/tenant', crmRoutes);
router.use('/public', intentRoutes);
router.use('/tenant', intentRoutes);
router.use('/tenant/api-keys', apiKeysRoutes);
router.use('/tenant/bookings', walkInRouter);
router.use('/bookings', bookingsRoutes);
router.use('/public', publicRoutes);
router.use('/v1', apiKeyLimiter, v1Routes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
router.use('/health', healthRoutes);

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
