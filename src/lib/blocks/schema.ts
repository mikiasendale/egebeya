/**
 * Versioned block-document contract (P2.1).
 *
 * ONE representation rules both the Puck editor and the simple editor: a
 * block document is `{ version, root, content: Block[] }` where every Block
 * keeps the existing Puck item shape `{ type, props, data }`. Legacy seeds
 * predate `version` (treated as v1) and use PascalCase type names —
 * `migrateBlockDoc` normalises them to the canonical lowercase set below so
 * validation has exactly one vocabulary.
 */
import { z } from 'zod';

export const BLOCK_SCHEMA_VERSION = 1;

/** Canonical block type vocabulary (v1). */
export const CANONICAL_TYPES = [
  'hero', 'about', 'services', 'gallery', 'hours', 'location',
  'testimonials', 'social-links', 'booking-form', 'contact',
  'deposit-policy', 'custom-html',
] as const;

export type BlockType = (typeof CANONICAL_TYPES)[number];

/** PascalCase names found in pre-contract seeds → canonical equivalents. */
const LEGACY_TYPE_MAP: Record<string, BlockType> = {
  Hero: 'hero',
  About: 'about',
  Services: 'services',
  Gallery: 'gallery',
  BusinessHours: 'hours',
  LocationMap: 'location',
  Testimonials: 'testimonials',
  SocialLinks: 'social-links',
  BookingForm: 'booking-form',
  Contact: 'contact',
};

const httpUrl = z.string().max(2048).refine(
  (v) => v === '' || /^https?:\/\//i.test(v),
  { message: 'must be empty or an http(s) URL' },
);

/** Per-type prop schemas. Loose on purpose: Puck owns editing UX, we own shape. */
const PROP_SCHEMAS: Record<BlockType, z.ZodTypeAny> = {
  hero: z.object({
    title: z.string().max(200).default(''),
    subtitle: z.string().max(500).default(''),
    backgroundImage: httpUrl.default(''),
  }).loose(),
  about: z.object({
    content: z.string().max(5000).default(''),
  }).loose(),
  services: z.object({}).loose(),
  gallery: z.object({
    images: z.array(z.object({
      url: httpUrl.default(''),
      caption: z.string().max(200).default(''),
    }).loose()).max(60).default([]),
  }).loose(),
  hours: z.object({}).loose(),
  location: z.object({
    mapUrl: httpUrl.default(''),
  }).loose(),
  testimonials: z.object({
    items: z.array(z.object({
      quote: z.string().max(1000).default(''),
      name: z.string().max(120).default(''),
      avatar: httpUrl.default(''),
    }).loose()).max(30).default([]),
  }).loose(),
  'social-links': z.object({}).loose(),
  'booking-form': z.object({}).loose(),
  contact: z.object({
    phone: z.string().max(40).default(''),
    address: z.string().max(300).default(''),
    mapUrl: httpUrl.default(''),
  }).loose(),
  // Merchant's deposit rule surfaced on the public site; money math still
  // lives in services/payments — this block only describes policy.
  'deposit-policy': z.object({
    note: z.string().max(1000).default(''),
    percent: z.number().min(0).max(100).optional(),
    required: z.boolean().optional(),
  }).loose(),
  // Raw HTML from the merchant is stored verbatim here but MUST be sanitized
  // by the renderer before insertion into the DOM.
  'custom-html': z.object({
    html: z.string().max(50_000).default(''),
  }).loose(),
};

const blockSchema = z.object({
  type: z.string(),
  props: z.record(z.string(), z.any()).default({}),
  data: z.record(z.string(), z.any()).default({}),
});

const docSchema = z.object({
  version: z.number().int().default(BLOCK_SCHEMA_VERSION),
  root: z.record(z.string(), z.any()).default({}),
  content: z.array(blockSchema),
});

export interface BlockDoc {
  version: number;
  root: Record<string, any>;
  content: Array<{ type: string; props: Record<string, any>; data: Record<string, any> }>;
}

export interface BlockDocIssue {
  /** e.g. "content[2].props.title" */
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  /** Normalised canonical document (legacy types migrated, defaults filled). */
  doc?: BlockDoc;
  issues: BlockDocIssue[];
}

/**
 * Normalise a stored/edited document: fill version + migrate legacy type
 * names. Does NOT validate prop payloads — chain into validateBlockDoc.
 */
export function migrateBlockDoc(input: unknown): BlockDoc {
  const raw = (input ?? {}) as Record<string, any>;
  const content = Array.isArray(raw.content) ? raw.content : [];
  return {
    version: typeof raw.version === 'number' ? raw.version : BLOCK_SCHEMA_VERSION,
    root: (raw.root && typeof raw.root === 'object') ? raw.root : {},
    content: content.map((b: any) => ({
      type: b?.type,
      props: (b?.props && typeof b.props === 'object') ? b.props : {},
      data: (b?.data && typeof b.data === 'object') ? b.data : {},
    })),
  };
}

/**
 * Validate a block document against the versioned contract. Returns
 * field-level issues (path + message) instead of throwing.
 */
export function validateBlockDoc(input: unknown): ValidationResult {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, issues: [{ path: '', message: 'block document must be an object' }] };
  }

  const migratedRaw = migrateBlockDoc(input);

  // Unknown versions are rejected until a migration exists for them.
  if (migratedRaw.version !== BLOCK_SCHEMA_VERSION) {
    return {
      ok: false,
      issues: [{
        path: 'version',
        message: `unsupported block schema version ${migratedRaw.version} (current: ${BLOCK_SCHEMA_VERSION})`,
      }],
    };
  }

  const parsed = docSchema.safeParse(migratedRaw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    };
  }

  const issues: BlockDocIssue[] = [];
  const canonicalContent = parsed.data.content.map((block, idx) => {
    // Legacy PascalCase → canonical.
    const canonicalType = LEGACY_TYPE_MAP[block.type] ?? block.type;

    if (!(CANONICAL_TYPES as readonly string[]).includes(canonicalType)) {
      issues.push({ path: `content[${idx}].type`, message: `unknown block type "${block.type}"` });
      return block;
    }

    const propCheck = PROP_SCHEMAS[canonicalType as BlockType].safeParse(block.props);
    if (!propCheck.success) {
      for (const issue of propCheck.error.issues) {
        issues.push({
          path: `content[${idx}].props${issue.path.length ? '.' + issue.path.join('.') : ''}`,
          message: issue.message,
        });
      }
      return block;
    }
    return { type: canonicalType, props: propCheck.data as Record<string, any>, data: block.data };
  });

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    issues: [],
    doc: { version: BLOCK_SCHEMA_VERSION, root: parsed.data.root, content: canonicalContent },
  };
}
