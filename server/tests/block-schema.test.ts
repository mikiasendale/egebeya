/**
 * P2.1 — block schema contract.
 *
 *   1. Round-trip: existing seeded Puck pages (luxnails fixture shape, with
 *      PascalCase types and no version key) validate and normalise to the
 *      canonical vocabulary.
 *   2. Invalid docs are rejected WITH field-level errors.
 *   3. Version bump path: an unknown version is rejected with a clear issue
 *      (migration skeleton exists in migrateBlockDoc).
 */
import { describe, it, expect } from 'vitest';
import {
  validateBlockDoc, migrateBlockDoc, BLOCK_SCHEMA_VERSION, CANONICAL_TYPES,
} from '../../src/lib/blocks/schema';

/** Mirrors server/seed.ts luxnails pages.content exactly (legacy PascalCase). */
const luxnailsFixture = {
  content: [
    {
      type: 'Hero',
      props: {
        title: 'Welcome to Lux Nails & Spa',
        subtitle: 'The best nail salon in Addis. Experience true relaxation.',
        backgroundImage: 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80',
      },
      data: {},
    },
    { type: 'About', props: { content: 'We are a premium nail salon…' }, data: {} },
    { type: 'Services', props: {}, data: {} },
    { type: 'BookingForm', props: {}, data: {} },
    { type: 'BusinessHours', props: {}, data: {} },
    { type: 'Contact', props: { phone: '+251911234567', address: 'Bole, Addis Ababa, Ethiopia', mapUrl: '' }, data: {} },
  ],
  root: {},
};

describe('block schema contract (P2.1)', () => {
  it('validates the legacy luxnails fixture and migrates it to canonical types', () => {
    const result = validateBlockDoc(luxnailsFixture);
    expect(result.ok).toBe(true);
    expect(result.doc).toBeTruthy();

    // Version defaulted; PascalCase migrated to canonical vocabulary.
    expect(result.doc!.version).toBe(BLOCK_SCHEMA_VERSION);
    expect(result.doc!.content.map((b) => b.type)).toEqual([
      'hero', 'about', 'services', 'booking-form', 'hours', 'contact',
    ]);

    // Props preserved through migration.
    expect(result.doc!.content[0].props.title).toBe('Welcome to Lux Nails & Spa');
    expect(result.doc!.content[5].props.phone).toBe('+251911234567');

    // Every emitted type sits in the canonical set.
    for (const block of result.doc!.content) {
      expect(CANONICAL_TYPES).toContain(block.type);
    }
  });

  it('accepts every canonical type incl. new deposit-policy and custom-html blocks', () => {
    const doc = {
      version: BLOCK_SCHEMA_VERSION,
      root: {},
      content: CANONICAL_TYPES.map((type) => ({ type, props: {}, data: {} })),
    };
    const result = validateBlockDoc(doc);
    // All canonical types must pass validation with empty default props —
    // except custom-html/deposit-policy which have typed optional fields that
    // all carry defaults.
    if (!result.ok) {
      throw new Error('expected ok, got issues: ' + JSON.stringify(result.issues));
    }
    expect(result.ok).toBe(true);
  });

  it('rejects invalid docs with field-level errors', () => {
    const bad = {
      version: BLOCK_SCHEMA_VERSION,
      root: {},
      content: [
        { type: 'hero', props: { title: 'ok' }, data: {} },
        { type: 'page-counter', props: {}, data: {} },                 // unknown type
        { type: 'gallery', props: { images: [{ url: 'javascript:alert(1)' }] }, data: {} }, // unsafe URL
        { type: 'contact' },                                            // missing props → defaults fill, still valid
      ],
    };
    const result = validateBlockDoc(bad);
    expect(result.ok).toBe(false);
    const paths = result.issues.map((i) => i.path);
    expect(paths).toContain('content[1].type');
    expect(paths.some((p) => p.startsWith('content[2].props.images'))).toBe(true);
    // The missing-props contact block defaults cleanly — no issue expected for [3].
    expect(paths.some((p) => p.startsWith('content[3]'))).toBe(false);
  });

  it('rejects non-object docs and unsupported future versions', () => {
    expect(validateBlockDoc(null).ok).toBe(false);
    expect(validateBlockDoc([1, 2]).ok).toBe(false);

    const future = { ...luxnailsFixture, version: BLOCK_SCHEMA_VERSION + 1 };
    const result = validateBlockDoc(future);
    expect(result.ok).toBe(false);
    expect(result.issues[0].path).toBe('version');
    expect(result.issues[0].message).toMatch(/unsupported block schema version/);

    // migrateBlockDoc tolerates garbage input without throwing (skeleton for
    // future v2 migrations to build on).
    expect(migrateBlockDoc(undefined).version).toBe(BLOCK_SCHEMA_VERSION);
    expect(migrateBlockDoc({ content: 'nope' }).content).toEqual([]);
  });
});
