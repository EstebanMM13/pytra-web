import {
  REAUTH_REQUIRED_KEY,
  avatarInitial,
  confirmsUsername,
  deleteAccountErrorKey,
  exportErrorKey,
  formatMemberSince,
} from './profile.logic';

const apiError = (status: number, message?: string) => ({ status, error: message ? { message } : null });

describe('deleteAccountErrorKey', () => {
  it('maps the API error codes', () => {
    expect(deleteAccountErrorKey(apiError(400, 'INVALID_PASSWORD'))).toBe('profile.delete.errors.password');
    expect(deleteAccountErrorKey(apiError(400, 'CONFIRMATION_MISMATCH'))).toBe('profile.delete.errors.confirmation');
    expect(deleteAccountErrorKey(apiError(403, 'REAUTH_REQUIRED'))).toBe(REAUTH_REQUIRED_KEY);
    expect(deleteAccountErrorKey(apiError(409, 'SYNC_IN_PROGRESS'))).toBe('profile.delete.errors.syncInProgress');
  });

  it('handles throttling, network and unknown failures', () => {
    expect(deleteAccountErrorKey(apiError(429))).toBe('auth.errors.tooManyRequests');
    expect(deleteAccountErrorKey(apiError(0))).toBe('profile.errors.network');
    expect(deleteAccountErrorKey(apiError(403))).toBe('auth.errors.generic');
    expect(deleteAccountErrorKey(apiError(500))).toBe('auth.errors.generic');
  });
});

describe('exportErrorKey', () => {
  it('maps rate limiting and other failures', () => {
    expect(exportErrorKey(apiError(429, 'EXPORT_RATE_LIMITED'))).toBe('profile.export.rateLimited');
    expect(exportErrorKey(apiError(0))).toBe('profile.errors.network');
    expect(exportErrorKey(apiError(500))).toBe('profile.export.error');
  });
});

describe('confirmsUsername', () => {
  it('compares trimmed and case-insensitively', () => {
    expect(confirmsUsername('  Esteban ', 'esteban')).toBe(true);
    expect(confirmsUsername('esteba', 'esteban')).toBe(false);
    expect(confirmsUsername('', '')).toBe(false);
  });
});

describe('formatMemberSince / avatarInitial', () => {
  it('formats month and year', () => {
    expect(formatMemberSince('2026-07-14T10:00:00', 'es')).toBe('julio de 2026');
    expect(formatMemberSince('2026-07-14T10:00:00', 'en')).toBe('July 2026');
    expect(formatMemberSince(null, 'es')).toBeNull();
    expect(formatMemberSince('nope', 'es')).toBeNull();
  });

  it('uses the first letter, uppercased', () => {
    expect(avatarInitial('esteban')).toBe('E');
    expect(avatarInitial('  ')).toBe('?');
    expect(avatarInitial(null)).toBe('?');
  });
});
