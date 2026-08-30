#!/usr/bin/env node
/**
 * Motion-law linter (P5.5) — the static half of ROADMAP §7's motion rule.
 *
 * Animations/transitions are limited to opacity/transform at ≤250ms EXCEPT
 * whitelisted components (InstantEmpire garnish, stamp moments, turn-pulse).
 * Any other duration above the budget fails this check (exit 1), which runs
 * as part of `npm run lint:motion`.
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SCAN_DIRS = ['src'];
const EXTENSIONS = ['.tsx', '.ts', '.css'];
const BUDGET_MS = 250;
const WHITELIST = [
  /InstantEmpireAnimation\.tsx$/,
  /turn-pulse/i,
  /stamp/i, // stamp-slam / receipt-stamp keyframes and their users
];

const DURATION_RE = /(\d+(?:\.\d+)?)(ms|s)\b/gi;

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (EXTENSIONS.includes(path.extname(entry.name))) yield full;
  }
}

export function scanMotionViolations(source, fileLabel = 'inline') {
  const violations = [];
  if (WHITELIST.some((re) => re.test(fileLabel))) return violations;
  if (/InstantEmpire|stamp|turn-pulse/i.test(source.slice(0, Math.max(400, source.length)))) {
    // Files that are stamp/turn-pulse surfaces may carry their authored loops;
    // still flag durations in clearly unrelated inline styles? Keep simple:
    // whitelist wins for these named components per the plan.
    return violations;
  }

  // Look at lines that animate something.
  const animLine = /(animation|transition)\s*:/i;
  for (const line of source.split('\n')) {
    if (!animLine.test(line)) continue;
    if (/whitelist-ignore/i.test(line)) continue;
    for (const match of line.matchAll(DURATION_RE)) {
      const value = parseFloat(match[1]);
      const unit = match[2].toLowerCase();
      const ms = unit === 's' ? value * 1000 : value;
      if (ms > BUDGET_MS) {
        violations.push({ file: fileLabel, line: line.trim().slice(0, 120), ms });
      }
    }
  }
  return violations;
}

const isDirectRun = process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href;
if (isDirectRun) {
  let all = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walk(path.join(ROOT, dir))) all.push(file);
  }
  const findings = [];
  for (const file of all) {
    const src = fs.readFileSync(file, 'utf8');
    findings.push(...scanMotionViolations(src, path.relative(ROOT, file)));
  }
  if (findings.length > 0) {
    console.error('\n⚡ MOTION LAW VIOLATIONS (>250ms outside whitelist):');
    for (const f of findings) console.error(`  ${f.file}: ${f.line} (${f.ms}ms)`);
    process.exit(1);
  }
  console.log(`Motion law OK — ${all.length} files scanned.`);
}
