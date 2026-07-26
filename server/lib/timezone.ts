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