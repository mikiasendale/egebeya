import { db } from '../src/db';
import { tenants, users, services, staff, staffServices, staffAvailability, pages, tenantBusinessHours, tenantClosures, appointments, plans, tenantSubscriptions } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { normalizePhone } from '../src/lib/phone';

// Canonical plan rows ('free' / 'pro', lowercase).
async function ensurePlan(name: string, price: number, maxStaff: number, customDomainAllowed: boolean) {
  const existing = await db.select().from(plans).where(eq(plans.name, name)).get();
  if (existing) return existing;
  const row = { id: crypto.randomUUID(), name, price, maxStaff, customDomainAllowed };
  await db.insert(plans).values(row);
  return row;
}

async function seed() {
  console.log('Starting seed...');
  
  const userId = crypto.randomUUID();
  const staffId = crypto.randomUUID();
  const serviceId1 = crypto.randomUUID();
  const serviceId2 = crypto.randomUUID();

  const passwordHash = await bcrypt.hash('password123', 10);

  console.log('Creating plans...');
  const freePlan = await ensurePlan('free', 0, 2, false);
  await ensurePlan('pro', 100000, 10, true); // 1000 ETB

  console.log('Creating tenant...');
  const existingLux = await db.select().from(tenants).where(eq(tenants.slug, 'luxnails')).get();
  let tenantId: string;
  if (!existingLux) {
    tenantId = crypto.randomUUID();
    await db.insert(tenants).values({
      id: tenantId,
      name: 'Lux Nails & Spa',
      slug: 'luxnails',
      category: 'Spa',
      settings: { require_payment_upfront: false, calendar_display: 'ethiopian' },
      createdAt: Date.now()
    });
  } else {
    tenantId = existingLux.id;
    await db.update(tenants)
      .set({ isListed: true, category: 'Spa', name: 'Lux Nails & Spa' })
      .where(eq(tenants.id, existingLux.id));
  }

  console.log('Creating subscription...');
  await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId));
  await db.insert(tenantSubscriptions).values({
    id: crypto.randomUUID(),
    tenantId,
    planId: freePlan.id,
    status: 'trial',
    trialEndsAt: Date.now() + 14 * 24 * 3600 * 1000,
    startsAt: Date.now(),
  });

  console.log('Creating owner...');
  const existingOwner = await db.select({ id: users.id }).from(users)
    .where(eq(users.phone, '+251911234567')).get();
  if (!existingOwner) {
    await db.insert(users).values({
      id: userId,
      tenantId: tenantId,
      name: 'Betelhem T.',
      phone: '+251911234567',
      email: 'betty@luxnails.com',
      passwordHash,
      role: 'owner',
      createdAt: Date.now()
    });
  }

  console.log('Creating services...');
  await db.insert(services).values([
    { id: serviceId1, tenantId, name: 'Manicure', durationMinutes: 45, price: 40000 },
    { id: serviceId2, tenantId, name: 'Pedicure', durationMinutes: 60, price: 50000 }
  ]);

  console.log('Creating staff...');
  await db.insert(staff).values({
    id: staffId,
    tenantId,
    name: 'Sara M.',
    title: 'Senior Technician',
    active: true
  });

  console.log('Assigning services to staff...');
  await db.insert(staffServices).values([
    { staffId, serviceId: serviceId1 },
    { staffId, serviceId: serviceId2 }
  ]);

  console.log('Creating business hours...');
  const businessHours = [];
  for (let i = 0; i <= 6; i++) {
    businessHours.push({
      id: crypto.randomUUID(),
      tenantId,
      dayOfWeek: i,
      openTime: i === 0 ? null : '09:00', // Closed on Sunday (0)
      closeTime: i === 0 ? null : '18:00',
      isClosed: i === 0
    });
  }
  await db.insert(tenantBusinessHours).values(businessHours);

  console.log('Creating closures...');
  await db.insert(tenantClosures).values({
    id: crypto.randomUUID(),
    tenantId,
    date: '2026-09-11', // Ethiopian New Year placeholder
    reason: 'Ethiopian New Year'
  });

  console.log('Creating availability...');
  // Mon-Fri 9-5
  const availabilities = [];
  for (let i = 1; i <= 5; i++) {
    availabilities.push({
      id: crypto.randomUUID(),
      staffId,
      dayOfWeek: i,
      startTime: '09:00',
      endTime: '17:00'
    });
  }
  await db.insert(staffAvailability).values(availabilities);

  console.log('Creating page template...');
  // Replace any existing page row so re-seeding doesn't trip the PK.
  await db.delete(pages).where(eq(pages.tenantId, tenantId));
  await db.insert(pages).values({
    tenantId,
    content: {
      content: [
        {
          type: 'Hero',
          props: {
            title: 'Welcome to Lux Nails & Spa',
            subtitle: 'The best nail salon in Addis. Experience true relaxation.',
            backgroundImage: 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80'
          },
          data: {},
        },
        { type: 'About', props: { content: 'We are a premium nail salon and spa dedicated to providing you with the best experience. Our professional staff is here to make you shine.' }, data: {} },
        { type: 'Services', props: {}, data: {} },
        { type: 'BookingForm', props: {}, data: {} },
        { type: 'BusinessHours', props: {}, data: {} },
        { type: 'Contact', props: { phone: '+251911234567', address: 'Bole, Addis Ababa, Ethiopia', mapUrl: '' }, data: {} }
      ],
      root: {}
    }
  });

  console.log('Creating upcoming appointment...');
  const now = Date.now();
  const startTime = now + 2 * 3600 * 1000; // 2 hours from now
  await db.insert(appointments).values({
    id: crypto.randomUUID(),
    tenantId,
    customerName: 'Abebe Bikila',
    customerPhone: '+251911000000',
    customerEmail: 'abebe@example.com',
    staffId,
    serviceId: serviceId1,
    startTime,
    endTime: startTime + 45 * 60000,
    status: 'confirmed',
    reminderSent: false,
    opaqueId: crypto.randomBytes(16).toString('hex'),
  });

  // ====================================================================
  // Second tenant: "testpayment" — used to exercise the Chapa payment path
  // ====================================================================
  console.log('--- Seeding testpayment tenant (Chapa payment flow) ---');

  // The canonical 'free' plan from above.
  const basicPlan = freePlan;

  const tpTenantId = crypto.randomUUID();
  const tpUserId = crypto.randomUUID();
  const tpStaffId = crypto.randomUUID();
  const tpServiceId = crypto.randomUUID();

  // Skip silently if already seeded (idempotent-ish — the slug is unique).
  const existingTp = await db.select().from(tenants).where(eq(tenants.slug, 'testpayment')).get();
  if (!existingTp) {
    await db.insert(tenants).values({
      id: tpTenantId,
      name: 'Test Payment Barbershop',
      slug: 'testpayment',
      category: 'Salon',
      settings: { require_payment_upfront: true, calendar_display: 'gregorian' },
      createdAt: Date.now(),
    });

    await db.insert(tenantSubscriptions).values({
      id: crypto.randomUUID(),
      tenantId: tpTenantId,
      planId: basicPlan.id,
      status: 'trial',
      trialEndsAt: Date.now() + 14 * 24 * 3600 * 1000,
      startsAt: Date.now(),
    });

    await db.insert(users).values({
      id: tpUserId,
      tenantId: tpTenantId,
      name: 'TP Owner',
      // '0900123456' is stored canonically; login accepts any valid format
      // (09…, 251…, 7…) and normalizes to this.
      phone: normalizePhone('0900123456'),
      email: 'owner@testpayment.example',
      passwordHash, // 'password123'
      role: 'owner',
      createdAt: Date.now(),
    });

    await db.insert(services).values({
      id: tpServiceId,
      tenantId: tpTenantId,
      name: 'Haircut',
      durationMinutes: 30,
      price: 20000, // 200 ETB = 20000 cents
    });

    await db.insert(staff).values({
      id: tpStaffId,
      tenantId: tpTenantId,
      name: 'Dawit G.',
      title: 'Barber',
      active: true,
    });

    await db.insert(staffServices).values({ staffId: tpStaffId, serviceId: tpServiceId });

    // Business hours: Mon-Sat 09:00-17:00, closed Sunday
    const tpBh = [];
    for (let i = 0; i <= 6; i++) {
      tpBh.push({
        id: crypto.randomUUID(),
        tenantId: tpTenantId,
        dayOfWeek: i,
        openTime: i === 0 ? null : '09:00',
        closeTime: i === 0 ? null : '17:00',
        isClosed: i === 0,
      });
    }
    await db.insert(tenantBusinessHours).values(tpBh);

    // Staff availability: Mon-Sat 09:00-17:00
    const tpAvail = [];
    for (let i = 1; i <= 6; i++) {
      tpAvail.push({
        id: crypto.randomUUID(),
        staffId: tpStaffId,
        dayOfWeek: i,
        startTime: '09:00',
        endTime: '17:00',
      });
    }
    await db.insert(staffAvailability).values(tpAvail);

    await db.insert(pages).values({
      tenantId: tpTenantId,
      content: {
        content: [
          { type: 'Hero', props: { title: 'Test Payment Barbershop', subtitle: 'Pay online with Telebirr via Chapa.' }, data: {} },
          { type: 'Services', props: {}, data: {} },
          { type: 'BookingForm', props: {}, data: {} },
        ],
        root: {},
      },
    });

    console.log('  testpayment tenant created.');
  } else {
    console.log('  testpayment tenant already exists — skipped.');
  }

  // ====================================================================
  // Extra listed demo tenants — to make /discover look populated.
  // Each row is idempotent: skip if the slug already exists.
  // ====================================================================
  console.log('--- Seeding extra demo tenants for /discover ---');

  const EXTRA_TENANTS: Array<{
    slug: string;
    name: string;
    category: 'Salon' | 'Clinic' | 'Pharmacy' | 'Spa' | 'Other';
  }> = [
    { slug: 'addisdental', name: 'Addis Dental Clinic', category: 'Clinic' },
    { slug: 'bolehair', name: 'Bole Hair Studio', category: 'Salon' },
    { slug: 'piazzapharmacy', name: 'Piazza Pharmacy', category: 'Pharmacy' },
    { slug: 'saritmedspa', name: 'Sarit Med Spa', category: 'Spa' },
    { slug: 'kazungawellness', name: 'Kazunga Wellness', category: 'Other' },
  ];

  for (const t of EXTRA_TENANTS) {
    const existing = await db.select().from(tenants).where(eq(tenants.slug, t.slug)).get();
    if (existing) {
      // Ensure it's listed and has a category so /discover surfaces it.
      await db.update(tenants)
        .set({ isListed: true, category: t.category, name: t.name })
        .where(eq(tenants.id, existing.id));
      continue;
    }
    await db.insert(tenants).values({
      id: crypto.randomUUID(),
      name: t.name,
      slug: t.slug,
      category: t.category,
      isListed: true,
      createdAt: Date.now(),
    });
  }

  console.log('Seed completed successfully!');
  console.log(`Test account: +251911234567 (slug: luxnails, no payment) — password is set in server/seed.ts`);
  console.log(`Test account: 0900123456 → ${normalizePhone('0900123456')} (slug: testpayment, requires Chapa payment upfront) — password is set in server/seed.ts`);
  console.log(`Test site: http://luxnails.egebeya.et (Add to your hosts file mapped to localhost for testing)`);
}

seed().catch(console.error);
