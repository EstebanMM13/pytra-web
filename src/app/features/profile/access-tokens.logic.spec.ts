import { accessTokenErrorKey, formatTokenDate, validTokenName } from './access-tokens.logic';

describe('accessTokenErrorKey', () => {
  it('maps the limit, validation, network and unknown failures', () => {
    expect(accessTokenErrorKey({ status: 409, error: { message: 'ACCESS_TOKEN_LIMIT' } })).toBe(
      'profile.tokens.errors.limit',
    );
    expect(accessTokenErrorKey({ status: 400 })).toBe('profile.tokens.errors.name');
    expect(accessTokenErrorKey({ status: 0 })).toBe('profile.errors.network');
    expect(accessTokenErrorKey({ status: 500 })).toBe('profile.tokens.errors.generic');
  });
});

describe('formatTokenDate', () => {
  it('formats an ISO local date-time per language', () => {
    expect(formatTokenDate('2026-10-24T10:00:00.123456', 'en')).toBe('Oct 24, 2026');
    expect(formatTokenDate('2026-10-24T10:00:00', 'es')).toContain('2026');
  });

  it('returns null for missing or invalid values', () => {
    expect(formatTokenDate(null, 'en')).toBeNull();
    expect(formatTokenDate('not a date', 'en')).toBeNull();
  });
});

describe('validTokenName', () => {
  it('trims and enforces the API limits', () => {
    expect(validTokenName('  Obsidian  ')).toBe('Obsidian');
    expect(validTokenName('   ')).toBeNull();
    expect(validTokenName('n'.repeat(50))).toBe('n'.repeat(50));
    expect(validTokenName('n'.repeat(51))).toBeNull();
  });
});
