import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
describe('Production escape hatch — upgrade endpoint removed from HTTP surface', () => {
  it('upgrade route is no longer present in pro-site.ts', () => {
    const sourcePath = path.resolve(process.cwd(), 'src/api/pro-site.ts');
    const source = fs.readFileSync(sourcePath, 'utf8');
    expect(source).not.toContain("router.post('/subscription/upgrade'");
  });
  it('grant-trial CLI script exists', () => {
    const scriptPath = path.resolve(process.cwd(), 'scripts/grant-trial.ts');
    expect(fs.existsSync(scriptPath)).toBe(true);
  });
});
