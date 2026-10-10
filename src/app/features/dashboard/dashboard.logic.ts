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
