import { Game } from '../../core/models/game.model';
import { Saga } from '../../core/models/saga.model';
import { normalizeText } from '../games/library.logic';

/** Saga figures computed on the client from the games list (one request, no N+1). */
export interface SagaSummary {
  saga: Saga;
  /** Saga games in release order. */
  games: Game[];
  total: number;
  /** Games with at least one run or online hours. */
  played: number;
  hours: number;
  /** Mean of each played game's best rating; null when nothing is rated. */
  avgRating: number | null;
  platinums: number;
  /** Most common developer among the saga's games, if any. */
  studio: string | null;
  firstYear: number | null;
  lastYear: number | null;
  /** Sortable `yyyy-MM-dd` of the saga's most recent run / online activity; null when unknown. */
  lastActivity: string | null;
}

export function releaseYear(game: Game): number | null {
  const match = /^(\d{4})/.exec(game.releaseDate ?? '');
  return match ? Number(match[1]) : null;
}

/** Played: at least one run, or hours without runs (online playtime counts, as in the library). */
export function isPlayed(game: Game): boolean {
  return (game.experienceCount ?? 0) > 0 || (game.totalHours ?? 0) > 0;
}

/**
 * What a saga row says about the game: its last run's status, "Online" when it was only played
 * through online playtime (hours, no runs), else "Sin jugar".
 */
export type SagaGameStatus =
  | { kind: 'run'; status: NonNullable<Game['lastExperienceStatus']> }
  | { kind: 'online' }
  | { kind: 'notPlayed' };

export function sagaGameStatus(game: Game): SagaGameStatus {
  if (game.lastExperienceStatus) return { kind: 'run', status: game.lastExperienceStatus };
  return isPlayed(game) ? { kind: 'online' } : { kind: 'notPlayed' };
}

/** Release order: dated games first by date, undated last; ties by name. */
export function byRelease(a: Game, b: Game): number {
  const ra = a.releaseDate ?? '9999';
  const rb = b.releaseDate ?? '9999';
  return ra.localeCompare(rb) || a.name.localeCompare(b.name);
}

function mostCommon(values: readonly string[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Sortable `yyyy-MM-dd` of a game's latest activity: run or online session date, else its run date,
 * else the end of its last played year.
 */
export function lastActivityKey(game: Game): string | null {
  const date = game.lastActivityAt ?? game.lastPlayedAt;
  if (date) {
    return date.slice(0, 10);
  }
  return game.lastPlayedYear != null ? `${String(game.lastPlayedYear).padStart(4, '0')}-12-31` : null;
}

function latest(keys: readonly (string | null)[]): string | null {
  return keys.reduce<string | null>((a, b) => (b !== null && (a === null || b > a) ? b : a), null);
}

export function summarizeSaga(saga: Saga, allGames: readonly Game[]): SagaSummary {
  const games = allGames
    .filter((g) => g.sagaId === saga.id && g.reviewStatus !== 'PENDING_REVIEW')
    .sort(byRelease);
  const ratings = games.map((g) => g.bestRating).filter((r): r is number => r !== null && r !== undefined);
  const years = games.map(releaseYear).filter((y): y is number => y !== null);
  return {
    saga,
    games,
    total: games.length,
    played: games.filter(isPlayed).length,
    hours: games.reduce((sum, g) => sum + (g.totalHours ?? 0), 0),
    avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    platinums: games.filter((g) => g.hasPlatinum).length,
    studio: mostCommon(games.map((g) => g.developer?.trim() ?? '').filter((d) => !!d)),
    firstYear: years.length ? Math.min(...years) : null,
    lastYear: years.length ? Math.max(...years) : null,
    lastActivity: latest(games.map(lastActivityKey)),
  };
}

/** All sagas with their figures, alphabetically. */
export function summarizeSagas(sagas: readonly Saga[], games: readonly Game[]): SagaSummary[] {
  return sagas
    .map((saga) => summarizeSaga(saga, games))
    .sort((a, b) => a.saga.name.localeCompare(b.saga.name, 'es', { sensitivity: 'base' }));
}

/** "Studio · 2005–2022" (parts omitted when unknown). */
export function sagaMetaLine(summary: SagaSummary): string {
  const { firstYear, lastYear } = summary;
  const years =
    firstYear === null ? null : firstYear === lastYear ? String(firstYear) : `${firstYear}–${lastYear}`;
  return [summary.studio, years].filter((part) => !!part).join(' · ');
}

/** Share of played games, 0–100. */
export function playedPercent(summary: SagaSummary): number {
  return summary.total ? Math.round((summary.played / summary.total) * 100) : 0;
}

/** Sagas list orders; `name` (A–Z) is the default and stays out of the URL. */
export type SagaSort = 'name' | 'hours' | 'rating' | 'completion' | 'recent';

export const SAGA_SORTS: readonly SagaSort[] = ['name', 'hours', 'rating', 'completion', 'recent'];

export const DEFAULT_SAGA_SORT: SagaSort = 'name';

/** The `sort` query param, whitelisted: anything unknown falls back to the default. */
export function parseSagaSort(value: string | null | undefined): SagaSort {
  return (SAGA_SORTS as readonly string[]).includes(value ?? '') ? (value as SagaSort) : DEFAULT_SAGA_SORT;
}

const byName = (a: SagaSummary, b: SagaSummary): number =>
  a.saga.name.localeCompare(b.saga.name, 'es', { sensitivity: 'base' });

/** Descending by a nullable key (nulls last), ties alphabetically. */
function descending<K extends number | string>(key: (s: SagaSummary) => K | null) {
  return (a: SagaSummary, b: SagaSummary): number => {
    const ka = key(a);
    const kb = key(b);
    if (ka !== kb) {
      if (ka === null) return 1;
      if (kb === null) return -1;
      return ka < kb ? 1 : -1;
    }
    return byName(a, b);
  };
}

const SAGA_COMPARATORS: Record<SagaSort, (a: SagaSummary, b: SagaSummary) => number> = {
  name: byName,
  hours: descending((s) => s.hours),
  rating: descending((s) => s.avgRating),
  // Sagas without games have no completion: last.
  completion: descending((s) => (s.total ? s.played / s.total : null)),
  recent: descending((s) => s.lastActivity),
};

export function sortSagas(summaries: readonly SagaSummary[], sort: SagaSort): SagaSummary[] {
  return [...summaries].sort(SAGA_COMPARATORS[sort]);
}

/**
 * Sagas whose name or any of their (confirmed) games' names contain the search text, accent- and
 * case-insensitive like the library search ("pokemon" finds "Pokémon"). Blank text keeps them all.
 */
export function filterSagas(summaries: readonly SagaSummary[], text: string): SagaSummary[] {
  const needle = normalizeText(text);
  if (!needle) {
    return [...summaries];
  }
  return summaries.filter(
    (s) => normalizeText(s.saga.name).includes(needle) || s.games.some((g) => normalizeText(g.name).includes(needle)),
  );
}
