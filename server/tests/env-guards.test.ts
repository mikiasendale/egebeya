/**
 * validateProductionEnv — production boot guard.
 *
 * Regression (Render deploy crash 2026-09-05): S-6 added ENABLE_TEST_ENDPOINTS
 * as a reject-only check, but the validation loop treated "unset" like a
 * missing required secret, so every real production boot that never sets the
 * flag aborted with "ENABLE_TEST_ENDPOINTS is not set". Unset is the safe
 * default and must pass; exactly 'true' must abort.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateProductionEnv } from '../../src/lib/envGuards';

const TOUCHED = [
  'NODE_ENV', 'CHAPA_SECRET_KEY', 'CHAPA_WEBHOOK_SECRET', 'APP_URL',
  'PUBLIC_EMBED_DOMAIN', 'ENABLE_TEST_ENDPOINTS', 'ALLOW_UNVERIFIED_PAYMENTS',
] as const;

const saved = new Map<string, string | undefined>();

beforeEach(() => {
  saved.clear();
  for (const k of TOUCHED) saved.set(k, process.env[k]);
  process.env.NODE_ENV = 'production';
  delete process.env.ENABLE_TEST_ENDPOINTS;
  delete process.env.ALLOW_UNVERIFIED_PAYMENTS;
  delete process.env.PUBLIC_EMBED_DOMAIN;
  process.env.APP_URL = 'https://app.example.test';
  process.env.CHAPA_SECRET_KEY = 'CHASECK_TEST-ok';
  process.env.CHAPA_WEBHOOK_SECRET = 'whsec-ok';
});

afterEach(() => {
  for (const k of TOUCHED) {
    const v = saved.get(k);
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe('validateProductionEnv', () => {
  it('boots when ENABLE_TEST_ENDPOINTS is unset (its safe default)', () => {
    expect(() => validateProductionEnv()).not.toThrow();
  });

  it('refuses to boot with ENABLE_TEST_ENDPOINTS=true', () => {
    process.env.ENABLE_TEST_ENDPOINTS = 'true';
    expect(() => validateProductionEnv())
      .toThrow(/ENABLE_TEST_ENDPOINTS=true must not be enabled in production/);
  });

  it('still requires the production secrets', () => {
    delete process.env.APP_URL;
    expect(() => validateProductionEnv()).toThrow(/APP_URL is not set/);
  });

  it('honours ALLOW_UNVERIFIED_PAYMENTS for the Chapa pair only', () => {
    delete process.env.CHAPA_SECRET_KEY;
    delete process.env.CHAPA_WEBHOOK_SECRET;
    expect(() => validateProductionEnv()).toThrow(/CHAPA_SECRET_KEY is not set/);

    process.env.ALLOW_UNVERIFIED_PAYMENTS = 'true';
    expect(() => validateProductionEnv()).not.toThrow();
  });
});
