import { Router } from 'express';
import { db } from '../db';
import {
  tenants,
  services as servicesTable,
  staff as staffTable,
  pages,
} from '../db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from './middleware/auth';
import { csrfProtection } from './middleware/csrf';
import { tenantWriteLimiter } from '../../server/middleware/rateLimiter';

const router = Router();

// Owner-only auth + CSRF for cookie-authenticated mutations, then write
// throttling — identical guards to the rest of the /api/tenant/* surface.
router.use(requireAuth({ roles: ['owner'] }));
router.use(csrfProtection);
router.use(tenantWriteLimiter);

export interface PuckBlock {
  type: string;
  props: Record<string, unknown>;
  data: Record<string, unknown>;
}

export interface PuckDocument {
  content: PuckBlock[];
  root: Record<string, unknown>;
}

/**
 * WP1.4 — the single-screen free-tier block set.
 *
 * This is the ONLY block set the structured generator ever emits for a Free
 * tenant. A free site is exactly one screen: Hero, About, Services,
 * BookingForm, Contact (plus an optional SocialLinks row when the owner has
 * configured social handles). Multi-page / blog / About-page blocks are never
 * produced here — the generator constrains the block set itself rather than
 * relying on a consumer-side gate.
 */
export const FREE_TIER_BLOCK_SET = [
  'Hero',
  'About',
  'Services',
  'BookingForm',
  'Contact',
] as const;

// Per-category copy so the generated site feels tailored to the vertical
// without ever invoking an LLM. Fallback to 'other' for unknown categories.
const CATEGORY_COPY: Record<string, { subtitle: string; about: string }> = {
  salon: {
    subtitle: 'Book your chair online — fast and simple.',
    about: 'We are a salon and beauty studio ready to take care of you.',
  },
  clinic: {
    subtitle: 'Book a consultation online — fast and simple.',
    about: 'We are a clinic offering care by appointment, your way.',
  },
  pharmacy: {
    subtitle: 'Book your visit online — fast and simple.',
    about: 'We are a pharmacy ready to serve you by appointment.',
  },
  other: {
    subtitle: 'Book your next appointment online — fast and simple.',
    about: 'We are glad you found us. Book an appointment with us online.',
  },
};

const SOCIAL_SETTINGS_KEYS = ['social_telegram', 'social_facebook', 'social_instagram', 'social_tiktok'] as const;

// Deterministic template populated from real tenant rows:
//  - tenant.name          →  Hero title
//  - staff count          →  About copy
//  - settings.city        →  Contact address
//  - settings.social_*    →  SocialLinks row (only when at least one is set)
//  - services rows        →  Services block (renders from the public API)
export function buildFreeSite(
  tenant: any,
  services: any[],
  staffCount: number,
): PuckDocument {
  const settings = (tenant?.settings as any) || {};
  const category: string = typeof tenant?.category === 'string' ? tenant.category : '';
  const copy = CATEGORY_COPY[category] || CATEGORY_COPY.other;
  const businessName = typeof tenant?.name === 'string' && tenant.name.trim()
    ? tenant.name.trim()
    : 'Welcome';

  const blocks: PuckBlock[] = [
    {
      type: 'Hero',
      props: {
        title: businessName,
        subtitle: copy.subtitle,
        backgroundImage: '',
      },
      data: {},
    },
    {
      type: 'About',
      props: {
        content: `Welcome to ${businessName}. ${copy.about}${staffCount > 0 ? ` Our team of ${staffCount} ready to help.` : ''}`,
      },
      data: {},
    },
    { type: 'Services', props: {}, data: {} },
    { type: 'BookingForm', props: {}, data: {} },
    {
      type: 'Contact',
      props: {
        phone: typeof settings.phone === 'string' ? settings.phone : '',
        address: typeof settings.city === 'string' ? settings.city : '',
        mapUrl: '',
      },
      data: {},
    },
  ];

  const hasSocial = SOCIAL_SETTINGS_KEYS.some((k) =>
    typeof settings[k] === 'string' && settings[k].trim() !== '',
  );
  if (hasSocial) {
    blocks.push({ type: 'SocialLinks', props: {}, data: {} });
  }

  void services; // Services block renders from /api/public/services; kept for parity.
  return { content: blocks, root: {} };
}

/**
 * WP1.2 — owner share surface. Returns the tenant's public URL plus a
 * ready-to-paste Telegram share link. Production serves the tenant's
 * subdomain; dev renders localhost so it is actually navigable in a browser.
 */
export function shareLinkFor(tenant: any): { url: string; telegramShare: string } {
  const slug = tenant?.slug;
  const isProd = process.env.NODE_ENV === 'production';
  const url = isProd
    ? `https://${slug}.egebeya.et`
    : `http://localhost:3000/${slug}`;
  const businessName = typeof tenant?.name === 'string' && tenant.name.trim()
    ? tenant.name.trim()
    : 'Egebeya';
  const text = `${businessName} · Book online`;
  const telegramShare = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  return { url, telegramShare };
}

// POST /api/tenant/generate-site — create-or-replace the tenant's Puck
// document from real rows, no LLM call. Idempotent: given unchanged data it
// produces the identical document on every call.
router.post('/generate-site', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const tenantServices = await db.select()
      .from(servicesTable)
      .where(eq(servicesTable.tenantId, tenantId))
      .all();
    const staffList = await db.select()
      .from(staffTable)
      .where(eq(staffTable.tenantId, tenantId))
      .all();

    const content = buildFreeSite(tenant, tenantServices, staffList.length);

    const existing = await db.select({ tenantId: pages.tenantId })
      .from(pages)
      .where(eq(pages.tenantId, tenantId))
      .get();
    if (existing) {
      await db.update(pages).set({ content }).where(eq(pages.tenantId, tenantId));
    } else {
      await db.insert(pages).values({ tenantId, content });
    }

    res.json({
      success: true,
      content,
      share: shareLinkFor(tenant),
    });
  } catch (error) {
    console.error('Generate site error:', error);
    res.status(500).json({ error: 'Failed to generate site' });
  }
});

// GET /api/tenant/share-link — the convenience the Dashboard renders after a
// first successful generate. Owner-only (guarded by the router middleware).
router.get('/share-link', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json(shareLinkFor(tenant));
  } catch (error) {
    console.error('Share link error:', error);
    res.status(500).json({ error: 'Failed to generate share link' });
  }
});

export default router;