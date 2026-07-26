import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users, tenants, passwordResets, plans, tenantSubscriptions } from '../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { sendMail } from '../../server/lib/mailer';
import rateLimit from 'express-rate-limit';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'refresh_supersecret_fallback';

// Ethiopian phone format: +251 followed by 9 digits, e.g. +251911234567.
const PHONE_RE = /^\+251\d{9}$/;
function isValidPhone(value: unknown): boolean {
  return typeof value === 'string' && PHONE_RE.test(value.trim());
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per `window` (here, per 15 minutes)
  message: { error: 'Too many requests, please try again later.' }
});

router.use(authLimiter);

const RESERVED_SLUGS = ['www', 'api', 'admin', 'app', 'mail', 'ftp', 'static', 'cdn', 'blog', 'support', 'help', 'dashboard'];

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

router.post('/register', async (req, res) => {
  try {
    const { name, phone, password, businessName, slug, email, city } = req.body;

    // Email is now required and must be unique — it is the address the
    // forgot-password flow sends the reset link to.
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ error: 'A valid email is required' });
    }

    // Phone must be a valid Ethiopian (+251XXXXXXXXX) number so that
    // downstream SMS / Telebirr push notifications have a real recipient.
    if (!isValidPhone(phone)) {
      return res.status(400).json({
        error: 'Enter a valid Ethiopian phone number (+251XXXXXXXXX)',
      });
    }
    const normalizedPhone = String(phone).trim();

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingEmail = await db.select().from(users).where(eq(users.email, normalizedEmail)).get();
    if (existingEmail) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Check if user exists
    const existingUser = await db.select().from(users).where(eq(users.phone, normalizedPhone)).get();
    if (existingUser) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    const normalizedSlug = slug.toLowerCase().trim();
    if (RESERVED_SLUGS.includes(normalizedSlug)) {
      return res.status(400).json({ error: 'This business URL is reserved' });
    }

    // Check if slug exists
    const existingTenant = await db.select().from(tenants).where(eq(tenants.slug, normalizedSlug)).get();
    if (existingTenant) {
      return res.status(400).json({ error: 'Business URL already taken' });
    }

    const tenantId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);

    // The only bit of tenant settings we collect at signup: an optional city
    // shown on the /discover directory. Stored as settings.city (string or
    // null) rather than as a dedicated column, since `tenants.settings` is a
    // JSON blob already used for require_payment_upfront, calendar_display, etc.
    const trimmedCity = typeof city === 'string' && city.trim() ? city.trim() : null;
    const initialSettings = trimmedCity ? { city: trimmedCity } : {};

    // Create tenant
    await db.insert(tenants).values({
      id: tenantId,
      name: businessName,
      slug: normalizedSlug,
      settings: initialSettings,
      createdAt: Date.now()
    });

    // Create owner user
    await db.insert(users).values({
      id: userId,
      tenantId: tenantId,
      name,
      phone: normalizedPhone,
      email: normalizedEmail,
      passwordHash,
      role: 'owner',
      createdAt: Date.now()
    });

    // Provision a default trial subscription on the cheapest plan so the
    // tenant can immediately use owner-only features (services, staff, etc.)
    let plan = await db.select().from(plans).where(eq(plans.name, 'Basic')).get();
    if (!plan) {
      plan = { id: crypto.randomUUID(), name: 'Basic', price: 0, maxStaff: 2, customDomainAllowed: false } as any;
      await db.insert(plans).values(plan);
    }
    await db.insert(tenantSubscriptions).values({
      id: crypto.randomUUID(),
      tenantId,
      planId: plan.id,
      status: 'trial',
      trialEndsAt: Date.now() + 14 * 24 * 3600 * 1000,
      startsAt: Date.now(),
    });

    const token = jwt.sign({ userId, tenantId, role: 'owner' }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId, tenantId }, REFRESH_SECRET, { expiresIn: '7d' });
    
    res.json({
      token,
      refreshToken,
      role: 'owner',
      tenantId,
      tenant: { id: tenantId, name: businessName, slug: normalizedSlug }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to register' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        error: 'Enter a valid Ethiopian phone number (+251XXXXXXXXX)',
      });
    }
    const normalizedPhone = String(phone).trim();

    const user = await db.select().from(users).where(eq(users.phone, normalizedPhone)).get();
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const tenant = user.tenantId
      ? await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).get()
      : null;

    const token = jwt.sign({ userId: user.id, tenantId: user.tenantId, role: user.role }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId: user.id, tenantId: user.tenantId }, REFRESH_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      refreshToken,
      role: user.role,
      tenantId: user.tenantId,
      tenant: tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug } : null,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' });

    jwt.verify(refreshToken, REFRESH_SECRET, async (err: any, payload: any) => {
      if (err) return res.status(403).json({ error: 'Invalid refresh token' });

      const user = await db.select().from(users).where(eq(users.id, payload.userId)).get();
      if (!user) return res.status(404).json({ error: 'User not found' });

      const newToken = jwt.sign({ userId: user.id, tenantId: user.tenantId, role: user.role }, JWT_SECRET, { expiresIn: '15m' });
      res.json({ token: newToken });
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await db.select().from(users).where(eq(users.email, email)).get();
    if (!user) {
      // Don't leak user existence
      return res.json({ success: true, message: 'If that email is registered, you will receive a reset link.' });
    }

    // Clean up old tokens
    await db.delete(passwordResets).where(eq(passwordResets.userId, user.id));

    const token = crypto.randomUUID();
    await db.insert(passwordResets).values({
      id: crypto.randomUUID(),
      token,
      userId: user.id,
      expiresAt: Date.now() + 15 * 60 * 1000 // 15 mins
    });

    const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    
    await sendMail({
      to: email,
      subject: 'Password Reset Request',
      text: `Hello,\n\nYou requested to reset your password. Click the link below to reset it:\n${resetLink}\n\nThis link expires in 15 minutes.\nIf you did not request this, please ignore this email.`
    });

    res.json({ success: true, message: 'If that email is registered, you will receive a reset link.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    // `oldPassword` provides an additional check on top of the email token:
    // even with a valid token, the user must also know their current password.
    const { token, oldPassword, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });
    if (!oldPassword) return res.status(400).json({ error: 'Current password is required' });

    const resetRecord = await db.select().from(passwordResets).where(eq(passwordResets.token, token)).get();
    if (!resetRecord) return res.status(400).json({ error: 'Invalid or expired token' });
    
    if (Date.now() > resetRecord.expiresAt) {
      await db.delete(passwordResets).where(eq(passwordResets.id, resetRecord.id));
      return res.status(400).json({ error: 'Token has expired' });
    }

    const user = await db.select().from(users).where(eq(users.id, resetRecord.userId)).get();
    if (!user) {
      // Defensive: clean up the dangling token.
      await db.delete(passwordResets).where(eq(passwordResets.id, resetRecord.id));
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    // Verify the current password matches before accepting a new one.
    const oldValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!oldValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(users).set({ passwordHash }).where(eq(users.id, resetRecord.userId));
    await db.delete(passwordResets).where(eq(passwordResets.userId, resetRecord.userId));

    res.json({ success: true, message: 'Password has been updated' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
