import { InProgressExperience, StatsSummary, TopRatedExperience, YearStat } from '../../core/models/stats.model';

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

/**
 * Where a top-rated entry leads: the run's own page, or the game page for online entries (and for
 * runs from an API that does not send `experienceId` yet).
 */
export function topRatedLink(item: TopRatedExperience): (string | number)[] {
  return !item.online && item.experienceId != null
    ? ['/games', item.gameId, 'experiences', item.experienceId]
    : ['/games', item.gameId];
}

/** Stable `@for` key: the run id, else the game (a game has at most one online entry). */
export function topRatedKey(item: TopRatedExperience): string {
  return item.online ? `online-${item.gameId}` : `run-${item.experienceId ?? `${item.gameId}-${item.runLabel}`}`;
}

/** Proportion bar (0..1) of each dashboard stat card, drawn when the card has no per-year sparkline. */
export interface StatMeters {
  /** Games with any run or playtime, of the library. */
  games: number | null;
  /** Games that belong to a saga, of the library. */
  sagas: number | null;
  /** Completed runs, of all runs. */
  runs: number | null;
  /** Singleplayer share of all hours. */
  singleHours: number | null;
  /** Online share of all hours (online playtime has no dates, so no per-year line). */
  onlineHours: number | null;
  /** Average rating on the 0-10 scale. */
  rating: number | null;
}

/** part / whole clamped to 0..1; null when there is nothing to divide. */
export function share(part: number, whole: number): number | null {
  return whole > 0 && Number.isFinite(part) ? Math.min(1, Math.max(0, part / whole)) : null;
}

export function statMeters(
  summary: StatsSummary,
  games: readonly { reviewStatus?: string; sagaId?: number | null; experienceCount?: number | null; totalHours?: number | null }[] | null,
): StatMeters {
  const library = (games ?? []).filter((g) => g.reviewStatus !== 'PENDING_REVIEW');
  const played = library.filter((g) => (g.experienceCount ?? 0) > 0 || (g.totalHours ?? 0) > 0).length;
  const inSaga = library.filter((g) => g.sagaId != null).length;
  const hours = summary.totalSingleplayerHours + summary.totalOnlineHours;
  return {
    games: games ? share(played, library.length) : null,
    sagas: games ? share(inSaga, library.length) : null,
    runs: share(summary.completedCount, summary.totalExperiences),
    singleHours: share(summary.totalSingleplayerHours, hours),
    onlineHours: share(summary.totalOnlineHours, hours),
    rating: summary.averageRating == null ? null : share(summary.averageRating, 10),
  };
}
