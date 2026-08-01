// Ethiopian phone normalization.
//
// Accepts the common ways Ethiopian users type a number and normalizes them
// all to the canonical "+251XXXXXXXXX" form used as the unique identity in
// the `users` table:
//
//   +251911234567  (already canonical)
//   251911234567   (no plus)
//   0911234567     (leading zero)
//   911234567      (bare 9-digit)
//   0900123456     (the 09… format used by many banks/SMS gateways)
//
// Any 9-digit Ethiopian number is accepted (mobile 09/07 and fixed-line
// prefixes alike). Returns null when the value is not a valid Ethiopian
// number.
const ETHIOPIAN_PHONE_RE = /^(?:(?:\+?251)|(?:0)?)(\d{9})$/;

export function normalizePhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const s = input.trim().replace(/[\s-]/g, '');
  const m = s.match(ETHIOPIAN_PHONE_RE);
  if (!m) return null;
  return `+251${m[1]}`;
}
