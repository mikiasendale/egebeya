import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users, tenants, passwordResets, tenantSubscriptions, refreshTokenFamilies } from '../db/schema';
import { eq, sql, and, desc } from 'drizzle-orm';
import crypto from 'crypto';
import { notify } from '../../server/lib/notifications';
import { trackEvent, type ActivationEvent } from '../../server/lib/analytics';
import { applyTemplate } from '../../server/lib/mailTemplates';
import { jwtSecret, refreshSecret, requireAuth } from './middleware/auth';
import { csrfProtection } from './middleware/csrf';
import { authLimiter, otpLimiter } from '../../server/middleware/rateLimiter';
import { logSecurityEvent, ipFromRequest } from '../../server/lib/securityLog';
import { normalizePhone } from '../lib/phone';
import { generateOtp, verifyOtp } from '../../server/lib/otp';
import { getOrCreateFreePlan } from '../../server/lib/plans';

import zxcvbn from 'zxcvbn';

/**
 * Password validation with strength checking.
 * Enforces minimum length, complexity, and uses zxcvbn for strength estimation.
 */
interface PasswordValidationResult {
  valid: boolean;
  score: number; // 0-4 (zxcvbn score)
  feedback: string[];
  error?: string;
}

function validatePassword(password: string): PasswordValidationResult {
  const minLength = 8;
  const errors: string[] = [];

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }

  // Check for character variety
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  if (!hasUpper) errors.push('Password must contain at least one uppercase letter');
  if (!hasLower) errors.push('Password must contain at least one lowercase letter');
  if (!hasNumber) errors.push('Password must contain at least one number');
  if (!hasSpecial) errors.push('Password must contain at least one special character (!@#$%^&* etc.)');

  // Use zxcvbn for additional strength checking
  const result = zxcvbn(password);
  const score = result.score; // 0-4

  // Provide feedback based on zxcvbn suggestions
  const feedback: string[] = [];
  if (result.feedback.warning) feedback.push(result.feedback.warning);
  feedback.push(...result.feedback.suggestions);

  // For very weak passwords (score 0-1), add extra feedback
  if (score <= 1) {
    feedback.push('Consider using a longer password or a passphrase');
  }

  // Combine custom errors with zxcvbn feedback
  const allFeedback = [...errors, ...feedback];

  return {
    valid: errors.length === 0 && score >= 2, // Require at least score 2 (fair)
    score,
    feedback: allFeedback,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}

const router = Router();

const RESERVED_SLUGS = ['www', 'api', 'admin', 'app', 'mail', 'ftp', 'static', 'cdn', 'blog', 'support', 'help', 'dashboard'];

// ---- httpOnly-cookie session helpers ----
const ACCESS_COOKIE = 'accessToken';
const REFRESH_COOKIE = 'refreshToken';
const CSRF_COOKIE = 'csrf_token';

const isProd = () => process.env.NODE_ENV === 'production';

// Access + refresh tokens live in httpOnly cookies (XSS cannot read them).
// The csrf_token cookie is NOT httpOnly so the SPA can read it and echo it
// back in the X-CSRF-Token header on mutations.
function setAuthCookies(res: any, accessToken: string, refreshToken: string) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProd(),
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000, // 15 min
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProd(),
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/auth/refresh',
  });
  res.cookie(CSRF_COOKIE, crypto.randomUUID(), {
    httpOnly: false,
    secure: isProd(),
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookies(res: any) {
  res.clearCookie(ACCESS_COOKIE, { httpOnly: true, secure: isProd(), sameSite: 'lax' });
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: isProd(), sameSite: 'lax', path: '/api/auth/refresh' });
  res.clearCookie(CSRF_COOKIE, { secure: isProd(), sameSite: 'lax' });
}

router.post('/check-slug', async (req, res) => {
  try {
    const { slug } = req.body;
    if (!slug) return res.status(400).json({ error: 'Slug is required' });

    const normalizedSlug = slug.toLowerCase().trim();
    if (RESERVED_SLUGS.includes(normalizedSlug)) {
      return res.json({ available: false, error: 'This business URL is reserved' });
    }

    const existingTenant = await db.select().from(tenants).where(eq(tenants.slug, normalizedSlug)).get();
    res.json({ available: !existingTenant });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check slug' });
  }
});

