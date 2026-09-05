/**
 * Production boot-time env validation. Called from server.ts before the server
 * listens so a missing/known-insecure critical secret aborts startup.
 */
import crypto from 'crypto';

type EnvCheck = {
  name: string;
  read: () => string | null;
  /** SHA-256 fingerprints of known-leaked values (never store the values themselves —
   *  the literals were once committed to a public repo; see C-2 in the 2026-09-05 audit). */
  rejectFingerprints?: string[];
  /** Plain equality reject for NON-secret flags (no fingerprint needed). */
  rejectIfEquals?: string[];
  prodOnly?: boolean;
  /** Reject-only check: absence is the SAFE state and must not abort boot
   *  (e.g. ENABLE_TEST_ENDPOINTS — unset means the debug surface stays unmounted). */
  optional?: boolean;
};

const sha256 = (value: string): string =>
  crypto.createHash('sha256').update(value, 'utf8').digest('hex');

const checks: EnvCheck[] = [
  {
    name: 'CHAPA_SECRET_KEY',
    read: () => process.env.CHAPA_SECRET_KEY?.trim() || null,
    // Fingerprint of the leaked Chapa TEST key (purged from git history 2026-09-05).
    // Deliberately retained after rotation: it permanently rejects the dead credential.
    rejectFingerprints: ['ad53e50f65fee14be26cf55b2b8553057b233d8a377d45ba8f54900ae3a6f862'],
    prodOnly: true,
  },
  {
    name: 'CHAPA_WEBHOOK_SECRET',
    read: () => process.env.CHAPA_WEBHOOK_SECRET?.trim() || null,
    // Fingerprint of the leaked webhook secret (purged from git history 2026-09-05).
    rejectFingerprints: ['b8ca32036623a993f3f0452d7bb8aedaf28115c1cece953358fab7ee14ab1bb8'],
    prodOnly: true,
  },
  {
    name: 'APP_URL',
    read: () => process.env.APP_URL?.trim() || null,
    prodOnly: true,
  },
  {
    name: 'PUBLIC_EMBED_DOMAIN',
    read: () => process.env.PUBLIC_EMBED_DOMAIN?.trim() || process.env.APP_URL?.trim() || null,
    prodOnly: true,
  },
  {
    name: 'ENABLE_TEST_ENDPOINTS',
    // S-6: /api/test/* exposes an authenticated mail-send surface. It is
    // mounted only when this flag is exactly 'true' (src/api/index.ts) —
    // production must refuse to boot with it on, so a copy-pasted .env can
    // never ship the debug surface. Unset (the default) is SAFE and must
    // NOT abort boot — hence optional: true.
    read: () => process.env.ENABLE_TEST_ENDPOINTS?.trim() || null,
    rejectIfEquals: ['true'],
    prodOnly: true,
    optional: true,
  },
];

export function validateProductionEnv(): void {
  const isProd = process.env.NODE_ENV === 'production';

  // Deploy-time escape hatch: while the operator's Chapa account is
  // unverified (no keys available yet), ALLOW_UNVERIFIED_PAYMENTS=true lets
  // the server boot in production WITHOUT the Chapa secrets so the rest of
  // the app (booking, CRM, sites) can run. Payments are NOT stubbed — the
  // runtime guards in server/lib/chapa.ts (initChapa/getWebhookSecret) still
  // throw when a payment is actually attempted. This only defers the
  // boot-time check. Remove the flag as soon as real keys are provisioned.
  const skipChapa = process.env.ALLOW_UNVERIFIED_PAYMENTS === 'true';
  if (skipChapa) {
    console.warn(
      '[env] WARNING: ALLOW_UNVERIFIED_PAYMENTS=true — booting without Chapa ' +
      'payment keys. Booking/payment endpoints will fail until CHAPA_SECRET_KEY ' +
      'and CHAPA_WEBHOOK_SECRET are set.',
    );
  }

  const failures: string[] = [];

  for (const c of checks) {
    if (c.prodOnly && !isProd) continue;
    if (skipChapa && (c.name === 'CHAPA_SECRET_KEY' || c.name === 'CHAPA_WEBHOOK_SECRET')) continue;
    const value = c.read();
    if (c.rejectIfEquals && value && c.rejectIfEquals.includes(value)) {
      failures.push(`${c.name}=${value} must not be enabled in production`);
      continue;
    }
    if (!value) {
      // Required secrets must be set; optional (reject-only) checks pass
      // when unset — that is their safe default.
      if (!c.optional) failures.push(`${c.name} is not set`);
      continue;
    }
    if (c.rejectFingerprints && c.rejectFingerprints.includes(sha256(value))) {
      failures.push(`${c.name} matches a leaked credential fingerprint (rotate it)`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`[env] Production boot aborted. Fix the following:\n  - ${failures.join('\n  - ')}`);
  }
}
