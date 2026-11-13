import type { LibraryCategoryFilter, LibrarySort, LibraryStatusFilter } from '../games/library.logic';
import { InProgressExperience, SagaStat, StatsSummary, TopRatedExperience, YearStat } from '../../core/models/stats.model';

/** One contextual line under the dashboard greeting: i18n key under `dashboard.tagline.*` + params. */
export interface Tagline {
  key: 'longRun' | 'bestYear' | 'platinums' | 'bestRating' | 'thisYear' | 'fallback';
  params: Record<string, string | number>;
}

export interface TaglineInput {
  playing: readonly InProgressExperience[] | null;
  byYear: readonly YearStat[] | null;
  summary: StatsSummary | null;
  topRated: readonly TopRatedExperience[] | null;
  today: Date;
}

/** Minimum days a run must be going on to be worth a mention. */
const LONG_RUN_DAYS = 2;

/** 1-based day of the year in local time. */
export function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getFullYear(), 0, 1);
  const now = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((now - start) / 86_400_000) + 1;
}

/** Whole days between a `yyyy-MM-dd` date and `today` (local calendar days, never negative). */
export function daysSince(isoDate: string, today: Date): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((now - Date.UTC(y, m - 1, d)) / 86_400_000));
}

/** Every tagline the user's data supports, in a stable order. */
export function taglineCandidates({ playing, byYear, summary, topRated, today }: TaglineInput): Tagline[] {
  const out: Tagline[] = [];

  const oldest = (playing ?? [])
    .filter((r) => r.startDate)
    .sort((a, b) => a.startDate!.localeCompare(b.startDate!))[0];
  if (oldest) {
    const days = daysSince(oldest.startDate!, today);
    if (days >= LONG_RUN_DAYS) out.push({ key: 'longRun', params: { days, game: oldest.gameName } });
  }

  const years = (byYear ?? []).filter((y) => y.totalHours > 0);
  if (years.length >= 2) {
    const best = years.reduce((a, b) => (b.totalHours > a.totalHours ? b : a));
    out.push({ key: 'bestYear', params: { year: best.year } });
  }

  if (summary && summary.totalPlatinums > 0) {
    out.push({ key: 'platinums', params: { count: summary.totalPlatinums } });
  }

  const top = topRated?.[0];
  if (top) out.push({ key: 'bestRating', params: { rating: top.rating, game: top.gameName } });

  const current = (byYear ?? []).find((y) => y.year === today.getFullYear());
  if (current && current.totalHours > 0) out.push({ key: 'thisYear', params: { hours: current.totalHours } });

  return out;
}

/** Deterministic daily pick among the applicable taglines; generic fallback when none apply. */
export function pickTagline(input: TaglineInput): Tagline {
  const candidates = taglineCandidates(input);
  if (!candidates.length) return { key: 'fallback', params: {} };
  return candidates[dayOfYear(input.today) % candidates.length];
}

/** A main stat card's destination: the list behind its figure. */
export interface StatLink {
  link: string;
  queryParams: { category?: LibraryCategoryFilter; status?: LibraryStatusFilter; sort?: LibrarySort } | null;
}

export type StatLinkKey = 'games' | 'sagas' | 'runs' | 'singleHours' | 'onlineHours' | 'rating';

/** Library filters use the query params `games.ts` parses (`category`, `status`, `sort`). */
export const STAT_LINKS: Readonly<Record<StatLinkKey, StatLink>> = {
  games: { link: '/games', queryParams: null },
  sagas: { link: '/sagas', queryParams: null },
  runs: { link: '/games', queryParams: null },
  singleHours: { link: '/games', queryParams: { category: 'SINGLEPLAYER', sort: 'hours' } },
  onlineHours: { link: '/games', queryParams: { status: 'ONLINE', sort: 'hours' } },
  rating: { link: '/games', queryParams: { sort: 'rating' } },
};

/**
 * Where a top-rated entry leads: the run's own page, or the game page for online entries (and for
 * runs from an API that does not send `experienceId` yet).
 */
export function topRatedLink(item: TopRatedExperience): (string | number)[] {
  return !item.online && item.experienceId != null
    ? ['/games', item.gameId, 'experiences', item.experienceId]
    : ['/games', item.gameId];
}

/**
 * One entry per game: the API ranks runs, so a game played several times could fill the ranking.
 * Expects `items` best first (as the API sends them) and keeps each game's first entry.
 */
export function bestPerGame(items: readonly TopRatedExperience[], limit: number): TopRatedExperience[] {
  const seen = new Set<number>();
  return items.filter((item) => !seen.has(item.gameId) && !!seen.add(item.gameId)).slice(0, limit);
}

/** Stable `@for` key: the run id, else the game (a game has at most one online entry). */
export function topRatedKey(item: TopRatedExperience): string {
  return item.online ? `online-${item.gameId}` : `run-${item.experienceId ?? `${item.gameId}-${item.runLabel}`}`;
}

/** The small line under each dashboard stat card ("4 en curso", "64 % del total"...). */
export interface StatHints {
  /** Runs in progress (games card). */
  inProgress: number;
  /** Saga with the most hours (sagas card); null without sagas. */
  topSaga: string | null;
  /** Completed runs (runs card). */
  completed: number;
  /** Whole-percent share of all hours; the two shares always add up to 100. */
  singleShare: number | null;
  onlineShare: number | null;
  /** Library games with a rating (rating card); null while the library loads. */
  rated: number | null;
}

/** part / whole clamped to 0..1; null when there is nothing to divide. */
export function share(part: number, whole: number): number | null {
  return whole > 0 && Number.isFinite(part) ? Math.min(1, Math.max(0, part / whole)) : null;
}

export function statHints(
  summary: StatsSummary,
  games: readonly { reviewStatus?: string; bestRating?: number | null }[] | null,
  sagas: readonly SagaStat[] | null,
): StatHints {
  const single = share(summary.totalSingleplayerHours, summary.totalSingleplayerHours + summary.totalOnlineHours);
  const singleShare = single === null ? null : Math.round(single * 100);
  const top = (sagas ?? []).filter((s) => s.sagaId !== null).sort((a, b) => b.totalHours - a.totalHours)[0];
  return {
    inProgress: summary.inProgressCount,
    topSaga: top?.sagaName ?? null,
    completed: summary.completedCount,
    singleShare,
    onlineShare: singleShare === null ? null : 100 - singleShare,
    rated: games ? games.filter((g) => g.reviewStatus !== 'PENDING_REVIEW' && g.bestRating != null).length : null,
  };
}
