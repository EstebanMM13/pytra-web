/** Date helpers for runs (experiences). Dates travel as ISO `yyyy-mm-dd` strings. */

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function parseIsoDate(value: string | null | undefined): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  return match ? { year: +match[1], month: +match[2], day: +match[3] } : null;
}

/** Today as `yyyy-mm-dd` in local time (what a date input expects). */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** `2023-02-25` -> `25/02/2023`; empty values render as an em dash. */
export function formatDayMonthYear(value: string | null | undefined): string {
  const d = parseIsoDate(value);
  if (!d) {
    return '—';
  }
  return `${String(d.day).padStart(2, '0')}/${String(d.month).padStart(2, '0')}/${d.year}`;
}

export type RunDuration = { unit: 'months' | 'days'; count: number };

/**
 * Whole calendar months between two dates (25/02/2023 → 30/06/2024 = 16).
 * Spans shorter than a month are reported in days. Null when a date is missing or the range is inverted.
 */
export function runDuration(start: string | null | undefined, end: string | null | undefined): RunDuration | null {
  const a = parseIsoDate(start);
  const b = parseIsoDate(end);
  if (!a || !b) {
    return null;
  }
  let months = (b.year - a.year) * 12 + (b.month - a.month);
  if (b.day < a.day) {
    months -= 1;
  }
  if (months >= 1) {
    return { unit: 'months', count: months };
  }
  const days = Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000,
  );
  return days >= 0 ? { unit: 'days', count: days } : null;
}

/**
 * Compact period for run rows: `ene – abr 2025` or `mar 2020 – may 2021`.
 * With a single date it renders just that month and year.
 */
export function formatRunPeriod(
  start: string | null | undefined,
  end: string | null | undefined,
  locale = 'es-ES',
): string | null {
  const a = parseIsoDate(start);
  const b = parseIsoDate(end);
  const month = (d: DateParts) =>
    new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' })
      .format(new Date(Date.UTC(d.year, d.month - 1, 1)))
      .replace('.', '');
  if (a && b) {
    return a.year === b.year
      ? a.month === b.month
        ? `${month(b)} ${b.year}`
        : `${month(a)} – ${month(b)} ${b.year}`
      : `${month(a)} ${a.year} – ${month(b)} ${b.year}`;
  }
  const only = b ?? a;
  return only ? `${month(only)} ${only.year}` : null;
}

/** The year a run belongs to, mirroring the API (ExperiencePeriod): stored year, else end date, else start date. */
export function runYear(run: { year: number | null; startDate: string | null; endDate: string | null }): number | null {
  return run.year ?? parseIsoDate(run.endDate)?.year ?? parseIsoDate(run.startDate)?.year ?? null;
}

/** Splits a free-text list (one idea per line, optional `-`/`*`/`+`/`•` bullets) into items. */
export function splitLines(text: string | null | undefined): string[] {
  return (text ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*+•]\s+)?/, '').trim())
    .filter((line) => line.length > 0);
}
