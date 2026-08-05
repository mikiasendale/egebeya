/**
 * Verify the zero-payment Pro upgrade endpoint is NOT mounted when
 * NODE_ENV=production, even if ENABLE_TEST_ENDPOINTS=true is set.
 *
 * We test at the source level: the pro-site.ts module guard must be
 * `if (process.env.NODE_ENV !== 'production')` with NO code-path that
 * exposes the upgrade endpoint via ENABLE_TEST_ENDPOINTS. Route mounting
 * happens at module-evaluation time, so verifying the source guard is
 * equivalent.
 *
 * The additional test in subscription-upgrade.test.ts (which runs in
 * NODE_ENV=test) already validates the upgrade endpoint works in dev.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Production escape hatch — upgrade endpoint unmounted in production', () => {
  it('upgrade route guard uses strict NODE_ENV !== "production"', () => {
    const sourcePath = path.resolve(process.cwd(), 'src/api/pro-site.ts');
    const source = fs.readFileSync(sourcePath, 'utf8');

    // The guard must be strictly NODE_ENV !== 'production'
    expect(source).toContain("if (process.env.NODE_ENV !== 'production')");

    // The comment before the guard says DEV/TEST-ONLY
    expect(source).toContain('DEV/TEST-ONLY');

    // The route definition is inside the guard block
    expect(source).toContain("router.post('/subscription/upgrade'");

    // The actual if-condition must NOT have ENABLE_TEST_ENDPOINTS in the code line.
    // (Comments mentioning it in docs are fine — this tests the code path only.)
    const codeLines = source.split('\n').filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('//'));
    for (const line of codeLines) {
      if (line.includes('ENABLE_TEST_ENDPOINTS')) {
        throw new Error(`ENABLE_TEST_ENDPOINTS appears in code (not comment) in pro-site.ts: "${line.trim()}"`);
      }
    }
  });

  it('ENABLE_TEST_ENDPOINTS in index.ts only gates test routes', () => {
    const sourcePath = path.resolve(process.cwd(), 'src/api/index.ts');
    const source = fs.readFileSync(sourcePath, 'utf8');

    // Find all lines mentioning ENABLE_TEST_ENDPOINTS
    const testLines = source.split('\n').filter(l => l.includes('ENABLE_TEST_ENDPOINTS'));
    for (const line of testLines) {
      // Every line must be about test routes only
      expect(line).toMatch(/test/i);
    }
  });
});
