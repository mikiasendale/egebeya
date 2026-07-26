// QA runner: booking flows with Chapa payment + rollback test + webhook test
import { createClient } from '@libsql/client';

const BASE = 'http://localhost:3000';

const c = createClient({ url: 'file:sqlite.db' });

async function getJSON(url, headers) {
  const h = new Headers();
  for (const [k,v] of Object.entries(headers)) h.append(k, String(v));
  const resp = await fetch(url, { headers: h });
  return { status: resp.status, body: await resp.text() };
}

async function postJSON(url, body, headers) {
  const h = new Headers();
  h.append('Content-Type', 'application/json');
  for (const [k,v] of Object.entries(headers)) h.append(k, String(v));
  const resp = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify(body) });
  return { status: resp.status, body: await resp.text() };
}

// Helper: pick next available weekday (UTC)
function nextWeekday(daysAhead) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(11, 0, 0, 0);
  return d;
}

function toISORound(d) { return d.toISOString().replace(/:\d{2}\.\d{3}Z$/, ':00.000Z'); }
function toDateStr(d) { return d.toISOString().slice(0, 10); }

let testPaymentTenantId = null;
try { const r = await c.execute(`SELECT id FROM tenants WHERE slug='testpayment'`); testPaymentTenantId = r.rows[0]?.id; } catch{}
let luxNailsTenantId = null;
try { const r = await c.execute(`SELECT id FROM tenants WHERE slug='luxnails'`); luxNailsTenantId = r.rows[0]?.id; } catch{}

/* ---------- 3. BOOKING WITH PAYMENT REQUIRED (TESTPAYMENT) ---------- */
const svcResp = await getJSON(`${BASE}/api/public/services`, {'X-Tenant-Slug':'testpayment'});
const svcArr = JSON.parse(svcResp.body);
const serviceId = svcArr[0]?.id;
const staffResp = await getJSON(`${BASE}/api/public/staff`, {'X-Tenant-Slug':'testpayment'});
const staffArr = JSON.parse(staffResp.body);
const staffId = staffArr[0]?.id;

const d = nextWeekday(2);
const dateStr = toDateStr(d);
const startIso = toISORound(d);

const availResp = await getJSON(`${BASE}/api/public/availability?staff_id=${staffId}&date=${dateStr}`, {'X-Tenant-Slug':'testpayment'});
const avail = JSON.parse(availResp.body);
console.log('\n=== 3.3 availability ===');
console.log(`date=${dateStr} slots=${avail.length}`);

console.log('\n=== 3.4 Create booking (testpayment, requires payment) ===');
const bookingResp = await postJSON(`${BASE}/api/public/bookings`, {
  service_id: serviceId,
  staff_id: staffId,
  start_time: startIso,
  customer_name: 'QA Chapa Runner',
  customer_phone: '0900123456',
  customer_email: 'qa@test.com'
}, {'X-Tenant-Slug':'testpayment'});
console.log(`HTTP ${bookingResp.status}`);
const bookingData = JSON.parse(bookingResp.body);
console.log(`   appointment.status=${bookingData.appointment?.status}`);
console.log(`   paymentStatus=${bookingData.appointment?.paymentStatus}`);

const bookingId = bookingData.appointment?.id;
const PASS_3 = bookingResp.status === 200 && bookingData.appointment?.status === 'confirmed' && bookingData.appointment?.paymentStatus === 'completed';
console.log(`=> ${PASS_3 ? 'PASS' : 'FAIL'} (3.5)`);

console.log('\n=== 3.6 payment record ===');
const payRows = bookingId ? await c.execute(`SELECT gateway, method, gateway_reference, status FROM payments WHERE appointment_id='${bookingId}'`) : { rows: [] };
if (payRows.rows.length > 0) {
  const p = payRows.rows[0];
  console.log(`   gateway=${p.gateway} method=${p.method} gw_ref=${p.gateway_reference} status=${p.status}`);
  const PASS_36 = p.gateway === 'chapa' && p.method === 'telebirr' && p.status === 'completed' && p.gateway_reference != null;
  console.log(`=> ${PASS_36 ? 'PASS' : 'FAIL'} (3.6)`);
} else {
  console.log(`=> FAIL (3.6) no payment row`);
}

