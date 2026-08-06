import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient({
  url: url || 'file:sqlite.db',
  // When connecting to Turso over the network, pass the auth token.
  ...(authToken ? { authToken } : {}),
  // Give BEGIN IMMEDIATE up to 5s to wait for a holder of the write lock
  // (this is how two concurrent bookings serialize into one success + one
  // 409 — without busy_timeout, the second transaction would fail with
  // SQLITE_BUSY before getting a chance to re-read the row and detect the
  // conflict). See server/tests/booking-concurrency.test.ts for the proof.
  // Local file: timeouts are handled by libSQL; Turso: network-aware via SDK.
  timeout: url ? 10000 : 5000,
});

export const db = drizzle(client, { schema });
