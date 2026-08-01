import { Router } from 'express';
import { db } from '../db';
import bcrypt from 'bcryptjs';
import {
  pages,
  tenantSubscriptions,
  plans,
  tenants,
  staff,
  services as servicesTable,
  staffServices,
  staffAvailability,
  tenantBusinessHours,
  media,
  users,
  passwordResets,
} from '../db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import crypto from 'crypto';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { requirePlanLimit, requireActiveSubscription } from '../../server/middleware/planLimits';
import { requireAuth } from './middleware/auth';
import { csrfProtection } from './middleware/csrf';
import { tenantWriteLimiter, uploadLimiter } from '../../server/middleware/rateLimiter';
import { normalizePhone } from '../lib/phone';

const router = Router();

const uploadDir = path.join(process.cwd(), 'dist', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const tenantDir = (tenantId: string) => {
  const dir = path.join(uploadDir, tenantId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images are allowed'));
  }
});

// Owner-only auth gate (cookie or Bearer) with tokenVersion revocation, then
// CSRF protection for cookie-authenticated mutations, then write throttling.
router.use(requireAuth({ roles: ['owner'] }));
router.use(csrfProtection);
router.use(tenantWriteLimiter);



router.post('/staff', requirePlanLimit('staff'), async (req, res) => {
  const { tenantId } = (req as any).user;
  const { name, title, bio, imagePath, userId } = req.body;

  if (!name || String(name).trim().length === 0) {
    return res.status(400).json({ error: 'Staff name is required' });
  }

  const staffId = crypto.randomUUID();
  await db.insert(staff).values({
    id: staffId,
    tenantId,
    userId: userId ?? null,
    name: String(name).trim(),
    title: title ?? null,
    bio: bio ?? null,
    imagePath: imagePath ?? null,
    active: true,
  });
  const created = await db.select().from(staff).where(eq(staff.id, staffId)).get();
  res.status(201).json(created);
});

// ---- Staff CRUD ----

// POST /staff/invite — create a staff login for a staff member. The owner
// supplies the staff's name + phone; the backend creates the `users` row with
// a random password and returns a one-time password-reset link to share.
router.post('/staff/invite', requirePlanLimit('staff'), async (req, res) => {
  const { tenantId } = (req as any).user;
  const { name, phone, email, staff_id } = req.body || {};

  if (!name || String(name).trim().length === 0) {
    return res.status(400).json({ error: 'Staff name is required' });
  }
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ error: 'Enter a valid Ethiopian phone number (+251XXXXXXXXX)' });
  }
  if (email !== undefined && email !== null && email !== '') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
  }

  try {
    const existingUser = await db.select().from(users).where(eq(users.phone, normalizedPhone)).get();
    if (existingUser) {
      return res.status(409).json({ error: 'A user with this phone number already exists' });
    }

    let staffRow: any = null;
    if (staff_id) {
      staffRow = await db.select().from(staff)
        .where(and(eq(staff.id, staff_id), eq(staff.tenantId, tenantId))).get();
      if (!staffRow) return res.status(404).json({ error: 'Staff not found for this tenant' });
    }

    const tempPassword = crypto.randomBytes(18).toString('base64url');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      tenantId,
      name: String(name).trim(),
      phone: normalizedPhone,
      email: email ? String(email).trim().toLowerCase() : null,
      passwordHash,
      role: 'staff',
      createdAt: Date.now(),
    });

    if (staffRow) {
      await db.update(staff).set({ userId }).where(eq(staff.id, staffRow.id));
    } else {
      const newStaffId = crypto.randomUUID();
      await db.insert(staff).values({
        id: newStaffId,
        tenantId,
        userId,
        name: String(name).trim(),
        title: null,
        bio: null,
        imagePath: null,
        active: true,
      });
    }

    const resetToken = crypto.randomUUID();
    await db.insert(passwordResets).values({
      id: crypto.randomUUID(),
      token: resetToken,
      userId,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    res.status(201).json({
      success: true,
      userId,
      staffId: staffRow?.id ?? null,
      resetUrl,
    });
  } catch (error) {
    console.error('Invite staff error:', error);
    res.status(500).json({ error: 'Failed to invite staff' });
  }
});

