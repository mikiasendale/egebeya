import { createClient } from '@libsql/client';

const db = createClient({ url: 'file:sqlite.db' });

async function main() {
  const plansInfo = await db.execute('PRAGMA table_info(plans)');
  console.log('plans:', JSON.stringify(plansInfo.rows));
  const subsInfo = await db.execute('PRAGMA table_info(tenant_subscriptions)');
  console.log('subs:', JSON.stringify(subsInfo.rows));
  const plans = await db.execute('SELECT * FROM plans');
  console.log('plan rows:', JSON.stringify(plans.rows));
  const subs = await db.execute('SELECT * FROM tenant_subscriptions');
  console.log('subscription rows:', JSON.stringify(subs.rows));
}

main().catch((err) => {
  console.error('err', err);
  process.exit(1);
});
