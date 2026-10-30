import {
  ActivityDay,
  GenreAbandonment,
  PlatformYear,
  RatingBucket,
  SagaStat,
} from '../../core/models/stats.model';
import { Params } from '@angular/router';
import { Game } from '../../core/models/game.model';
import { DiaryLevel, intensityLevel } from '../diary/diary.logic';
import { NumberRange, serializeRange } from '../games/play-filters.logic';

/** Fewest runs (completed + abandoned) a genre needs before its abandonment rate is shown. */
export const MIN_ABANDONMENT_SAMPLE = 3;
/** Fewest ratings a genre needs before its average is ranked. */
export const MIN_GENRE_RATINGS = 3;

/** Top of the stored rating scale (ratings are stored 0-10 whatever scale the user picks). */
export const MAX_STORED_RATING = 10;

/** A stored rating as a share (0..1) of the scale, for bar lengths; 0 when unrated. */
export function ratingShare(rating: number | null | undefined): number {
  return (rating ?? 0) / MAX_STORED_RATING;
}

/** Non-empty parts joined with the " · " separator of the stats meta lines. */
export function joinParts(parts: readonly (string | null | undefined | false)[]): string {
  return parts.filter(Boolean).join(' · ');
}

/** A `YYYY-MM-DD` API date as a UTC midnight Date (format with `timeZone: 'UTC'`). */
export function isoToUtcDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** A date falling on `dayOfWeek` (1 Monday .. 7 Sunday), for weekday names: 2024-01-01 was a Monday. */
export function weekdayDate(dayOfWeek: number): Date {
  return new Date(Date.UTC(2024, 0, dayOfWeek));
}

/** Neutral colour for platforms without a catalog colour (and the unassigned online hours). */
export const NEUTRAL_PLATFORM_COLOR = 'var(--pt-platform-neutral)';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** A catalog colour safe for a style binding, else the neutral platform colour. */
export function platformColor(color: string | null | undefined): string {
  return color && HEX_COLOR.test(color) ? color : NEUTRAL_PLATFORM_COLOR;
}

/** Resolves a platform's colour in the stats: its shade (see `platformShades`), else its catalog colour. */
export type PlatformColorOf = (platformId: number, color: string | null | undefined) => string;

/** Without a catalog: every platform keeps its catalog colour. */
export const CATALOG_COLOR: PlatformColorOf = (_id, color) => platformColor(color);

