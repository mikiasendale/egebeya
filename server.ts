import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import path from 'path';
import cron from 'node-cron';
import { createServer as createViteServer } from 'vite';
import apiRoutes from './src/api';
import { ensureSchemaMigrations } from './src/db/migrations';
import { validateProductionEnv } from './src/lib/envGuards';
import { jwtSecret, refreshSecret } from './src/api/middleware/auth';
import { isDbUnavailableError } from './src/db/health';
import { runOnce as runReminders } from './server/cron/sendReminders';
import { runOnce as runWinback } from './server/cron/runWinbackAutomations';
import { expandAllSeries } from './server/cron/expandRecurring';
import { runOnce as runDowngradeExpired } from './server/cron/downgradeExpired';
import { runOnce as runAggregateIntent } from './server/cron/aggregateIntent';

const app = express();
const PORT = Number(process.env.PORT || 3000);
// Dev binds loopback only (the Vite dev server is not hardened for LAN
// exposure); production binds all interfaces. Override with HOST.
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

// Trust the first proxy hop so req.ip / rate-limit keys resolve real client
// IPs behind a CDN/reverse proxy in production. Only enabled when the
// operator explicitly sets behind-proxy=true (Plesk/nginx environment);
// defaults to untrusted (loopback in dev, safe in production without opt-in).
if (process.env['behind-proxy'] === 'true') {
  app.set('trust proxy', 1);
}

// Security headers. CSP is relaxed (but bounded) only where the
// Sandpack/Puck editor forces unsafe-eval/inline; public tenant surfaces get
// a Strict CSP via server/middleware/csp.ts. In dev, CSP stays off so Vite
// HMR works. Override with CSP_DISABLED=true if the editor needs more room.
const SPA_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' ws: wss:",
  "frame-src 'self' blob: data: https:",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');
app.use(helmet({
  contentSecurityPolicy:
    process.env.NODE_ENV === 'production' && process.env.CSP_DISABLED !== 'true'
      ? { directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          'style-src': ["'self'", "'unsafe-inline'", 'https:'],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'font-src': ["'self'", 'data:', 'https:'],
          'connect-src': ["'self'", 'ws:', 'wss:'],
          'frame-src': ["'self'", 'blob:', 'data:', 'https:'],
          'object-src': ["'none'"],
          'base-uri': ["'self'"],
        } }
      : false,
  // The SPA itself can be iframed only from egebeya.et origins (required
  // for the Egebeya widget iframes /book/{slug} to render on the same
  // domain). Cross-origin framing by arbitrary third parties is still
  // blocked. The strictCsp middleware adds an explicit X-Frame-Options:
  // DENY on the public JSON API so admin/tenant surfaces are doubly
  // protected there.
  frameguard: { action: 'sameorigin' },
  referrerPolicy: { policy: 'no-referrer' },
}));

// CORS restricted to local dev, the egebeya.et platform/subdomains, and an
// explicit ALLOWED_ORIGINS allowlist (env, comma-separated). No wildcard.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173')
  .split(',').map((s) => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true); // same-origin, curl, webhooks
    if (allowedOrigins.includes(origin)) return callback(null, true);
    let host: string;
    try {
      host = new URL(origin).hostname;
    } catch {
      return callback(new Error('Bad Origin'));
    }
    const allowed =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === 'egebeya.et' ||
      host.endsWith('.egebeya.et');
    callback(null, allowed);
  },
}));

// Static asset CORS for the `crossorigin` stylesheet preloads Vite injects at
// runtime. Vite's __vitePreload helper creates <link rel="stylesheet"
// crossorigin> for lazily-imported chunk CSS (e.g. the puck editor chunk).
// Browsers fire the `error` event on a crossorigin stylesheet unless the
// response carries Access-Control-Allow-Origin — even for a SAME-origin
// resource. Without this header the preload promise rejects, which bubbles
// into the dynamic import chain and prevents React from mounting (blank page).
// Assets are anonymous (no cookies/credentials), so a permissive ACAO is safe.
app.use('/assets', (_req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  next();
});
app.use('/uploads', (_req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  next();
});

// Parse cookies (httpOnly access/refresh tokens + csrf_token) for the SPA
// session model.
app.use(cookieParser());

// ── CORS for /api/v1 (Developer Marketplace) ─────────────────────────
// Uses ALLOWED_API_ORIGINS env var (comma-separated). No wildcard.
// Mounted BEFORE the JSON body parser so preflight OPTIONS get a quick
// response without needing to parse a body.
const allowedApiOrigins = (process.env.ALLOWED_API_ORIGINS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

if (allowedApiOrigins.length > 0) {
  app.options('/api/v1/*splat', cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      if (allowedApiOrigins.includes(origin)) return callback(null, true);
      callback(null, false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key'],
    maxAge: 86400,
  }));
  app.use('/api/v1', cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      if (allowedApiOrigins.includes(origin)) return callback(null, true);
      callback(null, false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key'],
  }));
}

