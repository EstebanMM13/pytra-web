import {
  ActivityDay,
  GenreAbandonment,
  PlatformYear,
  SagaStat,
} from '../../core/models/stats.model';
import { DiaryLevel, intensityLevel } from '../diary/diary.logic';

/** Fewest runs (completed + abandoned) a genre needs before its abandonment rate is shown. */
export const MIN_ABANDONMENT_SAMPLE = 3;
/** Fewest ratings a genre needs before its average is ranked. */
export const MIN_GENRE_RATINGS = 3;

/** Neutral colour for platforms without a catalog colour (and the unassigned online hours). */
export const NEUTRAL_PLATFORM_COLOR = 'var(--pt-platform-neutral)';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** A catalog colour safe for a style binding, else the neutral platform colour. */
export function platformColor(color: string | null | undefined): string {
  return color && HEX_COLOR.test(color) ? color : NEUTRAL_PLATFORM_COLOR;
}

// ---------------------------------------------------------------------------------------------
// Activity heatmap
// ---------------------------------------------------------------------------------------------

/** One day of the heatmap; `row` 0 is Monday. */
export interface HeatCell {
  date: string;
  row: number;
  hours: number;
  gameCount: number;
  level: DiaryLevel;
}

export interface HeatmapMonth {
  /** 0 = January. */
  month: number;
  /** Week column (0-based) holding the month's first day. */
  column: number;
}

/**
 * GitHub-style layout of a span of months: one column per week (Monday on top), so `cells` is
 * column-major with `null` padding before the first day and after the last one (a full grid of
 * `columns * 7` slots for a `grid-auto-flow: column` with 7 rows).
 */
export interface Heatmap {
  columns: number;
  cells: (HeatCell | null)[];
  months: HeatmapMonth[];
}

const DAY_MS = 86_400_000;

function isoOf(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

/** Weekday row of a UTC timestamp: 0 Monday .. 6 Sunday. */
function weekdayRow(time: number): number {
  return (new Date(time).getUTCDay() + 6) % 7;
}

/**
 * Heatmap of `fromMonth`..`toMonth` (0-based, inclusive) of `year`. Days missing from `days` are
 * empty (level 0). Levels follow the diary calendar's scale, so both screens read alike.
 */
export function buildHeatmap(
  year: number,
  days: readonly ActivityDay[],
  fromMonth = 0,
  toMonth = 11,
): Heatmap {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const start = Date.UTC(year, fromMonth, 1);
  const end = Date.UTC(year, toMonth + 1, 0);
  const lead = weekdayRow(start);
  const dayCount = Math.round((end - start) / DAY_MS) + 1;
  const columns = Math.ceil((lead + dayCount) / 7);
  const cells: (HeatCell | null)[] = Array.from({ length: columns * 7 }, () => null);
  const months: HeatmapMonth[] = [];
  for (let i = 0; i < dayCount; i++) {
    const time = start + i * DAY_MS;
    const slot = lead + i;
    const date = isoOf(time);
    const day = byDate.get(date);
    const hours = day?.hours ?? 0;
    cells[slot] = { date, row: slot % 7, hours, gameCount: day?.gameCount ?? 0, level: intensityLevel(hours) };
    if (new Date(time).getUTCDate() === 1) {
      months.push({ month: new Date(time).getUTCMonth(), column: Math.floor(slot / 7) });
    }
  }
  return { columns, cells, months };
}

/** Short weekday names, Monday first (for the weekday bars). */
export function weekdayShortLabels(locale: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, i) => format.format(new Date(Date.UTC(2024, 0, 1 + i))).replace('.', ''));
}

/**
 * Years to pick from on the activity page, most recent first: the years with runs, plus the
 * current year and the one being viewed (diary days may exist without a run in that year).
 */
export function activityYears(years: readonly number[], currentYear: number, viewed: number | null): number[] {
  const all = new Set([...years, currentYear]);
  if (viewed !== null) all.add(viewed);
  return [...all].sort((a, b) => b - a);
}

// ---------------------------------------------------------------------------------------------
// Sample-size filtering
// ---------------------------------------------------------------------------------------------

/** Items with at least `min` samples, in their order, and how many were left out. */
export function splitBySample<T>(
  items: readonly T[],
  size: (item: T) => number,
  min: number,
): { shown: T[]; hidden: number } {
  const shown = items.filter((item) => size(item) >= min);
  return { shown, hidden: items.length - shown.length };
}