/** Lightness (0..1) band the shades stay in, so every one reads on the light and the dark cards. */
const SHADE_MIN_LIGHTNESS = 0.3;
const SHADE_MAX_LIGHTNESS = 0.76;
/** Widest lightness distance of a shade from its family colour. */
const SHADE_SPREAD = 0.22;

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const channel = (t: number): number => {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const x = ((t % 1) + 1) % 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const hex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${hex(channel(h + 1 / 3))}${hex(channel(h))}${hex(channel(h - 1 / 3))}`;
}

/**
 * Lightness slots of a group of `count` platforms sharing one colour: evenly spread over a band
 * around the base lightness, handed out so that catalog neighbours (PS4, PS5) land far apart
 * (0, then the band's far end, then the middle, ...) and the first platform keeps a value close
 * to the family colour.
 */
export function shadeLightnesses(base: number, count: number): number[] {
  if (count <= 1) return [base];
  const lo = Math.max(SHADE_MIN_LIGHTNESS, Math.min(base, SHADE_MAX_LIGHTNESS) - SHADE_SPREAD);
  const hi = Math.min(SHADE_MAX_LIGHTNESS, Math.max(base, SHADE_MIN_LIGHTNESS) + SHADE_SPREAD);
  const slots = Array.from({ length: count }, (_, i) => lo + ((hi - lo) * i) / (count - 1));
  // Start from the slot closest to the base colour, then alternate between the farthest free slots.
  const order: number[] = [];
  const free = slots.map((_, i) => i);
  let current = free.reduce((best, i) => (Math.abs(slots[i] - base) < Math.abs(slots[best] - base) ? i : best), 0);
  while (free.length) {
    order.push(slots[current]);
    free.splice(free.indexOf(current), 1);
    if (!free.length) break;
    const from = slots[current];
    current = free.reduce((best, i) => (Math.abs(slots[i] - from) > Math.abs(slots[best] - from) ? i : best), free[0]);
  }
  return order;
}

/**
 * Grey the shades of colourless platforms derive from: the neutral platform colour of the dark
 * theme. A lone colourless platform keeps the theme's own neutral (`NEUTRAL_PLATFORM_COLOR`).
 */
const NEUTRAL_SHADE_BASE = '#8a857c';
const NEUTRAL_GROUP = 'neutral';

/**
 * One distinct, deterministic colour per catalog platform: platforms sharing a colour (every
 * PlayStation gets the family blue) get shades of it, in catalog order (sortOrder, then id), with
 * the hue and saturation kept and the lightness varied (see `shadeLightnesses`). Platforms with a
 * colour of their own keep it; platforms without a (valid) colour share the neutral grey, shaded
 * the same way when there are several.
 */
export function platformShades(
  catalog: readonly { id: number; color: string | null; sortOrder?: number | null }[],
): Map<number, string> {
  const groups = new Map<string, { id: number; sortOrder: number }[]>();
  for (const p of catalog) {
    const key = p.color && HEX_COLOR.test(p.color) ? p.color.toLowerCase() : NEUTRAL_GROUP;
    const group = groups.get(key) ?? [];
    group.push({ id: p.id, sortOrder: p.sortOrder ?? Number.MAX_SAFE_INTEGER });
    groups.set(key, group);
  }
  const shades = new Map<number, string>();
  for (const [color, group] of groups) {
    group.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    if (group.length === 1) {
      shades.set(group[0].id, color === NEUTRAL_GROUP ? NEUTRAL_PLATFORM_COLOR : color);
      continue;
    }
    const [h, s, l] = hexToHsl(color === NEUTRAL_GROUP ? NEUTRAL_SHADE_BASE : color);
    const lightness = shadeLightnesses(l, group.length);
    group.forEach((p, i) => shades.set(p.id, hslToHex(h, s, lightness[i])));
  }
  return shades;
}

// ---------------------------------------------------------------------------------------------
// Links to the library
// ---------------------------------------------------------------------------------------------

/** What a stats row filters the library (/games) by; see play-filters.logic for the rules. */
export interface GamesLinkFilter {
  platform?: number;
  genre?: number;
  /** Played year (the section's year scope); null or absent: all time. */
  year?: number | null;
  /** Release decade (first year). */
  decade?: number;
  /** Days to finish a completed run. */
  days?: NumberRange;
  /** Hours of a completed run (max exclusive). */
  hours?: NumberRange;
}

/** Router commands of a library link (with `gamesLinkParams` as its query params). */
export const GAMES_LINK: readonly string[] = ['/games'];

/** Query params of the library for a stats row, in the library's URL format. */
export function gamesLinkParams(filter: GamesLinkFilter): Params {
  const params: Params = {};
  if (filter.platform !== undefined) params['platform'] = String(filter.platform);
  if (filter.genre !== undefined) params['genre'] = String(filter.genre);
  if (filter.year !== undefined && filter.year !== null) params['year'] = String(filter.year);
  if (filter.decade !== undefined) params['decade'] = String(filter.decade);
  if (filter.days) params['days'] = serializeRange(filter.days);
  if (filter.hours) params['hours'] = serializeRange(filter.hours);
  return params;
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

/** Month spans of the two phone heatmap strips (0-based, inclusive): January-June and July-December. */
export const HEATMAP_HALVES = [
  { fromMonth: 0, toMonth: 5 },
  { fromMonth: 6, toMonth: 11 },
] as const;

/** Short weekday names, Monday first (the heatmap row labels). */
export function weekdayShortLabels(locale: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  return Array.from({ length: 7 }, (_, i) => format.format(weekdayDate(i + 1)).replace('.', ''));
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

/** Mean rating (stored scale) from which the user reads as generous, and up to which as strict. */
export const GENEROUS_MEAN = 7.5;
export const STRICT_MEAN = 5.5;
/** Standard deviation (stored scale) below which ratings read as tight, above which as wide. */
export const TIGHT_SPREAD = 1;
export const WIDE_SPREAD = 2;

/** Plain-language read of a mean rating (stored 0-10 scale). */
export function ratingTemperament(mean: number | null | undefined): RatingTemperament | null {
  if (mean === null || mean === undefined) return null;
  if (mean >= GENEROUS_MEAN) return 'generous';
  if (mean <= STRICT_MEAN) return 'strict';
  return 'balanced';
}

/** Plain-language read of the ratings' standard deviation (stored 0-10 scale). */
export function ratingSpread(deviation: number | null | undefined): RatingSpread | null {
  if (deviation === null || deviation === undefined) return null;
  if (deviation < TIGHT_SPREAD) return 'tight';
  if (deviation > WIDE_SPREAD) return 'wide';
  return 'moderate';
}

/** A histogram column: ratings in [from, to) on the stored scale, or exactly 10 when from = to = 10. */
export interface HistogramColumn {
  from: number;
  to: number;
  count: number;
}

/**
 * The API's 21 half-point buckets as drawn: as they are (wide screens), or `grouped` into 11
 * whole-point columns ([0, 1) .. [9, 10) and the perfect 10s) so every column of a phone-width
 * chart can carry its own axis label. Buckets are matched by their bounds, so a partial list
 * (an older API) still adds up.
 */
export function histogramColumns(buckets: readonly RatingBucket[], grouped: boolean): HistogramColumn[] {
  if (!grouped) return buckets.map((b) => ({ from: b.from, to: b.to, count: b.count }));
  const columns: HistogramColumn[] = Array.from({ length: MAX_STORED_RATING + 1 }, (_, i) => ({
    from: i,
    to: i < MAX_STORED_RATING ? i + 1 : i,
    count: 0,
  }));
  for (const b of buckets) {
    columns[Math.min(Math.max(Math.floor(b.from), 0), MAX_STORED_RATING)].count += b.count;
  }
  return columns;
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
export function yearSegments(
  year: PlatformYear,
  maxTotal: number,
  unassignedName: string,
  colorOf: PlatformColorOf = CATALOG_COLOR,
): StackSegment[] {
  const scale = maxTotal > 0 ? 100 / maxTotal : 0;
  const segments: StackSegment[] = year.platforms
    .filter((p) => p.hours > 0)
    .map((p) => ({ key: p.platformId, name: p.name, color: colorOf(p.platformId, p.color), hours: p.hours, width: p.hours * scale }));
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
export function stackLegend(
  years: readonly PlatformYear[],
  colorOf: PlatformColorOf = CATALOG_COLOR,
): { platformId: number; name: string; color: string }[] {
  const totals = new Map<number, { platformId: number; name: string; color: string; hours: number }>();
  for (const year of years) {
    for (const p of year.platforms) {
      const entry = totals.get(p.platformId) ?? { platformId: p.platformId, name: p.name, color: colorOf(p.platformId, p.color), hours: 0 };
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

// ---------------------------------------------------------------------------------------------
// Charts: donut, columns, share bars
// ---------------------------------------------------------------------------------------------

/** One slice of a share chart (donut, stacked share bar). */
export interface ShareSlice {
  key: string | number;
  name: string;
  value: number;
  color: string;
  /** Share (0..1) of the total of every slice. */
  share: number;
}

/**
 * The biggest `limit` items (positive values only, most first) as slices, the rest summed into
 * one `other` slice (left out when it is empty), each with its share of the total.
 */
export function shareSlices(
  items: readonly { key: string | number; name: string; value: number; color: string }[],
  limit: number,
  other: { name: string; color: string },
): ShareSlice[] {
  const sorted = items.filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return [];
  const kept = sorted.length > limit + 1 ? sorted.slice(0, limit) : sorted;
  const rest = sorted.slice(kept.length).reduce((sum, item) => sum + item.value, 0);
  const slices = kept.map((item) => ({ ...item, share: item.value / total }));
  if (rest > 0) slices.push({ key: 'other', name: other.name, value: rest, color: other.color, share: rest / total });
  return slices;
}

/** A share (0..1) as a percentage: whole points, one decimal under 10% so small slices do not read as 0. */
export function percentFormat(locale: string): (share: number) => string {
  const whole = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const fine = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  return (share) => (share < 0.1 ? fine : whole).format(share);
}

/** A donut arc, as fractions (0..1) of the circle: where it starts (clockwise from the top) and its length. */
export interface DonutArc {
  key: string | number;
  color: string;
  start: number;
  length: number;
}

/**
 * Consecutive arcs of the given shares (they should add up to 1), each shortened by `gap` so
 * neighbours stay apart; a lone full slice keeps the whole circle. Slices shorter than the gap
 * are dropped (nothing would be drawn).
 */
export function donutArcs(slices: readonly { key: string | number; color: string; share: number }[], gap = 0): DonutArc[] {
  const drawn = slices.filter((slice) => slice.share > 0);
  const spacing = drawn.length > 1 ? gap : 0;
  const arcs: DonutArc[] = [];
  let start = 0;
  for (const slice of drawn) {
    const length = slice.share - spacing;
    if (length > 0) arcs.push({ key: slice.key, color: slice.color, start: start + spacing / 2, length });
    start += slice.share;
  }
  return arcs;
}

/** Share (0..1) of the finished runs that were completed, null when none was finished or abandoned. */
export function finishRate(completed: number, abandoned: number): number | null {
  const total = completed + abandoned;
  return total > 0 ? completed / total : null;
}

/** Shortest visible column (percent of the chart height), so a count of 1 next to 100 still shows. */
export const MIN_COLUMN_PERCENT = 3;

/** Column heights (0..100) scaled to the largest count: empty columns get 0, others at least `min`. */
export function columnHeights(counts: readonly number[], min = MIN_COLUMN_PERCENT): number[] {
  return shares(counts).map((ratio, i) => (counts[i] > 0 ? Math.max(min, ratio * 100) : 0));
}

/** The items without the empty ones at either end (a histogram spans from its first to its last count). */
export function trimEmptyEnds<T>(items: readonly T[], count: (item: T) => number): T[] {
  const first = items.findIndex((item) => count(item) > 0);
  if (first === -1) return [];
  let last = items.length - 1;
  while (count(items[last]) <= 0) last--;
  return items.slice(first, last + 1);
}

// ---------------------------------------------------------------------------------------------
// Hub teasers: small visuals
// ---------------------------------------------------------------------------------------------

/** Heat level of each of the `count` days up to `today` (YYYY-MM-DD), oldest first. */
export function recentDays(
  days: readonly ActivityDay[],
  today: string,
  count: number,
): { date: string; level: DiaryLevel }[] {
  const byDate = new Map(days.map((day) => [day.date, day.hours]));
  const end = isoToUtcDate(today).getTime();
  return Array.from({ length: count }, (_, i) => {
    const date = isoOf(end - (count - 1 - i) * DAY_MS);
    return { date, level: intensityLevel(byDate.get(date)) };
  });
}

/**
 * The last `count` years up to the most recent one with hours, oldest first, each scaled to the
 * busiest (non-empty years at least `minPercent`).
 */
export function recentYearBars(
  years: readonly { year: number; totalHours: number }[],
  count: number,
  minPercent = MIN_COLUMN_PERCENT,
): { year: number; height: number }[] {
  const played = [...years].filter((y) => y.totalHours > 0).sort((a, b) => a.year - b.year);
  if (!played.length) return [];
  const last = played[played.length - 1].year;
  const hours = new Map(played.map((y) => [y.year, y.totalHours]));
  const span = Array.from({ length: count }, (_, i) => last - count + 1 + i).filter((y) => y >= played[0].year);
  const heights = columnHeights(span.map((y) => hours.get(y) ?? 0), minPercent);
  return span.map((year, i) => ({ year, height: heights[i] }));
}

// ---------------------------------------------------------------------------------------------
// Covers (from the cached library list: the stats endpoints send none)
// ---------------------------------------------------------------------------------------------

/** A game's box art for the stats covers. */
export interface CoverRef {
  id: number;
  name: string;
  url: string | null;
}

/** The library fields the covers need. */
export type CoverSource = Pick<Game, 'id' | 'name' | 'coverImageUrl' | 'totalHours'>;

/**
 * Covers of the games matching `match`, most played first, games with a cover before those
 * without (so a stack shows art when there is any), at most `limit`.
 */
export function topCovers<T extends CoverSource>(games: readonly T[], match: (game: T) => boolean, limit: number): CoverRef[] {
  return games
    .filter(match)
    .sort((a, b) => Number(!a.coverImageUrl) - Number(!b.coverImageUrl) || (b.totalHours ?? 0) - (a.totalHours ?? 0))
    .slice(0, limit)
    .map((game) => ({ id: game.id, name: game.name, url: game.coverImageUrl }));
}

/** A developer name as the covers match it: case and surrounding spaces ignored. */
export function developerKey(developer: string | null | undefined): string {
  return (developer ?? '').trim().toLowerCase();
}

/** Whether a library game is by `developer` (the studio ranking's name; see `developerKey`). */
export function byDeveloper(developer: string): (game: Pick<Game, 'developer'>) => boolean {
  const key = developerKey(developer);
  return (game) => developerKey(game.developer) === key;
}

/**
 * Covers per developer (keyed by `developerKey`), each list as `topCovers` orders it, at most
 * `limit`: one pass over the library for a whole studio ranking.
 */
export function developerCovers<T extends CoverSource & Pick<Game, 'developer'>>(
  games: readonly T[],
  limit: number,
): Map<string, CoverRef[]> {
  const groups = new Map<string, T[]>();
  for (const game of games) {
    const key = developerKey(game.developer);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(game);
    groups.set(key, group);
  }
  return new Map([...groups].map(([key, group]) => [key, topCovers(group, () => true, limit)]));
}

/** The covers when at least one has art, else none (a stack of initials only adds noise). */
export function withArt(covers: CoverRef[]): CoverRef[] {
  return covers.some((cover) => cover.url) ? covers : [];
}

/** Cover url per game id (games without a cover left out). */
export function coverMap(games: readonly CoverSource[]): Map<number, string> {
  return new Map(games.filter((g) => !!g.coverImageUrl).map((g) => [g.id, g.coverImageUrl!]));
}

/** Diary hours per month of `year` (12 values, January first). */
export function monthlyHours(days: readonly ActivityDay[], year: number): number[] {
  const months = Array.from({ length: 12 }, () => 0);
  for (const day of days) {
    const [y, m] = day.date.split('-').map(Number);
    if (y === year && m >= 1 && m <= 12) months[m - 1] += day.hours;
  }
  return months;
}

/**
 * The activity hours trend of `year` as of `today` (YYYY-MM-DD): its months up to today's in the
 * current year (the months to come would drag the line to 0), every month of a past year, none
 * of a future one.
 */
export function hoursTrend(days: readonly ActivityDay[], year: number, today: string): number[] {
  const [thisYear, thisMonth] = today.split('-').map(Number);
  if (year > thisYear) return [];
  const months = monthlyHours(days, year);
  return year === thisYear ? months.slice(0, thisMonth) : months;
}

/** Hours of every year added up (the hub hero's all-time figure). */
export function totalHours(years: readonly { totalHours: number }[]): number {
  return years.reduce((sum, y) => sum + y.totalHours, 0);
}
