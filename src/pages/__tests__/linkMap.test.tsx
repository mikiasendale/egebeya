/**
 * Router link-map guard (#61).
 *
 * Every literal internal link target in src/ (JSX `to="/…"`, `href="/…"`, and
 * object-form `to: '/…'`) must resolve to a STATIC route registered in
 * App.tsx or the dashboard child routes. Deliberately not matching
 * parameterized routes (`/:slug`, `/q/:token`): a literal like '/settings'
 * that only "resolves" via the slug catch-all is a 404 in disguise — that is
 * precisely the bug this guard was born from.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      out.push(...collectSourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function staticRoutes(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/<Route\s+path="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((p) => !p.includes(':') && !p.includes('*'));
}

const appRoutes = staticRoutes(path.join(SRC_DIR, 'App.tsx'));
const dashboardChildren = staticRoutes(path.join(SRC_DIR, 'pages', 'Dashboard', 'index.tsx'));

function linkTargets(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const targets: string[] = [];
  for (const m of source.matchAll(/\b(?:to|href)=(["'])(\/[^"']*)\1/g)) targets.push(m[2]);
  for (const m of source.matchAll(/\bto:\s*(["'])(\/[^"']*)\1/g)) targets.push(m[2]);
  return targets;
}

function isRoutable(target: string): boolean {
  const clean = target.split('?')[0].split('#')[0].replace(/\/$/, '') || '/';
  if (clean === '/dashboard') return true;
  if (clean === '/dashboard/' || clean.startsWith('/dashboard/')) {
    const child = clean.slice('/dashboard'.length) || '/';
    return dashboardChildren.includes(child);
  }
  return appRoutes.includes(clean);
}

describe('router link-map guard', () => {
  it('registers the routes the guard relies on (sanity)', () => {
    expect(appRoutes).toContain('/login');
    expect(dashboardChildren).toContain('/settings');
  });

  it('every literal internal link in src/ resolves to a registered static route', () => {
    const dead = new Set<string>();
    for (const file of collectSourceFiles(SRC_DIR)) {
      for (const target of linkTargets(file)) {
        if (!isRoutable(target)) {
          dead.add(`${target} (${path.relative(SRC_DIR, file)})`);
        }
      }
    }
    expect([...dead]).toEqual([]);
  });
});
