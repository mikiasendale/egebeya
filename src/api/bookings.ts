import { Router } from 'express';
import { db } from '../db';
import { appointments, services, staff } from '../db/schema';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

// Middleware to authenticate and get tenantId
router.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    (req as any).user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

router.get('/', async (req, res) => {
  const { tenantId, role, userId } = (req as any).user;
  const { date, staff_id } = req.query;

  try {
    let filters = [eq(appointments.tenantId, tenantId)];
    
    // If staff, only show their own bookings
    if (role === 'staff') {
      const staffMember = await db.select().from(staff).where(eq(staff.userId, userId)).get();
      if (staffMember) {
         filters.push(eq(appointments.staffId, staffMember.id));
      }
    } else if (staff_id) {
      filters.push(eq(appointments.staffId, staff_id as string));
    }

    if (date) {
      const startOfDay = new Date(`${date}T00:00:00.000Z`).getTime();
      const endOfDay = new Date(`${date}T23:59:59.999Z`).getTime();
      filters.push(gte(appointments.startTime, startOfDay));
      filters.push(lte(appointments.startTime, endOfDay));
    }

    const results = await db.select({
      id: appointments.id,
      customerName: appointments.customerName,
      customerPhone: appointments.customerPhone,
      customerEmail: appointments.customerEmail,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
      staffName: staff.name,
      serviceName: services.name,
      servicePrice: services.price
    })
    .from(appointments)
    .leftJoin(staff, eq(appointments.staffId, staff.id))
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .where(and(...filters))
    .orderBy(desc(appointments.startTime))
    .all();

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

router.put('/:id/status', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { id } = req.params;
  const { status } = req.body;

  try {
    const appointment = await db.select().from(appointments).where(and(eq(appointments.id, id), eq(appointments.tenantId, tenantId))).get();
    
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    await db.update(appointments).set({ status }).where(eq(appointments.id, id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.get('/:id', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { id } = req.params;

  try {
    const result = await db.select({
      id: appointments.id,
      customerName: appointments.customerName,
      customerPhone: appointments.customerPhone,
      customerEmail: appointments.customerEmail,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
      staffName: staff.name,
      serviceName: services.name,
      servicePrice: services.price
    })
    .from(appointments)
    .leftJoin(staff, eq(appointments.staffId, staff.id))
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .where(and(eq(appointments.id, id), eq(appointments.tenantId, tenantId)))
    .get();

    if (!result) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

export default router;