// T4.9 — anonymous registration-step beacons. Pre-register abandonment (the
// stretch before POST /register) is invisible today because check-slug calls
// carry no identity; these fire-and-forget beacons bind each step to an
// anonymous cookie id (egebeya_anon, issued client-side on first /register
// visit) and land in activation_events with a NULL tenant_id.
const REG_STEPS = ['reg_step_viewed', 'slug_checked', 'reg_details_submitted'] as const;

router.post('/events/reg-step', authLimiter, async (req, res) => {
  try {
    const step = req.body?.step;
    const anonId = typeof req.body?.anonId === 'string' ? req.body.anonId.trim().slice(0, 64) : null;
    if (typeof step !== 'string' || !(REG_STEPS as readonly string[]).includes(step)) {
      return res.status(400).json({ error: 'Unknown registration step' });
    }
    if (!anonId || !/^[A-Za-z0-9-]{8,64}$/.test(anonId)) {
      return res.status(400).json({ error: 'anonId is required' });
    }
    trackEvent(null, step as ActivationEvent, { anonymousId: anonId });
    res.json({ ok: true });
  } catch (error) {
    console.error('[auth] reg-step beacon error:', (error as Error)?.message || error);
    res.status(500).json({ error: 'Failed to record step' });
  }
});

// Find (or create) the canonical 'free' plan row (shared self-healing helper).

