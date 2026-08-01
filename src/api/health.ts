import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

// GET /api/health — verifies DB connectivity. Returns JSON, never the SPA
// fallback, so monitoring can trust the status code.
router.get('/', async (_req, res) => {
  try {
    await db.run(sql`SELECT 1`);
    res.status(200).json({ status: 'ok', db: 'up' });
  } catch {
    res.status(503).json({ status: 'error', db: 'down' });
  }
});

export default router;