// Capture the raw request body buffer so the Chapa webhook can HMAC-verify
// the exact bytes the provider signed.
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  },
}));

// API Routes
app.use('/api', apiRoutes);

// Block serving sensitive project files in dev (Vite otherwise happily serves
// sqlite.db, source, and configs from the project root).
const BLOCKED_FILE = /\.(env|db|sqlite|sqlite3|log|lock|cjs)$/i;
const BLOCKED_PATHS = /^\/(\.git|\.env|sqlite\.db|server\.ts|server\.cjs|tsconfig\.json|package\.json|package-lock\.json|bun\.lock|drizzle\.config\.ts|metadata\.json|_secrets_audit\.mjs|_check_tables\.)/i;
app.use((req, res, next) => {
  if (BLOCKED_FILE.test(req.path) || BLOCKED_PATHS.test(req.path)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

// Global JSON error handler — registered LAST so thrown errors (malformed
// JSON, multer rejections, unexpected 500s) become JSON with a generic
// message, never Express's default HTML stack trace.
app.use((err: any, _req: any, res: any, _next: any) => {
  // A database that is unreachable is a deployment/upstream problem, not a
  // bug in our handlers — surface it as a retriable 503 (no stack trace, no
  // 500) with a Retry-After so clients/CDNs can back off.
  if (isDbUnavailableError(err)) {
    return res
      .status(503)
      .set('Retry-After', '30')
      .json({ error: 'Service temporarily unavailable', retryAfter: 30 });
  }
  if (err instanceof multer.MulterError || err?.message === 'Invalid file type' || err?.message === 'Only images are allowed') {
    return res.status(400).json({ error: 'Invalid upload. Please upload a valid image file.' });
  }
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Invalid JSON payload.' });
  }
  console.error('[error]', err);
  res.status(500).json({ error: 'An internal server error occurred.' });
});

async function startServer() {
  // Required secrets: the server refuses to start without them (test mode
  // uses fixed keys). Production additionally validates all critical vars.
  jwtSecret();
  refreshSecret();
  if (process.env.NODE_ENV === 'production') {
    validateProductionEnv();
  }

  // Apply schema migrations on every boot.
  try {
    const added = await ensureSchemaMigrations();
    if (Object.keys(added).length > 0) {
      console.log('[migrations] applied:', JSON.stringify(added));
    }
  } catch (migrateErr) {
    console.error('[migrations] failed:', migrateErr);
  }

  const uploadsPath = path.join(process.cwd(), 'dist', 'uploads');
  app.use('/uploads', express.static(uploadsPath));

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use('/uploads', express.static(path.join(distPath, 'uploads')));
    // Only public assets live under dist (the server bundle is built to
    // dist-server/ so dist/server.cjs is never downloadable).
    app.use(express.static(distPath));
    app.get('*splat', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // ── In-process cron schedules (replaces crontab on Render) ────────
  // Only schedule when running inside the server process (not in tests).
  if (process.env.NODE_ENV !== 'test') {
    // SMS reminders — every 15 minutes.
    cron.schedule('*/15 * * * *', async () => {
      console.log('[CRON] Running SMS Reminders...');
      try {
        await runReminders();
      } catch (e) {
        console.error('[CRON] SMS Reminder failed:', e);
      }
    });

    // Winback automations — daily at 23:00 UTC (02:00 AM Addis Ababa).
    cron.schedule('0 23 * * *', async () => {
      console.log('[CRON] Running Winback Automations...');
      try {
        await runWinback();
      } catch (e) {
        console.error('[CRON] Winback Automations failed:', e);
      }
    });

    // Recurring series expansion — daily at 03:00 UTC (06:00 AM Addis).
    cron.schedule('0 3 * * *', async () => {
      console.log('[CRON] Expanding recurring series...');
      try {
        await expandAllSeries();
      } catch (e) {
        console.error('[CRON] Recurring expansion failed:', e);
      }
    });

    // Downgrade expired subscriptions — daily at 03:05 UTC.
    cron.schedule('5 3 * * *', async () => {
      console.log('[CRON] Downgrading expired subscriptions...');
      try {
        await runDowngradeExpired();
      } catch (e) {
        console.error('[CRON] Downgrade expired failed:', e);
      }
    });

    // Buying intent aggregation — every 2 hours.
    cron.schedule('0 */2 * * *', async () => {
      console.log('[CRON] Aggregating buying intent...');
      try {
        await runAggregateIntent();
      } catch (e) {
        console.error('[CRON] Aggregate intent failed:', e);
      }
    });

    console.log('[CRON] 5 cron jobs scheduled (reminders, winback, expand, downgrade, intent)');
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });
}

startServer();
