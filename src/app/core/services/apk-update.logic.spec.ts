import {
  compareVersions,
  dayKey,
  isSnoozed,
  parseLatestRelease,
  progressPercent,
  snoozeValue,
} from './apk-update.logic';

describe('compareVersions', () => {
  it('compares dotted versions numerically', () => {
    expect(compareVersions('1.0.5', '1.0.4')).toBeGreaterThan(0);
    expect(compareVersions('1.0.4', '1.0.5')).toBeLessThan(0);
    expect(compareVersions('1.2.10', '1.2.9')).toBeGreaterThan(0);
    expect(compareVersions('2.0.0', '1.99.99')).toBeGreaterThan(0);
    expect(compareVersions('1.0.4', '1.0.4')).toBe(0);
  });

  it('tolerates a leading "v", missing parts and suffixes', () => {
    expect(compareVersions('v1.0.4', '1.0.4')).toBe(0);
    expect(compareVersions('V1.1', 'v1.0.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.5-beta.1', '1.0.5')).toBe(0);
    expect(compareVersions('1.0.1', '1.0')).toBeGreaterThan(0);
  });
});

describe('parseLatestRelease', () => {
  const apk = { name: 'pytra.apk', browser_download_url: 'https://example.test/pytra.apk' };

  it('reads the version without "v" and the APK asset URL', () => {
    expect(parseLatestRelease({ tag_name: 'v1.0.5', assets: [{ name: 'other.zip' }, apk] })).toEqual({
      version: '1.0.5',
      apkUrl: 'https://example.test/pytra.apk',
    });
  });

  it('returns null for a release without the APK or an unexpected payload', () => {
    expect(parseLatestRelease({ tag_name: 'v1.0.5', assets: [{ name: 'other.zip' }] })).toBeNull();
    expect(parseLatestRelease({ assets: [apk] })).toBeNull();
    expect(parseLatestRelease({ tag_name: 'v1.0.5' })).toBeNull();
    expect(parseLatestRelease({ message: 'API rate limit exceeded' })).toBeNull();
    expect(parseLatestRelease(null)).toBeNull();
  });
});

describe('update snooze', () => {
  const today = new Date(2026, 9, 5, 18, 30);

  it('formats the local day', () => {
    expect(dayKey(today)).toBe('2026-10-05');
  });

  it('suppresses only the same version on the same day', () => {
    const stored = snoozeValue('1.0.5', today);
    expect(isSnoozed(stored, '1.0.5', today)).toBe(true);
    expect(isSnoozed(stored, '1.0.6', today)).toBe(false);
    expect(isSnoozed(stored, '1.0.5', new Date(2026, 9, 6, 8))).toBe(false);
    expect(isSnoozed(null, '1.0.5', today)).toBe(false);
  });
});

describe('progressPercent', () => {
  it('rounds and clamps, with 0 for an unknown size', () => {
    expect(progressPercent(50, 200)).toBe(25);
    expect(progressPercent(1, 3)).toBe(33);
    expect(progressPercent(500, 200)).toBe(100);
    expect(progressPercent(10, 0)).toBe(0);
    expect(progressPercent(10, -1)).toBe(0);
  });
});
