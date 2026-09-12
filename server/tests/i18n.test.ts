/**
 * i18n parity (WP2 / P3-Item-D).
 *
 * Two layers:
 *   1. KEY parity — every key in en.json must exist in am.json (and vice
 *      versa). Regression guard against dropped sections.
 *   2. VALUE parity for a CRITICAL key set (consent, pricing, billing,
 *      onboarding, privacy, terms, register, booking, settings) — a leaf
 *      whose Amharic value is byte-identical to English AND contains real
 *      Latin words (>3 chars) is a FAILURE: it means Amharic users are being
 *      served untranslated copy. Intentional pass-throughs (brand names,
 *      technical tokens, shared numerals) live in ALLOWLIST with a comment.
 *
 * This test fails on any NEW English-identical critical string, forcing the
 * translation (or a documented allowlist entry) at the point of introduction.
 */
import { describe, it, expect } from 'vitest';
import en from '../../src/locales/en.json';
import am from '../../src/locales/am.json';

/** Sections whose values must be genuinely translated (Amharic-first rule). */
const CRITICAL_SECTIONS = ['consent', 'pricing', 'billing', 'onboarding', 'privacy', 'terms', 'register', 'booking', 'settings'];

/**
 * Intentional pass-through terms. A critical leaf may be English-identical
 * ONLY if its full path is listed here AND the reason is a brand/technical
 * token, not laziness. Add with a comment; remove when translated.
 */
const ALLOWLIST: Record<string, string> = {
  // Brand/domain tokens that keep their Latin form in Amharic copy.
  'register.slugHelper': 'egebeya.et is the product domain, kept verbatim in Amharic copy',
  'register.cityHelper': '"Discover" is the directory product name',
};

/** All leaf values of a locale tree as path → string. */
function leafValues(root: any): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (prefix: string, node: any) => {
    for (const [k, v] of Object.entries(node)) {
      const p = prefix ? `${prefix}.${k}` : k;
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) walk(p, v);
      else if (typeof v === 'string') out[p] = v;
    }
  };
  walk('', root);
  return out;
}

/** Keys whose top-level section is in the critical set. */
function inCritical(path: string): boolean {
  const head = path.split('.')[0];
  return CRITICAL_SECTIONS.includes(head);
}

describe('i18n parity (WP2 / P3-D)', () => {
  it('deep-compares en and am locale keys', () => {
    const keys = (r: any) => {
      const out: string[] = [];
      const walk = (p: string, n: any) => {
        if (n !== null && typeof n === 'object' && !Array.isArray(n)) {
          for (const [k, v] of Object.entries(n)) walk(p ? `${p}.${k}` : k, v);
        } else out.push(p);
      };
      walk('', r);
      return out;
    };
    expect(keys(en).sort()).toEqual(keys(am).sort());
  });

  it('VALUE parity: no English-identical Latin copy in critical sections outside the allowlist', () => {
    const amLeaves = leafValues(am);
    const enLeaves = leafValues(en);
    const LATIN_WORD = /[A-Za-z]{4,}/;

    const violations: string[] = [];
    for (const [path, enVal] of Object.entries(enLeaves)) {
      if (!inCritical(path)) continue;
      const amVal = amLeaves[path];
      if (amVal === undefined) continue; // key parity already guards
      if (amVal === enVal && LATIN_WORD.test(enVal) && !(path in ALLOWLIST)) {
        violations.push(path);
      }
    }

    expect(violations, `critical English-identical strings in am.json:\n${violations.join('\n')}`).toEqual([]);
  });

  it('#44: no locale copy promises an SMS/Telegram STOP keyword (none is read)', () => {
    // No inbound SMS reader exists in this product and the Telegram bot only
    // handles /start — so promising "Reply STOP" anywhere is an unkept
    // promise (PDPL consent-copy duty). The only sanctioned way to stop
    // Telegram traffic is blocking the bot. When the T7.12 inbound STOP
    // webhook is built, remove this guard deliberately.
    const STOP_CLAIM = /\bSTOP\b/i;
    const violations: string[] = [];
    for (const [locale, leaves] of [['en', leafValues(en)], ['am', leafValues(am)]] as const) {
      for (const [path, value] of Object.entries(leaves)) {
        if (STOP_CLAIM.test(value)) violations.push(`${locale}:${path}`);
      }
    }
    expect(violations, `unkept STOP promises in locales:\n${violations.join('\n')}`).toEqual([]);
  });

  it('#46: no Amharic copy lives only in server/cron code (bodies belong in locales)', () => {
    // Customer-facing Amharic copy is a first-language-review artifact and
    // must live in the locale files where parity is enforced — never as
    // inline literals in cron code. (server/lib/mailTemplates.ts is exempt:
    // its copy is covered by the email-templates parity test.)
    const fs = require('fs');
    const path = require('path');
    const AMHARIC = /[\u1200-\u137F]/;
    const dir = path.resolve(__dirname, '../cron');
    const violations: string[] = [];
    for (const f of fs.readdirSync(dir).filter((x: string) => x.endsWith('.ts') || x.endsWith('.js'))) {
      const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
      lines.forEach((line: string, i: number) => {
        if (AMHARIC.test(line)) violations.push(`server/cron/${f}:${i + 1}`);
      });
    }
    expect(violations, `Amharic literals in server/cron:\n${violations.join('\n')}`).toEqual([]);
  });

  it('#45: refund copy matches reality — no automatic-refund promise', () => {
    // The code issues refunds manually (public.ts refundNote; paid days are
    // non-refundable per account-deletion policy). The landing page must
    // promise exactly that — copy and cancel response must agree.
    const enRefund = leafValues(en)['proofForm.refund'];
    const amRefund = leafValues(am)['proofForm.refund'];
    expect(enRefund).toBeTruthy();
    expect(amRefund).toBeTruthy();
    expect(enRefund).not.toMatch(/automatic|auto-?refund/i);
    expect(amRefund).not.toContain('በራስ-ሰር'); // 'automatically' in Amharic
  });
});