router.put('/staff/:id', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { id } = req.params;
  const { name, title, bio, imagePath, active } = req.body;

  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ error: 'name cannot be empty' });
  }

  try {
    const owned = await db.select({ id: staff.id }).from(staff)
      .where(and(eq(staff.id, id), eq(staff.tenantId, tenantId))).get();
    if (!owned) return res.status(404).json({ error: 'Staff not found for this tenant' });

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (title !== undefined) updates.title = title ?? null;
    if (bio !== undefined) updates.bio = bio ?? null;
    if (imagePath !== undefined) updates.imagePath = imagePath ?? null;
    if (active !== undefined) updates.active = !!active;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields provided to update' });
    }

    await db.update(staff).set(updates).where(eq(staff.id, id));
    const updated = await db.select().from(staff).where(eq(staff.id, id)).get();
    res.json(updated);
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({ error: 'Failed to update staff' });
  }
});

router.delete('/staff/:id', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { id } = req.params;
  try {
    const owned = await db.select({ id: staff.id }).from(staff)
      .where(and(eq(staff.id, id), eq(staff.tenantId, tenantId))).get();
    if (!owned) return res.status(404).json({ error: 'Staff not found for this tenant' });

    // Clean up links + availability before removing the staff row.
    await db.delete(staffServices).where(eq(staffServices.staffId, id));
    await db.delete(staffAvailability).where(eq(staffAvailability.staffId, id));
    await db.delete(staff).where(eq(staff.id, id));
    res.json({ success: true, id });
  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({ error: 'Failed to delete staff' });
  }
});

router.get('/staff/:id/services', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { id } = req.params;
  try {
    const owned = await db.select({ id: staff.id }).from(staff)
      .where(and(eq(staff.id, id), eq(staff.tenantId, tenantId))).get();
    if (!owned) return res.status(404).json({ error: 'Staff not found for this tenant' });

    const links = await db.select().from(staffServices).where(eq(staffServices.staffId, id)).all();
    const serviceIds = links.map(l => l.serviceId);
    const rows = serviceIds.length
      ? await db.select().from(servicesTable)
          .where(and(eq(servicesTable.tenantId, tenantId), inArray(servicesTable.id, serviceIds))).all()
      : [];
    res.json(rows.map(s => ({ id: s.id, name: s.name })));
  } catch (error) {
    console.error('Fetch staff services error:', error);
    res.status(500).json({ error: 'Failed to fetch staff services' });
  }
});

router.get('/staff/:id/availability', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { id } = req.params;
  try {
    const owned = await db.select({ id: staff.id }).from(staff)
      .where(and(eq(staff.id, id), eq(staff.tenantId, tenantId))).get();
    if (!owned) return res.status(404).json({ error: 'Staff not found for this tenant' });

    const rows = await db.select().from(staffAvailability)
      .where(eq(staffAvailability.staffId, id)).all();
    res.json(rows.map(r => ({
      id: r.id,
      staffId: r.staffId,
      dayOfWeek: r.dayOfWeek,
      startTime: r.startTime,
      endTime: r.endTime,
    })));
  } catch (error) {
    console.error('Fetch staff availability error:', error);
    res.status(500).json({ error: 'Failed to fetch staff availability' });
  }
});
router.put('/business-hours', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { hours } = req.body as {
    hours: { dayOfWeek: number; openTime: string | null; closeTime: string | null; isClosed: boolean }[];
  };

  if (!Array.isArray(hours) || hours.length === 0) {
    return res.status(400).json({ error: 'hours must be a non-empty array' });
  }

  try {
    await db.delete(tenantBusinessHours).where(eq(tenantBusinessHours.tenantId, tenantId));
    await db.insert(tenantBusinessHours).values(
      hours.map((h) => ({
        id: crypto.randomUUID(),
        tenantId,
        dayOfWeek: h.dayOfWeek,
        openTime: h.isClosed ? null : (h.openTime ?? null),
        closeTime: h.isClosed ? null : (h.closeTime ?? null),
        isClosed: h.isClosed,
      }))
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Business hours error:', error);
    res.status(500).json({ error: 'Failed to save business hours' });
  }
});

