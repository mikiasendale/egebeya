import { Router } from 'express';
import authRoutes from './auth';
import tenantRoutes from './tenant';
import bookingsRoutes from './bookings';
import publicRoutes from './public';
import paymentRoutes from './payments';
import testRoutes from './test';
import proSiteRoutes from './pro-site';

const router = Router();

router.use('/auth', authRoutes);
router.use('/tenant', tenantRoutes);
router.use('/tenant', proSiteRoutes);
router.use('/bookings', bookingsRoutes);
router.use('/public', publicRoutes);
router.use('/payments', paymentRoutes);
router.use('/test', testRoutes);

export default router;
