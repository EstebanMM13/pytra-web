import { Game } from '../../core/models/game.model';
import { OnlineYearFact, PlayFacts, RunFact } from '../../core/models/stats.model';

/**
 * Library filters that look at the runs (and online play years) behind a game, so a stats row can
 * link to "the games behind this figure". They follow the stats rules exactly: the played year is
 * ExperiencePeriod.yearOf (sent by the API), days to finish are the completion stats' (completed
 * runs with both dates), and run hours are bucketed like "Duration vs rating" (completed runs,
 * `min <= hours < max`).
 *
 * Game level vs run level: the stats count runs, the library lists games. A game matches when ANY
 * of its runs satisfies every active run filter at once (year, platform, days, hours on the same
 * run), so "PS5 in 2024" means a PS5 run of 2024, not a PS5 run plus some 2024 run. Online play
 * (diary hours counted into online playtime) only satisfies the year filter, optionally with the
 * platforms of the game's online playtime, never days or hours.
 */

/** A closed `min..max` range of whole numbers; `max` null means open-ended. */
export interface NumberRange {
  min: number;
  max: number | null;
}

/** Run filters from the URL; all null: inactive. */
export interface PlayFilters {
  /** Played year (`year=2024`). */
  year: number | null;
  /** Days from start to end of a completed run, both ends inclusive (`days=8-30`, `days=366-`). */
  days: NumberRange | null;
  /** Hours of a completed run, `min <= hours < max` like the API buckets (`hours=10-30`, `hours=60-`). */
  runHours: NumberRange | null;
}

export const NO_PLAY_FILTERS: PlayFilters = { year: null, days: null, runHours: null };

export function hasPlayFilters(filters: PlayFilters): boolean {
  return filters.year !== null || filters.days !== null || filters.runHours !== null;
}

/** Number of active run filters (for the filter button's count). */
export function playFilterCount(filters: PlayFilters): number {
  return (filters.year !== null ? 1 : 0) + (filters.days ? 1 : 0) + (filters.runHours ? 1 : 0);
}

/** `year=` of the library: a plausible 4-digit year, else null. */
export function parsePlayedYear(value: string | null | undefined): number | null {
  if (!value || !/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return year >= 1970 && year <= 2999 ? year : null;
}

/** `min-max` or `min-` (open-ended) with whole numbers, `min <= max`; anything else is null. */
export function parseRange(value: string | null | undefined): NumberRange | null {
  const match = /^(\d{1,5})-(\d{1,5})?$/.exec(value ?? '');
  if (!match) return null;
  const min = Number(match[1]);
  const max = match[2] !== undefined ? Number(match[2]) : null;
  return max !== null && max < min ? null : { min, max };
}

/** URL form of a range (`8-30`, `366-`); null (param removed) without one. */
export function serializeRange(range: NumberRange | null | undefined): string | null {
  return range ? `${range.min}-${range.max ?? ''}` : null;
}

/** A range from an API bucket (`maxDays` / `maxHours` null: open-ended). */
export function bucketRange(min: number, max: number | null | undefined): NumberRange {
  return { min: Math.round(min), max: max === null || max === undefined ? null : Math.round(max) };
}

/** `decade=1990`: a year ending in 0 between 1950 and 2990, else null. */
export function parseDecade(value: string | null | undefined): number | null {
  if (!value || !/^\d{4}$/.test(value)) return null;
  const decade = Number(value);
  return decade % 10 === 0 && decade >= 1950 && decade <= 2990 ? decade : null;
}

/** `released=1998`: a release year from 1950 to 2999, else null. */
export function parseReleaseYear(value: string | null | undefined): number | null {
  if (!value || !/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return year >= 1950 ? year : null;
}

/** Released in `year`; no year picked: every game. */
export function matchesReleaseYear(game: Pick<Game, 'releaseDate'>, year: number | null | undefined): boolean {
  if (year === null || year === undefined) return true;
  return Number(/^(\d{4})/.exec(game.releaseDate ?? '')?.[1]) === year;
}

/** Released in `decade` (its first year .. first year + 9); no decade picked: every game. */
export function matchesDecade(game: Pick<Game, 'releaseDate'>, decade: number | null | undefined): boolean {
  if (decade === null || decade === undefined) return true;
  const year = Number(/^(\d{4})/.exec(game.releaseDate ?? '')?.[1]);
  return Number.isInteger(year) && year >= decade && year <= decade + 9;
}

/** A game's runs and online play years. */
export interface GamePlay {
  runs: RunFact[];
  online: OnlineYearFact[];
}

/** Play facts grouped by game id. */
export type PlayIndex = ReadonlyMap<number, GamePlay>;

export function buildPlayIndex(facts: PlayFacts): PlayIndex {
  const index = new Map<number, GamePlay>();
  const entry = (gameId: number): GamePlay => {
    let play = index.get(gameId);
    if (!play) {
      play = { runs: [], online: [] };
      index.set(gameId, play);
    }
    return play;
  };
  for (const run of facts.runs ?? []) entry(run.gameId).runs.push(run);
  for (const online of facts.onlineYears ?? []) entry(online.gameId).online.push(online);
  return index;
}

function inClosed(value: number, range: NumberRange): boolean {
  return value >= range.min && (range.max === null || value <= range.max);
}

function inHalfOpen(value: number, range: NumberRange): boolean {
  return value >= range.min && (range.max === null || value < range.max);
}

/** The run satisfies every active run filter (and, when platforms are picked, is on one of them). */
export function runMatches(run: RunFact, filters: PlayFilters, platforms: readonly string[] = []): boolean {
  return (
    (filters.year === null || run.year === filters.year) &&
    (!platforms.length || (run.platformId !== null && platforms.includes(String(run.platformId)))) &&
    (!filters.days || (run.daysToFinish !== null && run.daysToFinish !== undefined && inClosed(run.daysToFinish, filters.days))) &&
    (!filters.runHours || (run.status === 'COMPLETADO' && inHalfOpen(run.hours ?? 0, filters.runHours)))
  );
}

/**
 * Whether the game passes the run filters: inactive filters pass everything; active ones need the
 * game's play facts (a game without any fails). `platforms` (picked platform ids) are checked on
 * the same run or online year, see the module comment.
 */
export function matchesPlay(
  play: GamePlay | undefined,
  filters: PlayFilters,
  platforms: readonly string[] = [],
): boolean {
  if (!hasPlayFilters(filters)) return true;
  if (!play) return false;
  if (play.runs.some((run) => runMatches(run, filters, platforms))) return true;
  // Online play counts for the played year alone (it has no days to finish nor run hours).
  return (
    filters.year !== null &&
    !filters.days &&
    !filters.runHours &&
    play.online.some(
      (o) => o.year === filters.year && (!platforms.length || o.platformIds.some((id) => platforms.includes(String(id)))),
    )
  );
}