router.post('/staff/:id/services', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { id } = req.params;
  const { service_ids } = req.body as { service_ids: string[] };
  if (!Array.isArray(service_ids)) {
    return res.status(400).json({ error: 'service_ids must be an array' });
  }
  try {
    // Ensure the staff belongs to this tenant.
    const staffRow = await db.select({ id: staff.id }).from(staff)
      .where(and(eq(staff.id, id), eq(staff.tenantId, tenantId))).get();
    if (!staffRow) return res.status(404).json({ error: 'Staff not found for this tenant' });

    // Validate that each provided id belongs to this tenant (skip the query
    // when there is nothing to validate — inArray requires a non-empty array).
    const owned = service_ids.length
      ? await db.select({ id: servicesTable.id }).from(servicesTable)
          .where(and(eq(servicesTable.tenantId, tenantId), inArray(servicesTable.id, service_ids))).all()
      : [];
    const ownedIds = new Set(owned.map(s => s.id));
    const validIds = service_ids.filter(sid => ownedIds.has(sid));

    // Replace: remove existing links, then insert the new set.
    await db.delete(staffServices).where(eq(staffServices.staffId, id));
    if (validIds.length > 0) {
      await db.insert(staffServices).values(validIds.map(serviceId => ({ staffId: id, serviceId })));
    }
    res.json({ success: true, assigned: validIds });
  } catch (error) {
    console.error('Assign services error:', error);
    res.status(500).json({ error: 'Failed to assign services' });
  }
});

router.put('/staff/:id/availability', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { id } = req.params;
  const { availability } = req.body as {
    availability: { dayOfWeek: number; startTime: string; endTime: string }[]
  };
  if (!Array.isArray(availability)) {
    return res.status(400).json({ error: 'availability must be an array' });
  }
  try {
    const owned = await db.select({ id: staff.id }).from(staff)
      .where(and(eq(staff.id, id), eq(staff.tenantId, tenantId))).get();
    if (!owned) return res.status(404).json({ error: 'Staff not found for this tenant' });

    await db.delete(staffAvailability).where(eq(staffAvailability.staffId, id));
    if (availability.length > 0) {
      await db.insert(staffAvailability).values(
        availability.map(a => ({
          id: crypto.randomUUID(),
          staffId: id,
          dayOfWeek: a.dayOfWeek,
          startTime: a.startTime,
          endTime: a.endTime,
        }))
      );
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Staff availability error:', error);
    res.status(500).json({ error: 'Failed to set availability' });
  }
});

router.put('/domain', requireActiveSubscription, async (req, res) => {
  const plan = (req as any).plan;
  if (!plan.customDomainAllowed) {
    return res.status(403).json({ error: 'Custom domains require the Pro plan' });
  }
  
  // stub for setting domain
  res.json({ success: true });
});