router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, phone, password, businessName, slug, email, city, consent } = req.body;

    // P3.5 attribution: street-agent / campaign referral code carried by the
    // signup link (?ref=CODE). Accepted from body (SPA forwards it) or query
    // (direct hit). Sanitized to a conservative charset; unknown codes are
    // still recorded — attribution review happens in analytics, not here.
    const rawRef = (typeof req.body?.ref === 'string' && req.body.ref.trim())
      || (typeof req.query?.ref === 'string' && req.query.ref.trim())
      || '';
    const refCode = String(rawRef).trim().slice(0, 40).replace(/[^A-Za-z0-9_-]/g, '') || null;

    // P2.4 3-screen signup: email / name / slug become OPTIONAL and are
    // auto-derived when absent — Screen 1 collects phone+password(+consent),
    // Screen 2 the business name + category. The full-field contract above is
    // unchanged for existing clients.
    const derivedEmail = (typeof email === 'string' && email.trim())
      ? String(email).trim().toLowerCase()
      : `owner-${String(normalizePhone(phone) || Date.now()).replace(/\D/g, '').slice(-9)}@users.egebeya.app`;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(derivedEmail)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }

    if (!consent || consent !== true) {
      return res.status(400).json({ error: 'You must agree to the Privacy Policy and Terms of Service to register.' });
    }
    const consentGivenAt = Date.now();

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ error: 'Enter a valid Ethiopian phone number (+251XXXXXXXXX)' });
    }

    const trimmedBusinessName = typeof businessName === 'string' && businessName.trim()
      ? businessName.trim().slice(0, 120)
      : '';
    const ownerName = (typeof name === 'string' && name.trim())
      ? name.trim().slice(0, 120)
      : (trimmedBusinessName || 'Owner');

    const normalizedEmail = derivedEmail;
    const existingEmail = await db.select().from(users).where(eq(users.email, normalizedEmail)).get();
    if (existingEmail) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const existingUser = await db.select().from(users).where(eq(users.phone, normalizedPhone)).get();
    if (existingUser) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    // Slug: explicit wins; otherwise derive from business name + short random
    // suffix so the 3-screen flow never blocks on a slug picker. Collision
    // retry keeps auto-derivation race-safe.
    let normalizedSlug: string;
    if (typeof slug === 'string' && slug.trim()) {
      normalizedSlug = slug.toLowerCase().trim();
      if (RESERVED_SLUGS.includes(normalizedSlug)) {
        return res.status(400).json({ error: 'This business URL is reserved' });
      }
      const existingTenantBySlug = await db.select().from(tenants).where(eq(tenants.slug, normalizedSlug)).get();
      if (existingTenantBySlug) {
        return res.status(400).json({ error: 'Business URL already taken' });
      }
    } else {
      const base = (trimmedBusinessName || 'biz')
        .toLowerCase()
        .replace(/[^a-z0-9\u1200-\u137F]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 30) || 'biz';
      normalizedSlug = '';
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = `${base}-${crypto.randomBytes(3).toString('hex')}`;
        if (RESERVED_SLUGS.includes(candidate)) continue;
        const clash = await db.select().from(tenants).where(eq(tenants.slug, candidate)).get();
        if (clash) continue;
        normalizedSlug = candidate;
        break;
      }
      if (!normalizedSlug) normalizedSlug = `${base}-${crypto.randomBytes(4).toString('hex')}`;
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: passwordValidation.error || 'Password does not meet requirements',
        passwordFeedback: passwordValidation.feedback,
        passwordScore: passwordValidation.score,
      });
    }

    const tenantId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const finalBusinessName = trimmedBusinessName || ownerName;
    const passwordHash = await bcrypt.hash(password, 10);

    const trimmedCity = typeof city === 'string' && city.trim() ? city.trim() : null;
    const initialSettings = trimmedCity ? { city: trimmedCity } : {};

    await db.transaction(async (tx) => {
      await tx.insert(tenants).values({
        id: tenantId,
        name: finalBusinessName,
        slug: normalizedSlug,
        category: typeof req.body?.category === 'string' && req.body.category.trim()
          ? req.body.category.trim()
          : null,
        // New tenants are NOT listed on /discover until the owner completes
        // onboarding and opts in via the "List my business publicly" toggle
        // (which sets is_listed back to true).
        isListed: false,
        settings: { ...initialSettings, onboarding_completed: false },
        // P3.5: street-agent / campaign attribution captured at the source.
        acquiredViaCode: refCode,
        createdAt: Date.now()
      });

      await tx.insert(users).values({
        id: userId,
        tenantId: tenantId,
        name: ownerName,
        phone: normalizedPhone,
        email: normalizedEmail,
        passwordHash,
        role: 'owner',
        consentGivenAt,
        createdAt: Date.now()
      });

      const plan = await getOrCreateFreePlan();
      await tx.insert(tenantSubscriptions).values({
        id: crypto.randomUUID(),
        tenantId,
        planId: plan.id,
        status: 'trial',
        trialEndsAt: Date.now() + 14 * 24 * 3600 * 1000,
        startsAt: Date.now(),
      });
    });

    const userRecord = await db.select({ tokenVersion: users.tokenVersion }).from(users).where(eq(users.id, userId)).get();
    const tokenVersion = userRecord?.tokenVersion ?? 0;

    // P3.5: attribution event fires only when a code was actually carried.
    // Agent commissions are paid against code-defined activation events
    // downstream (first_invoice_paid), never against registration alone.
    if (refCode) {
      trackEvent(tenantId, 'agent_attributed', { code: refCode });
    }

    // Mint a fresh refresh-token jti so old/stolen refresh tokens from any
    // previous session become unusable. This is rotated again on every
    // successful /auth/refresh call (see below) — replay-detection lives in
    // the jti-vs-DB check, not in a stateless token.
    const refreshJti = crypto.randomUUID();
    await db.update(users).set({ refreshTokenId: refreshJti }).where(eq(users.id, userId));

    // F-1: registration seeds the user's FIRST refresh-token family (the
    // register path previously minted a jti but never created a family row,
    // so a fresh registrant's first /auth/refresh always 403'd).
    const familyId = crypto.randomUUID();
    await db.insert(refreshTokenFamilies).values({
      id: familyId,
      userId,
      parentJti: refreshJti,
      childJti: refreshJti,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    });

    const token = jwt.sign({ userId, tenantId, role: 'owner', tokenVersion }, jwtSecret(), { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId, tenantId, tokenVersion, jti: refreshJti, fam: familyId }, refreshSecret(), { expiresIn: '7d' });
    setAuthCookies(res, token, refreshToken);

    res.json({
      message: 'Registration successful',
      role: 'owner',
      tenantId,
      tenant: { id: tenantId, name: finalBusinessName, slug: normalizedSlug },
      name: ownerName,
      isSuperadmin: false,
      user: { id: userId, role: 'owner', tenantId, tenantSlug: normalizedSlug, name: ownerName, phone: normalizedPhone },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to register' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
 try {
  const { phone, password } = req.body;
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
   return res.status(400).json({ error: 'Enter a valid Ethiopian phone number (+251XXXXXXXXX)' });
  }
  const user = await db.select().from(users).where(eq(users.phone, normalizedPhone)).get();
  if (!user) {
   logSecurityEvent({ type: 'failed_login', ip: ipFromRequest(req), details: { reason: 'no_user' } });
   return res.status(401).json({ error: 'Invalid credentials' });
  }
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
   logSecurityEvent({ type: 'failed_login', tenantId: user.tenantId ?? undefined, ip: ipFromRequest(req), details: { reason: 'bad_password' } });
   return res.status(401).json({ error: 'Invalid credentials' });
  }
  const tenant = user.tenantId ? await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).get() : null;
  const tokenVersion = (user as any).tokenVersion ?? 0;
  const isSuperadmin = !!(user as any).isSuperadmin;
  // Start a new refresh-token family for this device/session. The family id
  // rides in the refresh JWT (`fam`) so /auth/refresh targets THIS family.
  const parentJti = crypto.randomUUID();
  const childJti = crypto.randomUUID();
  const familyId = crypto.randomUUID();
  await db.insert(refreshTokenFamilies).values({
   id: familyId,
   userId: user.id,
   parentJti,
   childJti,
   createdAt: Date.now(),
   lastUsedAt: Date.now(),
  });
  const token = jwt.sign({ userId: user.id, tenantId: user.tenantId, role: user.role, tokenVersion }, jwtSecret(), { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId: user.id, tenantId: user.tenantId, tokenVersion, jti: childJti, fam: familyId }, refreshSecret(), { expiresIn: '7d' });
  setAuthCookies(res, token, refreshToken);
  res.json({
   message: 'Login successful',
   role: user.role,
   isSuperadmin,
   tenantId: user.tenantId,
   tenant: tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug } : null,
   name: user.name,
   user: {
    id: user.id,
    role: user.role,
    tenantId: user.tenantId,
    tenantSlug: tenant?.slug ?? null,
    name: user.name,
   },
  });
 } catch (error) {
  console.error('Login error:', error);
  res.status(500).json({ error: 'Failed to login' });
 }
});router.post('/refresh', authLimiter, async (req, res) => {
 try {
  const refreshToken = (req as any).cookies?.refreshToken || req.body?.refreshToken;
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' });
  jwt.verify(refreshToken, refreshSecret(), async (err: any, payload: any) => {
   if (err) return res.status(403).json({ error: 'Invalid or expired refresh token' });
   const user = await db.select().from(users).where(eq(users.id, payload.userId)).get();
   if (!user) return res.status(404).json({ error: 'User not found' });
   if (typeof payload.tokenVersion !== 'number' || payload.tokenVersion !== (user as any).tokenVersion) {
   return res.status(403).json({ error: 'Refresh token has been revoked' });
  }
  // Family-based rotation (F-1 approach (a)): the refresh JWT carries a `fam`
  // claim — the id of ITS OWN refresh_token_families row — so each device
  // refreshes against its own family and multi-device sessions coexist.
  // Legacy cookies minted before `fam` existed carry no claim; they fall back
  // to the newest active family (latest-wins) until they naturally expire.
  // Rotate on success; revoke the whole family on mismatch (replay/forgery).
  const presentedChild = typeof payload.jti === 'string' ? payload.jti : '';
  const presentedFam = typeof payload.fam === 'string' ? payload.fam : '';
  const family = await (presentedFam
    ? db.select()
      .from(refreshTokenFamilies)
      .where(and(
        eq(refreshTokenFamilies.id, presentedFam),
        eq(refreshTokenFamilies.userId, user.id),
        sql`${refreshTokenFamilies.revokedAt} IS NULL`,
      ))
      .get()
    : db.select()
      .from(refreshTokenFamilies)
      .where(and(
        eq(refreshTokenFamilies.userId, user.id),
        sql`${refreshTokenFamilies.revokedAt} IS NULL`,
      ))
      .orderBy(desc(refreshTokenFamilies.createdAt))
      .get());
  if (!family || !presentedChild) {
   await db.update(users).set({ tokenVersion: sql`token_version + 1` }).where(eq(users.id, user.id));
   return res.status(403).json({ error: 'Refresh token invalid' });
  }
  if (family.childJti !== presentedChild) {
   await db.update(refreshTokenFamilies).set({ revokedAt: Date.now() }).where(eq(refreshTokenFamilies.id, family.id));
   await db.update(users).set({ tokenVersion: sql`token_version + 1` }).where(eq(users.id, user.id));
   return res.status(403).json({ error: 'Refresh token replay detected — all sessions revoked' });
  }
  const newChildJti = crypto.randomUUID();
  await db.update(refreshTokenFamilies)
   .set({ childJti: newChildJti, lastUsedAt: Date.now() })
   .where(eq(refreshTokenFamilies.id, family.id));
  const tokenVersion = (user as any).tokenVersion ?? 0;
  const newToken = jwt.sign({ userId: user.id, tenantId: user.tenantId, role: user.role, tokenVersion }, jwtSecret(), { expiresIn: '15m' });
  const newRefresh = jwt.sign({ userId: user.id, tenantId: user.tenantId, tokenVersion, jti: newChildJti, fam: family.id }, refreshSecret(), { expiresIn: '7d' });
  setAuthCookies(res, newToken, newRefresh);
  res.json({ success: true });
 });
} catch (error) {
 console.error('Refresh token error:', error);
 res.status(500).json({ error: 'Failed to refresh token' });
}
});// GET /api/auth/me — hydrate the SPA's user context from the session cookie.
router.get('/me', requireAuth(), async (req: any, res) => {
  try {
    const user = await db.select().from(users).where(eq(users.id, req.user.userId)).get();
    if (!user) return res.status(401).json({ error: 'User not found' });
    const tenant = user.tenantId
      ? await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).get()
      : null;
    res.json({
      user: {
        id: user.id,
        role: user.role,
        tenantId: user.tenantId,
        tenantSlug: tenant?.slug ?? null,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await db.select().from(users).where(eq(users.email, email)).get();
    if (!user) {
      // Don't leak user existence
      return res.json({ success: true, message: 'If that email is registered, you will receive a reset link.' });
    }

    await db.delete(passwordResets).where(eq(passwordResets.userId, user.id));

    const token = crypto.randomUUID();
    await db.insert(passwordResets).values({
      id: crypto.randomUUID(),
      token,
      userId: user.id,
      expiresAt: Date.now() + 15 * 60 * 1000 // 15 mins
    });

    const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

  const userWithTenant = await db.select({ tenantId: users.tenantId }).from(users).where(eq(users.id, user.id)).get();
  const tenant = userWithTenant?.tenantId ? await db.select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, userWithTenant.tenantId)).get() : null;
  const settings = (tenant?.settings as any) || {};
  const locale: 'en' | 'am' = String(settings.defaultLocale || 'en').startsWith('am') ? 'am' : 'en';
  const { subject, text } = applyTemplate('passwordReset', locale, { link: resetLink });

  await notify({
    channel: 'email',
    template: 'passwordReset',
    to: { email },
    subject,
    text,
    refType: 'user',
  });

    res.json({ success: true, message: 'If that email is registered, you will receive a reset link.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    // The emailed reset token alone is sufficient — the old password is NOT
    // required so a user who genuinely forgot their password can recover it.
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });

    // Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ 
        error: passwordValidation.error || 'Password does not meet requirements',
        passwordFeedback: passwordValidation.feedback,
        passwordScore: passwordValidation.score,
      });
    }

    const resetRecord = await db.select().from(passwordResets).where(eq(passwordResets.token, token)).get();
    if (!resetRecord) return res.status(400).json({ error: 'Invalid or expired token' });

    if (Date.now() > resetRecord.expiresAt) {
      await db.delete(passwordResets).where(eq(passwordResets.id, resetRecord.id));
      return res.status(400).json({ error: 'Token has expired' });
    }

    const user = await db.select().from(users).where(eq(users.id, resetRecord.userId)).get();
    if (!user) {
      await db.delete(passwordResets).where(eq(passwordResets.id, resetRecord.id));
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    // Increment token_version so every previously-issued access AND refresh
    // token for this user is immediately invalidated.
    await db.update(users).set({
      passwordHash,
      tokenVersion: ((user as any).tokenVersion ?? 0) + 1,
    }).where(eq(users.id, resetRecord.userId));
    await db.delete(passwordResets).where(eq(passwordResets.userId, resetRecord.userId));

    res.json({ success: true, message: 'Password has been updated' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ── SMS OTP routes ───────────────────────────────────────────────

/**
 * POST /api/auth/register-with-phone
 *
 * Initiate phone-based registration. Accepts registration details + phone,
 * sends an OTP via SMS. The frontend then calls POST /api/auth/verify-otp
 * to complete registration.
 *
 * Body: { phone, password, businessName, slug, city, consent }
 */
router.post('/register-with-phone', otpLimiter, async (req, res) => {
  try {
    const { phone, password, businessName, slug, city, consent } = req.body;

    if (!consent || consent !== true) {
      return res.status(400).json({ error: 'You must agree to the Privacy Policy and Terms of Service to register.' });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ error: 'Enter a valid Ethiopian phone number (+251XXXXXXXXX)' });
    }

    const existingUser = await db.select().from(users).where(eq(users.phone, normalizedPhone)).get();
    if (existingUser) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    if (!businessName || typeof businessName !== 'string' || !businessName.trim()) {
      return res.status(400).json({ error: 'Business name is required' });
    }

    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({ error: 'Business URL slug is required' });
    }

    const normalizedSlug = slug.toLowerCase().trim();
    if (RESERVED_SLUGS.includes(normalizedSlug)) {
      return res.status(400).json({ error: 'This business URL is reserved' });
    }

    const existingTenant = await db.select().from(tenants).where(eq(tenants.slug, normalizedSlug)).get();
    if (existingTenant) {
      return res.status(400).json({ error: 'Business URL already taken' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ 
        error: passwordValidation.error || 'Password does not meet requirements',
        passwordFeedback: passwordValidation.feedback,
        passwordScore: passwordValidation.score,
      });
    }

    // Store registration data temporarily in request for verify-otp to use.
    // We use res.locals so the verify handler has access.
    (req as any).registrationData = {
      phone: normalizedPhone,
      password,
      businessName: businessName.trim(),
      slug: normalizedSlug,
      city: typeof city === 'string' && city.trim() ? city.trim() : null,
      consentGivenAt: Date.now(),
    };

    // Generate and send OTP
    await generateOtp(normalizedPhone);

    res.json({
      success: true,
      message: 'Verification code sent to your phone.',
      phone: normalizedPhone,
    });
  } catch (error: any) {
    if (error.statusCode === 429) {
      return res.status(429).json({ error: error.message, code: error.code });
    }
    console.error('Register-with-phone error:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});
/**
 * POST /api/auth/verify-otp
 *
 * Complete registration or password reset by verifying the OTP code.
 * The body must include `intent`: 'register' or 'reset-password'.
 *
 * Body: { phone, code, intent, ...registrationFields }
 * For register: body includes { password, businessName, slug, city, consent }
 * For verify-otp (during register): body includes all registration fields.
 */
router.post('/verify-otp', otpLimiter, async (req, res) => {
  try {
    const { phone, code, intent, password, businessName, slug, city, consent } = req.body;

    if (!intent) {
      return res.status(400).json({ error: 'Intent is required: "register" or "reset-password"' });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ error: 'Enter a valid Ethiopian phone number (+251XXXXXXXXX)' });
    }

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    // Verify the OTP — throws on failure
    await verifyOtp(normalizedPhone, code);

    if (intent === 'register') {
      // ── Complete registration ──────────────────────────────
      if (!consent || consent !== true) {
        return res.status(400).json({ error: 'You must agree to the Privacy Policy and Terms of Service to register.' });
      }
      const consentGivenAt = Date.now();

      const existingUser = await db.select().from(users).where(eq(users.phone, normalizedPhone)).get();
      if (existingUser) {
        return res.status(400).json({ error: 'Phone number already registered' });
      }

      if (!businessName || typeof businessName !== 'string' || !businessName.trim()) {
        return res.status(400).json({ error: 'Business name is required' });
      }
      if (!slug || typeof slug !== 'string') {
        return res.status(400).json({ error: 'Business URL slug is required' });
      }
      const normalizedSlug = slug.toLowerCase().trim();
      if (RESERVED_SLUGS.includes(normalizedSlug)) {
        return res.status(400).json({ error: 'This business URL is reserved' });
      }
      const existingTenant = await db.select().from(tenants).where(eq(tenants.slug, normalizedSlug)).get();
      if (existingTenant) {
        return res.status(400).json({ error: 'Business URL already taken' });
      }

      if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      // Generate a placeholder email from the phone number since the schema
      // requires a unique email. The user can set their email later in settings.
      const placeholderEmail = `user-${normalizedPhone.replace(/\D/g, '')}@egebeya.app`;
      const existingEmail = await db.select().from(users).where(eq(users.email, placeholderEmail)).get();
      if (existingEmail) {
        // Extremely unlikely collision, but handle it
        return res.status(500).json({ error: 'Registration conflict, please try again.' });
      }

      const tenantId = crypto.randomUUID();
      const userId = crypto.randomUUID();
      const passwordHash = await bcrypt.hash(password, 10);
      const trimmedCity = typeof city === 'string' && city.trim() ? city.trim() : null;
      const initialSettings = trimmedCity ? { city: trimmedCity } : {};

      await db.transaction(async (tx) => {
        await tx.insert(tenants).values({
          id: tenantId,
          name: businessName.trim(),
          slug: normalizedSlug,
          isListed: false,
          settings: { ...initialSettings, onboarding_completed: false },
          createdAt: Date.now(),
        });

        await tx.insert(users).values({
          id: userId,
          tenantId,
          name: businessName.trim(),
          phone: normalizedPhone,
          email: placeholderEmail,
          passwordHash,
          role: 'owner',
          consentGivenAt,
          createdAt: Date.now(),
        });

        const plan = await getOrCreateFreePlan();
        await tx.insert(tenantSubscriptions).values({
          id: crypto.randomUUID(),
          tenantId,
          planId: plan.id,
          status: 'trial',
          trialEndsAt: Date.now() + 14 * 24 * 3600 * 1000,
          startsAt: Date.now(),
        });
      });

      const userRecord = await db.select({ tokenVersion: users.tokenVersion }).from(users).where(eq(users.id, userId)).get();
      const tokenVersion = userRecord?.tokenVersion ?? 0;

      const refreshJti = crypto.randomUUID();
      await db.update(users).set({ refreshTokenId: refreshJti }).where(eq(users.id, userId));

      // F-1: seed the first refresh-token family (same as /register).
      const otpFamilyId = crypto.randomUUID();
      await db.insert(refreshTokenFamilies).values({
        id: otpFamilyId,
        userId,
        parentJti: refreshJti,
        childJti: refreshJti,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      });

      const token = jwt.sign({ userId, tenantId, role: 'owner', tokenVersion }, jwtSecret(), { expiresIn: '15m' });
      const refreshToken = jwt.sign({ userId, tenantId, tokenVersion, jti: refreshJti, fam: otpFamilyId }, refreshSecret(), { expiresIn: '7d' });
      setAuthCookies(res, token, refreshToken);

      return res.json({
        message: 'Registration successful',
        role: 'owner',
        tenantId,
        tenant: { id: tenantId, name: businessName.trim(), slug: normalizedSlug },
        name: businessName.trim(),
        isSuperadmin: false,
        user: { id: userId, role: 'owner', tenantId, tenantSlug: normalizedSlug, name: businessName.trim(), phone: normalizedPhone },
      });
    }

    if (intent === 'reset-password') {
      // ── OTP verified — next step is confirm-password-reset ──
      // Generate a temporary token so the confirm endpoint can validate
      const tempToken = crypto.randomUUID();

      // Store the temp token in a way the confirm endpoint can retrieve it.
      // We use a simple approach: store it in the passwordResets table
      // linked to the user, with a short TTL (5 min).
      const user = await db.select().from(users).where(eq(users.phone, normalizedPhone)).get();
      if (!user) {
        return res.status(400).json({ error: 'No account found with this phone number' });
      }

      await db.delete(passwordResets).where(eq(passwordResets.userId, user.id));

      await db.insert(passwordResets).values({
        id: crypto.randomUUID(),
        token: tempToken,
        userId: user.id,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      });

      return res.json({
        success: true,
        message: 'OTP verified. You may now set a new password.',
        resetToken: tempToken,
      });
    }

    return res.status(400).json({ error: 'Invalid intent. Must be "register" or "reset-password".' });
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error('Verify-OTP error:', error);
    res.status(500).json({ error: error.message || 'Failed to verify code' });
  }
});

/**
 * POST /api/auth/reset-password-via-sms
 *
 * Initiate a password reset via SMS. Sends an OTP to the user's phone.
 * The frontend then calls POST /api/auth/verify-otp with intent='reset-password'.
 *
 * Body: { phone }
 */
router.post('/reset-password-via-sms', otpLimiter, async (req, res) => {
  try {
    const { phone } = req.body;

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ error: 'Enter a valid Ethiopian phone number (+251XXXXXXXXX)' });
    }

    const user = await db.select().from(users).where(eq(users.phone, normalizedPhone)).get();
    if (!user) {
      // Don't leak whether the phone exists
      return res.json({ success: true, message: 'If that phone is registered, you will receive a verification code.' });
    }

    await generateOtp(normalizedPhone);

    res.json({
      success: true,
      message: 'If that phone is registered, you will receive a verification code.',
    });
  } catch (error: any) {
    if (error.statusCode === 429) {
      return res.status(429).json({ error: error.message, code: error.code });
    }
    console.error('Reset-password-via-sms error:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

/**
 * POST /api/auth/confirm-password-reset
 *
 * Complete a password reset (after OTP verification). The client must provide
 * the resetToken received from POST /api/auth/verify-otp (intent=reset-password).
 *
 * Body: { resetToken, newPassword }
 */
router.post('/confirm-password-reset', otpLimiter, async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ 
        error: passwordValidation.error || 'Password does not meet requirements',
        passwordFeedback: passwordValidation.feedback,
        passwordScore: passwordValidation.score,
      });
    }

    const resetRecord = await db.select().from(passwordResets).where(eq(passwordResets.token, resetToken)).get();
    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired reset token. Please start the reset process again.' });
    }

    if (Date.now() > resetRecord.expiresAt) {
      await db.delete(passwordResets).where(eq(passwordResets.id, resetRecord.id));
      return res.status(400).json({ error: 'Reset token has expired. Please start the reset process again.' });
    }

    const user = await db.select().from(users).where(eq(users.id, resetRecord.userId)).get();
    if (!user) {
      await db.delete(passwordResets).where(eq(passwordResets.id, resetRecord.id));
      return res.status(400).json({ error: 'User not found' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(users).set({
      passwordHash,
      tokenVersion: ((user as any).tokenVersion ?? 0) + 1,
    }).where(eq(users.id, resetRecord.userId));
    await db.delete(passwordResets).where(eq(passwordResets.userId, resetRecord.userId));

    res.json({ success: true, message: 'Password has been updated' });
  } catch (error: any) {
    if (error.statusCode === 429) {
      return res.status(429).json({ error: error.message, code: error.code });
    }
    console.error('Confirm-password-reset error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

router.post('/logout', csrfProtection, async (req, res) => {
 try {
  const authHeader = req.headers.authorization;
  const cookieToken = (req as any).cookies?.accessToken;
  const token = cookieToken || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);
  if (!token) {
   return res.status(401).json({ error: 'Authentication required' });
  }
  jwt.verify(token, jwtSecret(), async (err: any, payload: any) => {
   if (err) return res.status(401).json({ error: 'Invalid token' });
   // Revoke only the family tied to this refresh token (if we can identify
   // it). Fall back to the legacy single-jti path if no family exists yet
   // (e.g. a user logged in before this deploy).
   const presentedChild = typeof payload.jti === 'string' ? payload.jti : '';
   if (presentedChild) {
    const family = await db.select({ id: refreshTokenFamilies.id })
     .from(refreshTokenFamilies)
     .where(and(
      eq(refreshTokenFamilies.userId, payload.userId),
      eq(refreshTokenFamilies.childJti, presentedChild),
      sql`${refreshTokenFamilies.revokedAt} IS NULL`,
     ))
     .get();
    if (family) {
     await db.update(refreshTokenFamilies).set({ revokedAt: Date.now() }).where(eq(refreshTokenFamilies.id, family.id));
     clearAuthCookies(res);
     return res.json({ success: true });
    }
   }
   // Legacy fallback: no family match found; bump tokenVersion to revoke
   // the current access token family behavior.
   await db.update(users).set({ tokenVersion: sql`token_version + 1` }).where(eq(users.id, payload.userId));
   clearAuthCookies(res);
   res.json({ success: true });
  });
 } catch (error) {
  console.error('Logout error:', error);
  res.status(500).json({ error: 'Failed to logout' });
 }
});export default router;
