import { createClient } from '@libsql/client';
const c = createClient({ url: 'file:sqlite.db' });
const r = await c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
for (const row of r.rows) console.log(row.name);
console.log('--- processed_webhook_events columns ---');
try {
  const cols = await c.execute("PRAGMA table_info(processed_webhook_events)");
  for (const row of cols.rows) console.log(row.name, row.type);
} catch (e) {
  console.log('table does not exist:', e.message);
}