/**
 * Genres whose abandonment rate means something (at least `min` completed + abandoned runs),
 * highest rate first, ties by the bigger sample, then by name.
 */
export function abandonmentRanking(
  genres: readonly GenreAbandonment[],
  min = MIN_ABANDONMENT_SAMPLE,
): { shown: GenreAbandonment[]; hidden: number } {
  const { shown, hidden } = splitBySample(genres, (g) => g.completedCount + g.abandonedCount, min);
  const sorted = [...shown].sort(
    (a, b) =>
      b.abandonmentRate - a.abandonmentRate ||
      b.completedCount + b.abandonedCount - (a.completedCount + a.abandonedCount) ||
      a.genreName.localeCompare(b.genreName),
  );
  return { shown: sorted, hidden };
}

// ---------------------------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------------------------

export type RatingTemperament = 'generous' | 'balanced' | 'strict';
export type RatingSpread = 'tight' | 'moderate' | 'wide';

/** Plain-language read of a mean rating (stored 0-10 scale). */
export function ratingTemperament(mean: number | null | undefined): RatingTemperament | null {
  if (mean === null || mean === undefined) return null;
  if (mean >= 7.5) return 'generous';
  if (mean <= 5.5) return 'strict';
  return 'balanced';
}

/** Plain-language read of the ratings' standard deviation (stored 0-10 scale). */
export function ratingSpread(deviation: number | null | undefined): RatingSpread | null {
  if (deviation === null || deviation === undefined) return null;
  if (deviation < 1) return 'tight';
  if (deviation > 2) return 'wide';
  return 'moderate';
}

/** Each count as a share (0..1) of the largest one. */
export function shares(counts: readonly number[]): number[] {
  const max = Math.max(0, ...counts);
  return counts.map((count) => (max > 0 ? count / max : 0));
}

// ---------------------------------------------------------------------------------------------
// Platforms
// ---------------------------------------------------------------------------------------------

export interface StackSegment {
  key: string | number;
  name: string;
  color: string;
  hours: number;
  /** Share (0..100) of the widest year's total. */
  width: number;
}

/**
 * The segments of one year's stacked bar, scaled to `maxTotal` (the busiest year), platforms in
 * their API order and the unassigned online hours last.
 */
export function yearSegments(year: PlatformYear, maxTotal: number, unassignedName: string): StackSegment[] {
  const scale = maxTotal > 0 ? 100 / maxTotal : 0;
  const segments: StackSegment[] = year.platforms
    .filter((p) => p.hours > 0)
    .map((p) => ({ key: p.platformId, name: p.name, color: platformColor(p.color), hours: p.hours, width: p.hours * scale }));
  if (year.unassignedOnlineHours > 0) {
    segments.push({
      key: 'unassigned',
      name: unassignedName,
      color: NEUTRAL_PLATFORM_COLOR,
      hours: year.unassignedOnlineHours,
      width: year.unassignedOnlineHours * scale,
    });
  }
  return segments;
}

/** Platforms appearing in the yearly bars, most hours overall first (the chart legend). */
export function stackLegend(years: readonly PlatformYear[]): { platformId: number; name: string; color: string }[] {
  const totals = new Map<number, { platformId: number; name: string; color: string; hours: number }>();
  for (const year of years) {
    for (const p of year.platforms) {
      const entry = totals.get(p.platformId) ?? { platformId: p.platformId, name: p.name, color: platformColor(p.color), hours: 0 };
      entry.hours += p.hours;
      totals.set(p.platformId, entry);
    }
  }
  return [...totals.values()]
    .filter((p) => p.hours > 0)
    .sort((a, b) => b.hours - a.hours)
    .map(({ platformId, name, color }) => ({ platformId, name, color }));
}

// ---------------------------------------------------------------------------------------------
// Hub teasers
// ---------------------------------------------------------------------------------------------

/** The saga with the most hours (sagas only, not the "no saga" bucket), and how many there are. */
export function sagaTeaser(stats: readonly SagaStat[]): { count: number; top: SagaStat | null } {
  const sagas = stats.filter((s) => s.sagaId !== null);
  const top = sagas.reduce<SagaStat | null>((best, s) => (!best || s.totalHours > best.totalHours ? s : best), null);
  return { count: sagas.length, top };
}

/** Short decade label params: 1990 -> "90" (Spanish "Años 90"), 2000 -> "2000". */
export function decadeParams(decade: number): { decade: number; short: string } {
  return { decade, short: decade < 2000 ? String(decade % 100).padStart(2, '0') : String(decade) };
}
