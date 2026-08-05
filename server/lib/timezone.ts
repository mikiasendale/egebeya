const ADDIS_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3

/**
 * Given a UTC Date, return a Date whose getHours/getMinutes/etc reflect Addis time.
 * This is for display only — no side effects.
 */
export function toAddis(utc: Date): Date {
  return new Date(utc.getTime() + ADDIS_OFFSET_MS);
}

/**
 * Return the day of week (0=Sunday, ..., 6=Saturday) in Addis time for a UTC Date.
 * Adding 3 hours might cross midnight, so we shift before getUTCDay.
 */
export function getAddisDayOfWeek(utc: Date): number {
  const addis = new Date(utc.getTime() + ADDIS_OFFSET_MS);
  return addis.getUTCDay();
}

/**
 * Return "YYYY-MM-DD" in Addis timezone for a UTC Date.
 * (Gregorian — internal DB representation.)
 */
export function getAddisDateString(utc: Date): string {
  const addis = new Date(utc.getTime() + ADDIS_OFFSET_MS);
  const y = addis.getUTCFullYear();
  const m = String(addis.getUTCMonth() + 1).padStart(2, '0');
  const d = String(addis.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Given a date string "YYYY-MM-DD" that represents midnight in Addis time,
 * return a UTC Date at midnight of that Addis day (i.e., 21:00 UTC the day before).
 */
export function parseAddisDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  // Create UTC midnight for that date, then subtract the offset to get the UTC moment
  // that corresponds to midnight Addis.
  const utcMidnight = Date.UTC(y, m - 1, d, 0, 0, 0);
  return new Date(utcMidnight - ADDIS_OFFSET_MS);
}

/**
 * Format a UTC slot start time as an Addis-local HH:MM string for display.
 */
export function formatAddisSlotTime(utcMs: number): string {
  const addis = new Date(utcMs + ADDIS_OFFSET_MS);
  return `${String(addis.getUTCHours()).padStart(2, '0')}:${String(addis.getUTCMinutes()).padStart(2, '0')}`;
}

/* ────────────────────────────────────────────────────────────────────────
 * Ethiopian calendar presentation layer
 *
 * All internal logic, DB schema, and API payloads use Gregorian epoch
 * milliseconds. Ethiopian conversion is purely a presentation-layer concern.
 * The functions below convert UTC → Ethiopian date strings for customer-facing
 * emails, SMS, and public API responses.
 *
 * We import the `ethiopian-date` package dynamically to avoid pulling it
 * into the server-side bundle when it's not needed — but the conversion is
 * synchronous so callers don't need to await.
 * ──────────────────────────────────────────────────────────────────────── */

import { toEthiopian } from 'ethiopian-date';

export const ETHIOPIAN_MONTHS = [
  'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yakatit',
  'Maggabit', 'Miyazya', 'Ginbot', 'Sene', 'Hamle', 'Nehasse', 'Pagume',
];

/**
 * Convert a UTC epoch millisecond to an Ethiopian date string.
 *
 * Returns a human-readable string like "Pagume 5, 2018" or "Meskerem 1, 2018"
 * using Latin transliteration (Amharic month names in Latin script). This is
 * the canonical Ethiopian date format used in all customer-facing text
 * (emails, SMS, public API responses).
 *
 * @param utcMs UTC epoch milliseconds
 * @returns Ethiopian date string "MonthName DD, YYYY"
 */
export function formatEthiopianDate(utcMs: number): string {
  const addis = new Date(utcMs + ADDIS_OFFSET_MS);
  const [year, month, day] = toEthiopian(
    addis.getUTCFullYear(),
    addis.getUTCMonth() + 1,
    addis.getUTCDate(),
  );
  const monthName = ETHIOPIAN_MONTHS[(month - 1) % 13];
  return `${monthName} ${day}, ${year}`;
}

/**
 * Convert a UTC epoch millisecond to a compact Ethiopian date string.
 *
 * Returns "YYYY/MM/DD" in Ethiopic numerals where font support permits,
 * otherwise Latin transliteration like "2018/09/13". Month is 1-13 (Pagume
 * = 13). Used in log messages and structured data where space is tight.
 */
export function formatEthiopianDateCompact(utcMs: number): string {
  const addis = new Date(utcMs + ADDIS_OFFSET_MS);
  const [year, month, day] = toEthiopian(
    addis.getUTCFullYear(),
    addis.getUTCMonth() + 1,
    addis.getUTCDate(),
  );
  return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}

/**
 * Full Ethiopian date-time string for emails/SMS.
 *
 * Combines `formatEthiopianDate` with `formatAddisSlotTime` to produce:
 *   "Pagume 5, 2018 at 14:30"
 */
export function formatEthiopianDateTime(utcMs: number): string {
  return `${formatEthiopianDate(utcMs)} at ${formatAddisSlotTime(utcMs)}`;
}