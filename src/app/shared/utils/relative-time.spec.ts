import { formatRelativeTime } from './relative-time';

describe('formatRelativeTime', () => {
  const now = new Date('2026-10-09T12:00:00Z');

  it('uses the largest whole unit', () => {
    expect(formatRelativeTime('2026-10-09T10:00:00Z', 'es-ES', now)).toBe('hace 2 horas');
    expect(formatRelativeTime('2026-10-09T11:55:00Z', 'en-US', now)).toBe('5 minutes ago');
    expect(formatRelativeTime('2026-10-08T12:00:00Z', 'es-ES', now)).toBe('ayer');
  });

  it('reads recent or future timestamps as now', () => {
    expect(formatRelativeTime('2026-10-09T11:59:40Z', 'en-US', now)).toBe('now');
    expect(formatRelativeTime('2026-10-09T13:00:00Z', 'es-ES', now)).toBe('ahora');
  });

  it('returns null for missing or invalid input', () => {
    expect(formatRelativeTime(null, 'es-ES', now)).toBeNull();
    expect(formatRelativeTime('not a date', 'es-ES', now)).toBeNull();
  });
});