router.get('/subscription', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const subscription = await db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    if (!subscription) return res.status(404).json({ error: 'Subscription not found' });
    const plan = await db.select().from(plans).where(eq(plans.id, subscription.planId!)).get();
    const staffList = await db.select().from(staff).where(eq(staff.tenantId, tenantId)).all();
    
    res.json({
      subscription,
      plan,
      staffUsage: staffList.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

router.get('/settings', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    // Spread column-level fields alongside the JSON settings blob so the
    // dashboard can show subdomain / business name without a second fetch.
    res.json({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      ...(tenant.settings as any || {}),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/settings', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // `name` (and only name at the top level) maps to the tenants column.
    // `slug` is intentionally NOT writable here — changing it has cascading
    // effects on public links, bookings, and DNS that are out of scope.
    const { name, slug: _ignoredSlug, ...rest } = req.body || {};
    const trimmedName = typeof name === 'string' && name.trim().length > 0
      ? name.trim()
      : undefined;

    const newSettings = { ...(tenant.settings as any || {}), ...rest };

    const updates: Record<string, any> = { settings: newSettings };
    if (trimmedName !== undefined) updates.name = trimmedName;

    await db.update(tenants).set(updates).where(eq(tenants.id, tenantId));

    res.json({
      success: true,
      settings: {
        id: tenant.id,
        name: trimmedName ?? tenant.name,
        slug: tenant.slug,
        ...newSettings,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

router.get('/page', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const page = await db.select().from(pages).where(eq(pages.tenantId, tenantId)).get();
    res.json(page || {});
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch page' });
  }
});

router.put('/page', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { content } = req.body;
  try {
    const existing = await db.select().from(pages).where(eq(pages.tenantId, tenantId)).get();
    if (existing) {
      await db.update(pages).set({ content }).where(eq(pages.tenantId, tenantId));
    } else {
      await db.insert(pages).values({
        tenantId,
        content,
      });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update page' });
  }
});

// Auto-generate a simple default Puck page for the tenant (used by the
// onboarding wizard "preview" step). Returns the created/updated content.
router.post('/page', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    const tenantServices = await db.select().from(servicesTable)
      .where(eq(servicesTable.tenantId, tenantId)).all();
    const staffList = await db.select().from(staff)
      .where(eq(staff.tenantId, tenantId)).all();

    const defaultContent = {
      content: [
        {
          type: 'Hero',
          props: {
            title: tenant?.name || 'Welcome',
            subtitle: 'Book your next appointment online — fast and simple.',
          },
          data: {},
        },
        { type: 'About', props: { content: `Book an appointment with ${tenant?.name || 'us'} online.` }, data: {} },
        { type: 'Services', props: {}, data: {} },
        { type: 'BookingForm', props: {}, data: {} },
        { type: 'Contact', props: {}, data: {} },
      ],
      root: {},
    };
    void tenantServices; void staffList; // available for richer templates later

    const existing = await db.select().from(pages).where(eq(pages.tenantId, tenantId)).get();
    if (existing) {
      await db.update(pages).set({ content: defaultContent }).where(eq(pages.tenantId, tenantId));
    } else {
      await db.insert(pages).values({ tenantId, content: defaultContent });
    }
    res.status(201).json({ success: true, content: defaultContent });
  } catch (error) {
    console.error('Default page error:', error);
    res.status(500).json({ error: 'Failed to generate default page' });
  }
});

router.post('/upload', uploadLimiter, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { tenantId } = (req as any).user;
  if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const dir = tenantDir(tenantId);
    const filename = `${crypto.randomUUID()}.jpg`;
    const filepath = path.join(dir, filename);

    await sharp(req.file.buffer)
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(filepath);

    const publicPath = `/uploads/${tenantId}/${filename}`;
    const id = crypto.randomUUID();
    await db.insert(media).values({
      id,
      tenantId,
      path: publicPath,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      createdAt: Date.now(),
    });

    res.json({
      id,
      path: publicPath,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

router.get('/media', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const list = await db.select().from(media)
      .where(eq(media.tenantId, tenantId))
      .orderBy(desc(media.createdAt))
      .all();
    res.json(list);
  } catch (error) {
    console.error('List media error:', error);
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

router.delete('/media/:id', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { id } = req.params;
  try {
    const row = await db.select().from(media)
      .where(and(eq(media.id, id), eq(media.tenantId, tenantId)))
      .get();
    if (!row) return res.status(404).json({ error: 'Media not found for this tenant' });

    // Remove the file from disk if it's under our managed uploads dir.
    try {
      const relative = row.path.replace(/^\/uploads\//, '');
      const safeRelative = path.normalize(relative);
      if (!safeRelative.startsWith('..')) {
        const absolute = path.join(uploadDir, safeRelative);
        if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
      }
    } catch (fsErr) {
      console.warn('Failed to unlink media file:', fsErr);
    }

    await db.delete(media).where(eq(media.id, id));
    res.json({ success: true, id });
  } catch (error) {
    console.error('Delete media error:', error);
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

router.get('/staff', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const list = await db.select().from(staff).where(eq(staff.tenantId, tenantId)).all();
    // Attach each staff member's assigned services (id + name) so the
    // dashboard can render a comma-separated list and pre-populate the
    // "Manage services" dialog without an extra round-trip.
    const allLinks = list.length
      ? await db.select().from(staffServices)
          .where(inArray(staffServices.staffId, list.map(s => s.id))).all()
      : [];
    const svcIds = Array.from(new Set(allLinks.map(l => l.serviceId)));
    const svcRows = svcIds.length
      ? await db.select().from(servicesTable)
          .where(and(eq(servicesTable.tenantId, tenantId), inArray(servicesTable.id, svcIds))).all()
      : [];
    const svcById = new Map(svcRows.map(s => [s.id, s]));
    const linksByStaff = new Map<string, { id: string; name: string }[]>();
    for (const l of allLinks) {
      const svc = svcById.get(l.serviceId);
      if (!svc) continue;
      const arr = linksByStaff.get(l.staffId) || [];
      arr.push({ id: svc.id, name: svc.name });
      linksByStaff.set(l.staffId, arr);
    }
    const withServices = list.map(s => ({
      ...s,
      services: linksByStaff.get(s.id) || [],
    }));
    res.json(withServices);
  } catch (error) {
    console.error('Fetch staff error:', error);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// ---- Services management (owner) ----

router.get('/services', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const list = await db.select().from(servicesTable)
      .where(eq(servicesTable.tenantId, tenantId))
      .all();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

router.post('/services', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { name, durationMinutes, price, imagePath } = req.body;

  if (!name || !durationMinutes || price === undefined || price === null) {
    return res.status(400).json({ error: 'name, durationMinutes and price are required' });
  }
  if (typeof durationMinutes !== 'number' || durationMinutes <= 0) {
    return res.status(400).json({ error: 'durationMinutes must be a positive number' });
  }
  if (typeof price !== 'number' || price < 0) {
    return res.status(400).json({ error: 'price must be a non-negative number (ETB cents)' });
  }

  try {
    const id = crypto.randomUUID();
    await db.insert(servicesTable).values({
      id,
      tenantId,
      name: String(name).trim(),
      durationMinutes,
      price,
      imagePath: imagePath ?? null,
      active: true,
    });
    const created = await db.select().from(servicesTable).where(eq(servicesTable.id, id)).get();
    res.status(201).json(created);
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

router.put('/services/:id', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { id } = req.params;
  const { name, durationMinutes, price, imagePath, active } = req.body;

  // Validate inputs when provided
  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ error: 'name cannot be empty' });
  }
  if (durationMinutes !== undefined && (typeof durationMinutes !== 'number' || durationMinutes <= 0)) {
    return res.status(400).json({ error: 'durationMinutes must be a positive number' });
  }
  if (price !== undefined && (typeof price !== 'number' || price < 0)) {
    return res.status(400).json({ error: 'price must be a non-negative number (ETB cents)' });
  }

  try {
    // Ensure the service belongs to this tenant
    const existing = await db.select().from(servicesTable)
      .where(and(eq(servicesTable.id, id), eq(servicesTable.tenantId, tenantId))).get();
    if (!existing) {
      return res.status(404).json({ error: 'Service not found for this tenant' });
    }

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (durationMinutes !== undefined) updates.durationMinutes = durationMinutes;
    if (price !== undefined) updates.price = price;
    if (imagePath !== undefined) updates.imagePath = imagePath;
    if (active !== undefined) updates.active = !!active;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields provided to update' });
    }

    await db.update(servicesTable).set(updates).where(eq(servicesTable.id, id));
    const updated = await db.select().from(servicesTable).where(eq(servicesTable.id, id)).get();
    res.json(updated);
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

router.delete('/services/:id', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { id } = req.params;
  try {
    const existing = await db.select().from(servicesTable)
      .where(and(eq(servicesTable.id, id), eq(servicesTable.tenantId, tenantId))).get();
    if (!existing) {
      return res.status(404).json({ error: 'Service not found for this tenant' });
    }

    // Remove any staff-service links before deleting the service
    await db.delete(staffServices).where(eq(staffServices.serviceId, id));
    await db.delete(servicesTable).where(eq(servicesTable.id, id));
    res.json({ success: true, id });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

export default router;
