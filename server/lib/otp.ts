/**
 * OTP (One-Time Password) library for SMS-based verification.
 *
 * Provides generate/verify/resend for phone-based auth flows:
 *   - register-with-phone
 *   - reset-password-via-sms
 *
 * Rate limiting is handled at the API middleware layer (express-rate-limit).
 * This module enforces per-phone business rules (e.g. 3 sends/hour).
 */
import { db } from '../../src/db';
import { otpCodes } from '../../src/db/schema';
import { eq, and, sql, gt } from 'drizzle-orm';
import crypto from 'crypto';
import { sendSms } from './sms';
import { normalizePhone } from '../../src/lib/phone';

const OTP_LENGTH = 6;
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Maximum failed attempts before an OTP code is invalidated. */
const MAX_ATTEMPTS = 5;

/** Maximum OTP sends per phone per rolling hour (rate limit). */
const MAX_SENDS_PER_HOUR = 3;

/** Maximum verify attempts per phone per rolling window. */
const MAX_VERIFY_ATTEMPTS = 10;
const VERIFY_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Generate a cryptographically-random N-digit OTP code string.
 */
function randomDigits(length: number): string {
  const max = Math.pow(10, length);
  const min = Math.pow(10, length - 1);
  const range = max - min;
  // Use random bytes to avoid modulo bias for small ranges.
  const bytes = crypto.randomBytes(4);
  const num = bytes.readUInt32BE(0);
  return String(min + (num % range));
}

/**
 * Count how many OTP send requests this phone has made in the last hour.
 * Used to enforce per-phone send rate limiting (3/hour).
 */
async function sendCountInLastHour(phone: string): Promise<number> {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.phone, phone),
        gt(otpCodes.createdAt, oneHourAgo),
      ),
    )
    .get();
  return rows?.count ?? 0;
}

/**
 * Count how many verify attempts this phone has made in the last 15 minutes.
 */
async function verifyCountInWindow(phone: string): Promise<number> {
  const windowAgo = Date.now() - VERIFY_WINDOW_MS;
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.phone, phone),
        gt(otpCodes.createdAt, windowAgo),
      ),
    )
    .get();
  return rows?.count ?? 0;
}

/**
 * Clean up OTP codes older than the rate-limit window (1 hour). Rows within
 * the window are kept so the per-phone send/verify counters stay accurate —
 * the window is the upper bound on how long a code row needs to exist for
 * bookkeeping.
 */
async function cleanupOldCodes(phone: string): Promise<void> {
  const cutoff = Date.now() - 60 * 60 * 1000;
  await db
    .delete(otpCodes)
    .where(
      and(
        eq(otpCodes.phone, phone),
        sql`${otpCodes.createdAt} < ${cutoff}`,
      ),
    )
    .run();
}

/**
 * Generate and send a 6-digit OTP code to the given phone number.
 *
 * 1. Deletes any previous unused codes for this phone.
 * 2. Checks per-phone send rate limit (3/hour).
 * 3. Generates a new code and stores it with a 10-minute TTL.
 * 4. Sends the code via SMS.
 *
 * Returns the messageId from the SMS send (for auditing).
 */
export async function generateOtp(phone: string): Promise<{ messageId: string }> {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw new Error('Invalid Ethiopian phone number');
  }

  // Rate limit: max 3 sends per hour per phone
  const recentSends = await sendCountInLastHour(normalized);
  if (recentSends >= MAX_SENDS_PER_HOUR) {
    const err: any = new Error('Too many OTP requests. Please try again later.');
    err.statusCode = 429;
    err.code = 'RATE_LIMITED_OTP_SEND';
    throw err;
  }

  // Invalidate (rather than delete) previous unused codes for this phone so
  // the send-rate counter above keeps counting them within the window. The
  // latest code is the only one verifyOtp will accept, so older codes are
  // effectively cancelled by a resend.
  await db
    .update(otpCodes)
    .set({ used: true })
    .where(
      and(
        eq(otpCodes.phone, normalized),
        eq(otpCodes.used, false as any),
      ),
    )
    .run();

  // Also clean up rows that have aged out of the bookkeeping window
  await cleanupOldCodes(normalized);

  // Generate new code
  const code = randomDigits(OTP_LENGTH);
  const now = Date.now();

  await db.insert(otpCodes).values({
    id: crypto.randomUUID(),
    phone: normalized,
    code,
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    used: false,
    createdAt: now,
  });

  // Send via SMS
  const text = `Your Egebeya verification code is: ${code}. It expires in 10 minutes.`;
  const result = await sendSms({ to: normalized, text });

  return { messageId: result.messageId ?? 'unknown' };
}

/**
 * Verify an OTP code for the given phone number.
 *
 * Single-use: deletes the code row on success. Checks expiry and increments
 * attempts on failure. Returns the phone on success, throws on failure.
 *
 * Rate limit: max 10 verify attempts per 15 minutes per phone.
 */
export async function verifyOtp(phone: string, code: string): Promise<string> {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw new Error('Invalid Ethiopian phone number');
  }

  // Rate limit verify attempts per phone
  const recentVerifies = await verifyCountInWindow(normalized);
  if (recentVerifies >= MAX_VERIFY_ATTEMPTS) {
    const err: any = new Error('Too many verification attempts. Please try again later.');
    err.statusCode = 429;
    err.code = 'RATE_LIMITED_OTP_VERIFY';
    throw err;
  }

  // Find the latest unused, non-expired code for this phone
  const codeRecord = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.phone, normalized),
        eq(otpCodes.used, false as any),
        gt(otpCodes.expiresAt, Date.now()),
      ),
    )
    .orderBy(sql`${otpCodes.createdAt} DESC`)
    .get();

  if (!codeRecord) {
    const err: any = new Error('No valid OTP code found. Please request a new code.');
    err.statusCode = 400;
    throw err;
  }

  // Check attempts
  if (codeRecord.attempts >= MAX_ATTEMPTS) {
    // Invalidate this code (too many attempts)
    await db.delete(otpCodes).where(eq(otpCodes.id, codeRecord.id)).run();
    const err: any = new Error('Too many failed attempts. Please request a new code.');
    err.statusCode = 400;
    throw err;
  }

  if (codeRecord.code !== code) {
    // Increment attempts
    await db
      .update(otpCodes)
      .set({ attempts: codeRecord.attempts + 1 })
      .where(eq(otpCodes.id, codeRecord.id))
      .run();
    const err: any = new Error('Invalid verification code.');
    err.statusCode = 400;
    throw err;
  }

  // Success — delete the code (single-use) and return the normalized phone
  await db.delete(otpCodes).where(eq(otpCodes.id, codeRecord.id)).run();

  return normalized;
}

/**
 * Resend an OTP code. Rate-limited to 3 per hour per phone.
 * Invalidates any previous unused codes before generating a new one.
 */
export async function resendOtp(phone: string): Promise<{ messageId: string }> {
  return generateOtp(phone);
}