const UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/**
 * "hace 2 horas" / "2 hours ago" for an ISO timestamp, using the largest whole unit.
 * Anything under a minute (or in the future) reads as "now". Null for missing/invalid input.
 */
export function formatRelativeTime(
  iso: string | null | undefined,
  locale: string,
  now: Date = new Date(),
): string | null {
  const time = iso ? Date.parse(iso) : Number.NaN;
  if (Number.isNaN(time)) {
    return null;
  }
  const seconds = Math.max(0, Math.round((now.getTime() - time) / 1000));
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, size] of UNITS) {
    if (seconds >= size) {
      return format.format(-Math.floor(seconds / size), unit);
    }
  }
  return format.format(0, 'second');
}

