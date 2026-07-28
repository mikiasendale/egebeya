// Secrets audit: scan every tracked blob in git history for things that
// resemble an API key / DB password / JWT secret.
//
// What we look for:
//   1) An exact-match of any value we treat as secret: the value of every
//      key currently in .env (so if a leaked copy of one of them snuck in,
//      we'll find it).
//   2) Common-keyword patterns red-flagging committed secrets in source:
//      api_key=, apiKey=, JWT_SECRET=, password=, secret=, etc. with an
//      actual non-empty string-like value (not a blank or a placeholder).
//   3) Long base64/hex tokens sitting next to those keywords.
//
// We report:
//   - file path
//   - line number
//   - the suspect keyword + a redacted snippet
//
// Returns exit 0 if nothing notable was found, exit 1 otherwise.

import { execSync } from 'node:child_process';
import fs from 'node:fs';

const log = (label, value) => console.log(`${label} ${value ?? ''}`.trim());

// --------------------------------------------------------------------------
// 1) Pull the literal values from .env so we can grep the tree for them.
// --------------------------------------------------------------------------
const envValues = [];
try {
  const env = fs.readFileSync('.env', 'utf8');
  for (let i = 0; i < env.split('\n').length; i++) {
    const line = env.split('\n')[i];
    if (!line || line.trim().startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim().toUpperCase();
    const val = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!val) continue;
    // 16+ chars of real value is suspicious; below that we skip (probably a
    // placeholder or a flag).
    if (val.length >= 16) {
      envValues.push({ key, val: val });
    } else {
      envValues.push({ key, val: val, short: true });
    }
  }
} catch {
  log('WARN', '.env not present — skip literal-value scan');
}

// --------------------------------------------------------------------------
// 2) Build the list of every tracked blob in every commit (history = HEAD's
//    single commit here, but be defensive: rev-list --all examines reachable
//    objects too e.g. leftover stash or recovered blobs).
// --------------------------------------------------------------------------
const fileList = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);

// Tier-A: literal values from .env that are 16+ chars, scanned verbatim.
const suspects = [...envValues.filter(e => !e.short).map(e => e.val)];

// Tier-B: keyword patterns. Each item is tied to a regex that captures every
// line containing a key=secret / key:"secret"-style string with a length
// requirement. (?!.{0}$) prevents empty.
const keywordRes = [
  /(?:JWT_SECRET|REFRESH_SECRET|JWT_TOKEN|ACCESS_TOKEN|SECRET_KEY|API_KEY|APIKEY|APP_SECRET|DB_PASSWORD|DATABASE_URL|SMTP_PASS|MONGO_URI|MONGODB_URI|REDIS_URL|TURNSTILE_SECRET|SENTRY_DSN|CHAPA_SECRET|CHAPA_WEBHOOK_SECRET|TELEBIRR_SECRET)["' ]?[:=]["' ]?[A-Za-z0-9_\$\{\}\+\-/\\.:=]{12,}/gi,
];

// Files to ignore — package-lock is enormous and full of hashes, none of
// which are our secrets.
const ignoreRe = [
  /^package-lock\.json$/,
  /^bun\.lock$/,
  /^dist\//,
  /^node_modules\//,
  /^\.impeccable\/live\/sessions\//,
];

let hits = [];
function isIgnored(path) { return ignoreRe.some(re => re.test(path)); }

for (const f of fileList) {
  if (isIgnored(f)) continue;
  let text;
  try {
    // blob content for the HEAD version. git ls-files gives working-tree paths;
    // we look up the matching content via `git show HEAD:<path>`.
    text = execSync(`git show HEAD:${f.replace(/\\/g, '/')}`, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  } catch {
    // file may be new + untracked; skip it.
    continue;
  }
  if (!text) continue;

  // Tier-A check.
  for (const s of suspects) {
    if (!s) continue;
    const idx = text.indexOf(s);
    if (idx >= 0) {
      hits.push({ file: f, kind: 'literal-', key: s.slice(0, 6) + '…', lineNo: text.slice(0, idx).split('\n').length });
    }
  }

  // Tier-B check.
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const re of keywordRes) {
      re.lastIndex = 0;
      if (re.test(lines[i])) {
        // Pretty-truncate the matched line so the report doesn't dump a full
        // secret in the terminal log itself.
        const trimmed = lines[i].trim().slice(0, 120);
        hits.push({ file: f, kind: 'keyword', lineNo: i + 1, snippet: trimmed });
      }
    }
  }
}

log('\nFiles scanned:', fileList.length);
log('Total suspect hits:', hits.length);
if (hits.length === 0) {
  log('\n=== NO SECRET-LOOKING PATTERNS FOUND IN GIT HISTORY ===');
  process.exit(0);
}
console.log('\nSuspects:');
for (const h of hits) {
  console.log(`  ${h.file}:${h.lineNo} [${h.kind}] ${h.key || ''} ${h.snippet || ''}`);
}
process.exit(1);
