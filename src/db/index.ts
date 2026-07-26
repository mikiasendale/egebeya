import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const client = createClient({
  url: 'file:sqlite.db',
  // Give BEGIN IMMEDIATE up to 5s to wait for a holder of the write lock
  // (this is how two concurrent bookings serialize into one success + one
  // 409 — without busy_timeout, the second transaction would fail with
  // SQLITE_BUSY before getting a chance to re-read the row and detect the
  // conflict). See server/tests/booking-concurrency.test.ts for the proof.
  timeout: 5000,
});

export const db = drizzle(client, { schema });
