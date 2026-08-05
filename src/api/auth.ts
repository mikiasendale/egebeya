import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users, tenants, passwordResets, plans, tenantSubscriptions } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { sendMail } from '../../server/lib/mailer';
import { applyTemplate } from '../../server/lib/mailTemplates';
import { jwtSecret, refreshSecret, requireAuth } from './middleware/auth';
import { csrfProtection } from './middleware/csrf';
import { authLimiter } from '../../server/middleware/rateLimiter';
import { logSecurityEvent, ipFromRequest } from '../../server/lib/securityLog';
import { normalizePhone } from '../lib/phone';

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

// Find (or create) the canonical 'free' plan row.
async function getOrCreateFreePlan() {
  const existing = await db.select().from(plans).where(eq(plans.name, 'free')).get();
  if (existing) return existing;
  const row = { id: crypto.randomUUID(), name: 'free', price: 0, maxStaff: 2, customDomainAllowed: false };
  await db.insert(plans).values(row);
  return row;
}

router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, phone, password, businessName, slug, email, city, consent } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
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

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingEmail = await db.select().from(users).where(eq(users.email, normalizedEmail)).get();
    if (existingEmail) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const existingUser = await db.select().from(users).where(eq(users.phone, normalizedPhone)).get();
    if (existingUser) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    const normalizedSlug = slug.toLowerCase().trim();
    if (RESERVED_SLUGS.includes(normalizedSlug)) {
      return res.status(400).json({ error: 'This business URL is reserved' });
    }

    const existingTenant = await db.select().from(tenants).where(eq(tenants.slug, normalizedSlug)).get();
    if (existingTenant) {
      return res.status(400).json({ error: 'Business URL already taken' });
    }

    const tenantId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);

    const trimmedCity = typeof city === 'string' && city.trim() ? city.trim() : null;
    const initialSettings = trimmedCity ? { city: trimmedCity } : {};

    await db.transaction(async (tx) => {
      await tx.insert(tenants).values({
        id: tenantId,
        name: businessName,
        slug: normalizedSlug,
        settings: initialSettings,
        createdAt: Date.now()
      });

      await tx.insert(users).values({
        id: userId,
        tenantId: tenantId,
        name,
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

    // Mint a fresh refresh-token jti so old/stolen refresh tokens from any
    // previous session become unusable. This is rotated again on every
    // successful /auth/refresh call (see below) — replay-detection lives in
    // the jti-vs-DB check, not in a stateless token.
    const refreshJti = crypto.randomUUID();
    await db.update(users).set({ refreshTokenId: refreshJti }).where(eq(users.id, userId));

    const token = jwt.sign({ userId, tenantId, role: 'owner', tokenVersion }, jwtSecret(), { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId, tenantId, tokenVersion, jti: refreshJti }, refreshSecret(), { expiresIn: '7d' });
    setAuthCookies(res, token, refreshToken);

    res.json({
      message: 'Registration successful',
      role: 'owner',
      tenantId,
      tenant: { id: tenantId, name: businessName, slug: normalizedSlug },
      name,
      isSuperadmin: false,
      user: { id: userId, role: 'owner', tenantId, tenantSlug: normalizedSlug, name, phone: normalizedPhone },
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

    const tenant = user.tenantId
      ? await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).get()
      : null;

    const tokenVersion = (user as any).tokenVersion ?? 0;
    const isSuperadmin = !!(user as any).isSuperadmin;

    // Issue a fresh refresh-token jti on every login so a refresh token from
    // a previous (possibly compromised) session cannot be replayed once the
    // user has logged in again.
    const refreshJti = crypto.randomUUID();
    await db.update(users).set({ refreshTokenId: refreshJti }).where(eq(users.id, user.id));

    const token = jwt.sign({ userId: user.id, tenantId: user.tenantId, role: user.role, tokenVersion }, jwtSecret(), { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId: user.id, tenantId: user.tenantId, tokenVersion, jti: refreshJti }, refreshSecret(), { expiresIn: '7d' });
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
});

router.post('/refresh', authLimiter, async (req, res) => {
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

      // Replay detection — the JWT's `jti` claim must match the user's
      // currently-stored refresh_token_id. When the legitimate client
      // refreshes, we ROTATE the stored id and re-issue tokens below; any
      // token that arrives with the now-stale jti is an attempted replay and
      // is rejected (and the session is fully revoked by bumping
      // tokenVersion so any access-token derived from it is also dead).
      const storedJti = (user as any).refreshTokenId || '';
      if (!payload.jti || typeof payload.jti !== 'string' || payload.jti !== storedJti) {
        await db.update(users)
          .set({ tokenVersion: sql`token_version + 1` })
          .where(eq(users.id, user.id));
        return res.status(403).json({ error: 'Refresh token replay detected — all sessions revoked' });
      }

      const tokenVersion = (user as any).tokenVersion ?? 0;
      // Rotate the refresh-token jti on every successful refresh. The
      // legitimate cookie is updated atomically; any captured copy of the
      // previous refresh token is now invalid for the next /refresh call.
      const newRefreshJti = crypto.randomUUID();
      await db.update(users).set({ refreshTokenId: newRefreshJti }).where(eq(users.id, user.id));

      const newToken = jwt.sign({ userId: user.id, tenantId: user.tenantId, role: user.role, tokenVersion }, jwtSecret(), { expiresIn: '15m' });
      const newRefresh = jwt.sign({ userId: user.id, tenantId: user.tenantId, tokenVersion, jti: newRefreshJti }, refreshSecret(), { expiresIn: '7d' });
      setAuthCookies(res, newToken, newRefresh);

      res.json({ success: true });
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// GET /api/auth/me — hydrate the SPA's user context from the session cookie.
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

  await sendMail({
    to: email,
    subject,
    text,
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

      await db.update(users)
        .set({ tokenVersion: sql`token_version + 1` })
        .where(eq(users.id, payload.userId));

      clearAuthCookies(res);
      res.json({ success: true });
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

export default router;
