import { Game } from '../../core/models/game.model';
import { Saga } from '../../core/models/saga.model';

/** Saga figures computed on the client from the games list (one request, no N+1). */
export interface SagaSummary {
  saga: Saga;
  /** Saga games in release order. */
  games: Game[];
  total: number;
  /** Games with at least one run. */
  played: number;
  hours: number;
  /** Mean of each played game's best rating; null when nothing is rated. */
  avgRating: number | null;
  platinums: number;
  /** Most common developer among the saga's games, if any. */
  studio: string | null;
  firstYear: number | null;
  lastYear: number | null;
}

export function releaseYear(game: Game): number | null {
  const match = /^(\d{4})/.exec(game.releaseDate ?? '');
  return match ? Number(match[1]) : null;
}

export function isPlayed(game: Game): boolean {
  return (game.experienceCount ?? 0) > 0;
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