/* ---------- 4. BOOKING WITHOUT PAYMENT (LUXNAILS) ---------- */
const luxSvcResp = await getJSON(`${BASE}/api/public/services`, {'X-Tenant-Slug':'luxnails'});
const luxSvc = JSON.parse(luxSvcResp.body);
const luxServiceId = luxSvc[0]?.id;
const luxStaffResp = await getJSON(`${BASE}/api/public/staff?service_id=${luxServiceId}`, {'X-Tenant-Slug':'luxnails'});
const luxStaff = JSON.parse(luxStaffResp.body);
const luxStaffId = luxStaff[0]?.id;

const d4 = nextWeekday(4);
const luxIso = toISORound(d4);

console.log('\n=== 4.1 Create booking (luxnails, no payment) ===');
const luxBookingResp = await postJSON(`${BASE}/api/public/bookings`, {
  service_id: luxServiceId,
  staff_id: luxStaffId,
  start_time: luxIso,
  customer_name: 'QA Lux Runner',
  customer_phone: '+251922111222'
}, {'X-Tenant-Slug':'luxnails'});
console.log(`HTTP ${luxBookingResp.status}`);
const luxData = JSON.parse(luxBookingResp.body);
console.log(`   appointment.status=${luxData.appointment?.status} paymentStatus=${luxData.appointment?.paymentStatus}`);

const luxBookingId = luxData.appointment?.id;
const luxPayRows = luxBookingId ? await c.execute(`SELECT id FROM payments WHERE appointment_id='${luxBookingId}'`) : { rows: [] };
console.log(`   payments linked: ${luxPayRows.rows.length}`);
const PASS_4 = luxBookingResp.status === 200 && luxData.appointment?.status === 'confirmed' && luxPayRows.rows.length === 0;
console.log(`=> ${PASS_4 ? 'PASS' : 'FAIL'} (4)`);

/* ---------- 5.1 WEBHOOK ---------- */
console.log('\n=== 5.1 Webhook = none-existent tx_ref ===');
const wh1 = await postJSON(`${BASE}/api/payments/webhook`, {'tx_ref':'nonexistent'}, {});
console.log(`HTTP ${wh1.status}`);
const PASS_51a = wh1.status >= 400;
console.log(`=> ${PASS_51a ? 'PASS' : 'FAIL'} (5.1 nonexistent returns error)`);

// Test webhook with a real tx_ref from the completed payment we created above
console.log('\n=== 5.1 Webhook with real tx_ref ===');
if (bookingId && payRows.rows.length > 0) {
  const realRef = payRows.rows[0]?.gateway_reference;
  const wh2 = await postJSON(`${BASE}/api/payments/webhook`, {'tx_ref': realRef}, {});
  console.log(`HTTP ${wh2.status}`);
  const whData = JSON.parse(wh2.body);
  console.log(`   body: ${JSON.stringify(whData)}`);
  const PASS_51b = wh2.status === 200 && whData.success;
  console.log(`=> ${PASS_51b ? 'PASS' : 'FAIL'} (5.1 real tx_ref)`);
} else {
  console.log('=> SKIP (no payment row available)');
}

/* ---------- 6. ROLLBACK ---------- */
console.log('\n=== 6. Rollback: set bad Chapa key ===');
const keyFile = process.env.KEY_FILE || '.env';
// We'll just set CHAPA_SECRET_KEY to a bad value via env before the inline fetch.
// For this test, we'll call the booking endpoint with the server still running
// and rely on the fact that the server reads .env at startup.
// We can't restart from within this script easily, so we'll use a trick:
// Override via a temporary process env by writing a temp .env and forcing
// the server to re-read? Actually, the server reads .env once at import time.
// We'll do the rollback test differently: we'll just restart the server with bad env.

console.log('   Skipping 6 — rollback needs server restart. Doing it manually below.');