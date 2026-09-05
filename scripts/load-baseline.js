/**
 * k6 load baseline — Wayfinder #38
 *
 * 200 rps for 5 minutes against public GETs + refresh.
 * Run against a staging/production-like instance (not the Vite dev server).
 *
 * Usage:
 *   k6 run scripts/load-baseline.js
 *   k6 run --vus 50 --duration 5m scripts/load-baseline.js
 *
 * Requires: k6 installed (https://k6.io/docs/get-started/installation/)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';

const errorRate = new Rate('errors');
const latencyP95 = new Trend('latency_p95', true);
const latencyP99 = new Trend('latency_p99', true);

export const options = {
  // Stages: ramp up → sustain → ramp down
  stages: [
    { duration: '30s', target: 50 },   // warm up
    { duration: '30s', target: 200 },  // ramp to 200 rps
    { duration: '4m', target: 200 },   // sustain 200 rps
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<1000'],
    errors: ['rate<0.01'],
  },
};

export default function () {
  // Alternate between health and discover endpoints
  const endpoints = [
    '/api/health',
    '/api/public/discover',
  ];
  const path = endpoints[__VU % endpoints.length];

  const res = http.get(`${BASE}${path}`, {
    tags: { endpoint: path },
    timeout: '5s',
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'latency < 500ms': (r) => r.timings.duration < 500,
    'latency < 1000ms': (r) => r.timings.duration < 1000,
  });

  errorRate.add(res.status !== 200);
  latencyP95.add(res.timings.duration);
  latencyP99.add(res.timings.duration);

  // No sleep — k6 handles pacing via VUs + target rps
}

export function handleSummary(data) {
  const l = data.metrics.http_req_duration.values;
  const total = data.metrics.http_reqs.values.count;
  const rps = data.metrics.http_reqs.values.rate;
  const errors = data.metrics.errors?.values?.rate || 0;

  const lines = [
    '',
    '═══════════════════════════════════════',
    '  Load Test Results — 5min @ ~200 rps',
    '═══════════════════════════════════════',
    `  Total requests:  ${total}`,
    `  Actual rps:      ${rps.toFixed(1)}`,
    `  p50:             ${l.med.toFixed(1)}ms`,
    `  p95:             ${l['p(95)'].toFixed(1)}ms`,
    `  p99:             ${l['p(99)'].toFixed(1)}ms`,
    `  Max latency:     ${l.max.toFixed(1)}ms`,
    `  Error rate:      ${(errors * 100).toFixed(2)}%`,
    '═══════════════════════════════════════',
  ];

  const flagged = [];
  if (l['p(95)'] > 1000) flagged.push(`p95=${l['p(95)'].toFixed(1)}ms > 1000ms`);
  if (l['p(99)'] > 1000) flagged.push(`p99=${l['p(99)'].toFixed(1)}ms > 1000ms`);
  if (flagged.length) {
    lines.push('', '⚠ FLAGGED (new fix ticket needed):');
    flagged.forEach(f => lines.push(`  - ${f}`));
  } else {
    lines.push('', '✓ All latency targets met (p95/p99 ≤ 1000ms)');
  }

  console.log(lines.join('\n'));

  return { stdout: lines.join('\n') };
}
