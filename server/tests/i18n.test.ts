import { describe, it, expect } from 'vitest';
import en from '../../src/locales/en.json';
import am from '../../src/locales/am.json';

describe('i18n parity (WP2)', () => {
  it('deep-compares en and am locale keys', () => {
    function flatten(prefix: string, value: any): string[] {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return [prefix];
      }

      return Object.entries(value).flatMap(([key, nested]) => flatten(prefix ? `${prefix}.${key}` : key, nested));
    }

    const enKeys = flatten('', en).sort();
    const amKeys = flatten('', am).sort();
    expect(enKeys).toEqual(amKeys);
  });
});
