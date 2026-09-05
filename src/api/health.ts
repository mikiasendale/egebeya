import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

async function checkSmtp(): Promise<boolean> {
  if (!process.env.SMTP_HOST) return false;
  try {
    const net = await import('net');
    return await new Promise((resolve) => {
      const socket = net.createConnection(
        { host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 587 },
        () => { socket.destroy(); resolve(true); },
      );
      socket.setTimeout(2000);
      socket.on('error', () => resolve(false));
      socket.on('timeout', () => { socket.destroy(); resolve(false); });
    });
  } catch {
    return false;
  }
}

async function checkChapa(): Promise<boolean> {
  if (!process.env.CHAPA_SECRET_KEY) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://api.chapa.co/v1/banks', {
      headers: { Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

// GET /api/health — verifies DB connectivity. Returns JSON, never the SPA
// fallback, so monitoring can trust the status code. Optional non-critical
// checks (smtp, chapa) are reported as booleans but never block the 200.
router.get('/', async (_req, res) => {
  try {
    await db.run(sql`SELECT 1`);
    const [smtp, chapa] = await Promise.all([checkSmtp(), checkChapa()]);
    res.status(200).json({ status: 'ok', db: 'up', smtp, chapa });
  } catch {
    res.status(503).json({ status: 'error', db: 'down', smtp: false, chapa: false });
  }
});

export default router;
