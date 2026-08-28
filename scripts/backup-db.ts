/**
 * backup-db.ts (P3.6) — litestream-free off-host backup floor.
 *
 * Uses SQLite's `VACUUM INTO` to produce a compact, fully-restorable
 * snapshot of the live database without stopping the server. The output is
 * a plain SQLite file: restore = point DATABASE_URL at it.
 *
 * Env:
 *   DATABASE_URL              libsql url; 'file:' paths are backed up locally.
 *                             (Turso/remote urls: run this ON the host that
 *                             can see the file, or extend with the remote
 *                             dump API — stub below.)
 *   BACKUP_DIR                target dir (default storage/backups)
 *   OPS_BACKUP_UPLOAD_CMD     optional upload hook, e.g.
 *                             "rclone copy {} remote:egebeya-backups" — '{}'
 *                             is replaced with the snapshot path. STUBBED in
 *                             v1: when unset we log the skip and exit 0 so a
 *                             local-only backup still counts as success.
 *
 * Usage: npm run backup  (wire into crontab daily + after billing windows)
 */
import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

export interface BackupResult {
  ok: boolean;
  file?: string;
  bytes?: number;
  uploaded?: boolean;
  error?: string;
}

export function resolveDbFile(): string {
  const url = process.env.DATABASE_URL || 'file:sqlite.db';
  if (!url.startsWith('file:')) {
    throw new Error(`Non-file DATABASE_URL (${url.replace(/:[^@]*@/, ':***@')}) is not supported by the local backup path yet`);
  }
  return url.slice('file:'.length) || 'sqlite.db';
}


/**
 * Produce a timestamped restorable snapshot. Exported for the round-trip
 * test which runs it against a temp-dir fixture database.
 */
export async function backupDb(opts: { dbFile?: string; backupDir?: string } = {}): Promise<BackupResult> {
  try {
    const dbFile = opts.dbFile ?? resolveDbFile();
    const backupDir = opts.backupDir ?? (process.env.BACKUP_DIR || 'storage/backups');

    // Refuse to "back up" a file that doesn't exist — libsql would silently
    // create an empty database and VACUUM it into a useless snapshot.
    if (!fs.existsSync(dbFile)) {
      return { ok: false, error: `source database not found: ${dbFile}` };
    }

    fs.mkdirSync(backupDir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const target = path.join(backupDir, `egebeya-${stamp}.db`);
    // Never overwrite an existing snapshot (clock collisions in tests).
    const finalTarget = fs.existsSync(target) ? `${target}-${process.pid}` : target;

    const client = createClient({ url: `file:${dbFile}` });
    try {
      await client.execute(`VACUUM INTO '${finalTarget.replace(/'/g, "''")}'`);
    } finally {
      client.close();
    }

    const bytes = fs.statSync(finalTarget).size;
    console.log(`[backup] wrote ${finalTarget} (${(bytes / 1024).toFixed(1)} KiB)`);

    // Off-host upload hook. Stubbed unless OPS_BACKUP_UPLOAD_CMD is set.
    const uploadCmd = process.env.OPS_BACKUP_UPLOAD_CMD?.trim();
    let uploaded = false;
    if (uploadCmd) {
      const cmd = uploadCmd.includes('{}')
        ? uploadCmd.replace('{}', finalTarget)
        : `${uploadCmd} ${finalTarget}`;
      const [bin, ...args] = cmd.split(/\s+/);
      execFileSync(bin, args, { stdio: 'inherit' });
      uploaded = true;
      console.log('[backup] upload hook completed');
    } else {
      console.log('[backup] OPS_BACKUP_UPLOAD_CMD not set — snapshot kept local only (stub)');
    }

    return { ok: true, file: finalTarget, bytes, uploaded };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

const isDirectRun = process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href;
if (isDirectRun && process.env.NODE_ENV !== 'test') {
  backupDb().then((result) => {
    if (!result.ok) {
      console.error('[backup] FAILED:', result.error);
      process.exit(1);
    }
    process.exit(0);
  });
}
