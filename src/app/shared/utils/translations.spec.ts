import { describe, expect, it } from 'vitest';
import en from '../../../../public/i18n/en.json';
import es from '../../../../public/i18n/es.json';

function flatKeys(node: object, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'object' && value !== null ? flatKeys(value, path) : [path];
  });
}

describe('translation files', () => {
  it('define the same keys in every language', () => {
    expect(flatKeys(en).sort()).toEqual(flatKeys(es).sort());
  });
});
