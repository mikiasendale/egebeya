/**
 * #46 — cron copy lives in locales, not code.
 *
 * Customer-facing copy used by server/cron jobs must come from
 * src/locales/{en,am}.json where key parity and the no-STOP guard are
 * enforced. Amharic literals inline in server/cron are forbidden
 * (server/tests/i18n.test.ts scans the directory).
 *
 * These are TRANSACTIONAL messages (reminders, renewals, winbacks to
 * opted-in customers) — not marketing blasts — so they carry no opt-out
 * clause by policy (#44).
 */
import enLocales from '../../src/locales/en.json';
import amLocales from '../../src/locales/am.json';

export type CronLocale = 'en' | 'am';

/** Replace {{key}} placeholders; unknown placeholders are left verbatim. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (m, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : m,
  );
}

/** Read a string leaf from the locale tree of `locale`; '' when missing. */
export function copyLeaf(locale: CronLocale, ...path: string[]): string {
  let node: any = locale === 'am' ? amLocales : enLocales;
  for (const k of path) {
    node = node?.[k];
  }
  return typeof node === 'string' ? node : '';
}

/** Both locale sub-trees at `path` (for bilingual owner-facing emails). */
export function bothLocaleTrees(...path: string[]): { en: any; am: any } {
  const walk = (root: any): any => {
    let n: any = root;
    for (const k of path) n = n?.[k];
    return n ?? {};
  };
  return { en: walk(enLocales), am: walk(amLocales) };
}
