/**
 * P2.2 — category template packs: every pack validates against the P2.1
 * block contract, copy is locked by snapshot assertions, and no stock-photo
 * imagery ships in any template (illustration/empty placeholders only).
 */
import { describe, it, expect } from 'vitest';
import {
  buildTemplatePage, templateForCategory, TEMPLATE_CATEGORIES, TEMPLATE_BUSINESS_HOURS,
} from '../../server/lib/siteTemplates';

describe('category template packs (P2.2)', () => {
  it.each(TEMPLATE_CATEGORIES)('pack "%s" produces a valid block doc with plausible Amharic defaults', (category) => {
    const doc = buildTemplatePage('ብርሃን ሳሎን', category);

    expect(doc.version).toBe(1);
    const types = doc.content.map((b) => b.type);
    expect(types[0]).toBe('hero');
    for (const required of ['about', 'services', 'hours', 'booking-form', 'contact']) {
      expect(types).toContain(required);
    }

    // Guaranteed-plausible Amharic default copy — hero subtitle and about body.
    const hero = doc.content[0];
    expect(hero.props.subtitle).toMatch(/[\u1200-\u137F]/); // Ethiopic block
    const about = doc.content.find((b) => b.type === 'about')!;
    expect(about.props.content).toMatch(/[\u1200-\u137F]/);
    // Business name flows into the hero title + tagline.
    expect(hero.props.title).toBe('ብርሃን ሳሎን');
    expect(hero.props.subtitle).toContain('ብርሃን ሳሎን');

    // Every pack carries a deposit-policy block (booking deposits are core).
    const policy = doc.content.find((b) => b.type === 'deposit-policy')!;
    expect(policy.props.required).toBe(true);
    expect(policy.props.note).toMatch(/[\u1200-\u137F]/);
  });

  it('snapshot-locks the copy of each pack', () => {
    expect(templateForCategory('Salon').heroTagline('X')).toBe('X — ውበትና እንክብካቤ ቦታዎ');
    expect(templateForCategory('Clinic').heroTagline('X')).toBe('X — ጤናዎ ቅድሚያችን');
    expect(templateForCategory('Pharmacy').heroTagline('X')).toBe('X — መድኃኒትዎ በጊዜው ይደርስዎት');
    expect(templateForCategory('Other').heroTagline('X')).toBe('X — እንኳን ደህና መጡ');
  });

  it('no stock-photo people or external imagery anywhere in the packs', () => {
    for (const category of TEMPLATE_CATEGORIES) {
      const doc = buildTemplatePage('Any Business', category);
      const serialized = JSON.stringify(doc);
      expect(serialized).not.toMatch(/unsplash|pexels|shutterstock|gettyimages/i);
      expect(serialized).not.toMatch(/https?:\/\//); // zero external URLs at all
    }
  });

  it('default services are per-category and priced in ETB cents; unknown categories fall back to Other', () => {
    expect(templateForCategory('Salon').defaultServices.length).toBeGreaterThanOrEqual(3);
    expect(templateForCategory('Clinic').defaultServices.length).toBeGreaterThanOrEqual(2);
    for (const category of TEMPLATE_CATEGORIES) {
      for (const svc of templateForCategory(category).defaultServices) {
        expect(svc.durationMinutes).toBeGreaterThan(0);
        expect(svc.price).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(svc.price)).toBe(true);
      }
    }
    expect(templateForCategory('Nonexistent').category).toBe('Other');
    expect(templateForCategory(null).category).toBe('Other');
  });

  it('default business hours = Mon–Sat 09:00–18:00, Sunday closed', () => {
    expect(TEMPLATE_BUSINESS_HOURS.length).toBe(7);
    const sunday = TEMPLATE_BUSINESS_HOURS.find((h) => h.dayOfWeek === 0)!;
    expect(sunday.isClosed).toBe(true);
    for (const h of TEMPLATE_BUSINESS_HOURS.filter((x) => x.dayOfWeek !== 0)) {
      expect(h.openTime).toBe('09:00');
      expect(h.closeTime).toBe('18:00');
      expect(h.isClosed).toBe(false);
    }
  });
});
