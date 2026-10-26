import { ExperienceStatus } from '../../core/models/experience.model';
import { YearStat, YearSummary } from '../../core/models/stats.model';
import { MiniBar } from '../../shared/ui/mini-bar-chart';

/** Pure helpers behind the yearly summary page. */

/** Rows of the "Más jugados" ranking (the API's top 5 by run hours). */
export const MOST_PLAYED_LIMIT = 5;

/** A "Más jugados" row: run hours of the year plus, for online games, their diary hours of the year. */
export interface YearPlayedGame {
  gameId: number;
  gameName: string;
  totalHours: number;
  /** Has online diary hours in the year. */
  online: boolean;
}

/**
 * "Más jugados": the API's run-based ranking merged with the year's online games (diary hours), so a
 * year of online play shows what was played. A game in both lists sums its hours. Top
 * {@link MOST_PLAYED_LIMIT} by hours; ties keep runs first.
 */
export function yearMostPlayed(
  summary: Pick<YearSummary, 'mostPlayed' | 'onlineGames'> | null,
): YearPlayedGame[] {
  if (!summary) return [];
  const byGame = new Map<number, YearPlayedGame>();
  for (const g of summary.mostPlayed) {
    byGame.set(g.gameId, { gameId: g.gameId, gameName: g.gameName, totalHours: g.totalHours, online: false });
  }
  for (const g of summary.onlineGames ?? []) {
    const row = byGame.get(g.gameId);
    if (row) {
      row.totalHours += g.hours;
      row.online = true;
    } else {
      byGame.set(g.gameId, { gameId: g.gameId, gameName: g.gameName, totalHours: g.hours, online: true });
    }
  }
  return [...byGame.values()].sort((a, b) => b.totalHours - a.totalHours).slice(0, MOST_PLAYED_LIMIT);
}

const MONTHS: Record<'es' | 'en', readonly string[]> = {
  es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

/** Month labels, January first: `short` (Ene…Dic, web) or `initial` (E F M…, mobile). */
export function monthLabels(lang: string, style: 'short' | 'initial'): string[] {
  const names = MONTHS[lang === 'en' ? 'en' : 'es'];
  return style === 'short' ? [...names] : names.map((name) => name.charAt(0));
}

/**
 * GOTY cover: the one the API sends with it, else looked up in the year's runs (older APIs). The
 * lookup alone missed GOTYs completed in the year but attributed to another year (e.g. a run with
 * `year` 2025 finished in 2026 is not among 2026's runs).
 */
export function gotyCoverUrl(summary: Pick<YearSummary, 'goty' | 'experiences'> | null): string | null {
  const goty = summary?.goty;
  if (!goty) return null;
  return (
    goty.coverImageUrl ||
    summary.experiences.find((e) => e.gameId === goty.gameId && e.coverImageUrl)?.coverImageUrl ||
    null
  );
}

/**
 * Covers of the games the year mentions, by game id, for the lists whose rows carry none ("Más
 * jugados", surprises, disappointments): the GOTY and top-rated covers the API sends, the year's
 * runs, then its online games. The first cover found for a game wins.
 */
export function yearCoverMap(
  summary: Pick<YearSummary, 'goty' | 'topRated' | 'experiences' | 'onlineGames'> | null,
): Map<number, string> {
  const covers = new Map<number, string>();
  if (!summary) return covers;
  const add = (gameId: number, url: string | null | undefined): void => {
    if (url && !covers.has(gameId)) covers.set(gameId, url);
  };
  if (summary.goty) add(summary.goty.gameId, summary.goty.coverImageUrl);
  for (const g of summary.topRated) add(g.gameId, g.coverImageUrl);
  for (const e of summary.experiences) add(e.gameId, e.coverImageUrl);
  for (const g of summary.onlineGames ?? []) add(g.gameId, g.coverImageUrl);
  return covers;
}

/** Monthly hours (January first) for the hours card's sparkline; null when no month has hours. */
export function monthHoursTrend(months: readonly { month: number; hours: number }[]): number[] | null {
  const values = [...months].sort((a, b) => a.month - b.month).map((m) => m.hours);
  return values.some((h) => h > 0) ? values : null;
}

/** Bars of the "Horas por mes" chart: one per month, hours under each label (none for empty months). */
export function monthHourBars(
  months: readonly { month: number; hours: number }[],
  labels: readonly string[],
): MiniBar[] {
  return months.map((m) => ({
    key: m.month,
    value: m.hours,
    label: labels[m.month - 1] ?? String(m.month),
    subLabel: monthValueLabel(m.hours) || null,
    // Same wording as the visible label ("12h", "<1h"); empty months read "0h".
    title: `${labels[m.month - 1] ?? m.month}: ${monthValueLabel(m.hours) || '0h'}`,
  }));
}

/** Year number from a route param, or null when it is not a plausible year. */
export function parseYearParam(value: string | null | undefined): number | null {
  if (!value || !/^\d{4}$/.test(value)) {
    return null;
  }
  const year = Number(value);
  return year >= 1970 && year <= 9999 ? year : null;
}

/** Most recent year with data, or null when there is none. */
export function latestYear(years: readonly number[]): number | null {
  return years.length ? Math.max(...years) : null;
}

/**
 * Year tabs, most recent first. The year being viewed is included even if it has no data
 * (e.g. typed in the URL) so the active tab is always visible.
 */
export function yearTabs(years: readonly number[], current: number | null): number[] {
  const all = new Set(years);
  if (current !== null) {
    all.add(current);
  }
  return [...all].sort((a, b) => b - a);
}

/**
 * Neighbours of the viewed year in the tab list (most recent first): `older` is the next tab, `newer`
 * the previous one. Null at either end (or when the year is not in the list).
 */
export function adjacentYears(
  tabs: readonly number[],
  current: number | null,
): { older: number | null; newer: number | null } {
  const index = current === null ? -1 : tabs.indexOf(current);
  if (index === -1) {
    return { older: null, newer: null };
  }
  return {
    older: index < tabs.length - 1 ? tabs[index + 1] : null,
    newer: index > 0 ? tabs[index - 1] : null,
  };
}

export interface YearHighlight {
  /** Translation key under `years.highlight`. */
  key: string;
  params?: Record<string, number>;
}

function isUniqueMax(stats: readonly YearStat[], year: number, pick: (s: YearStat) => number | null): boolean {
  const values = stats.map((s) => ({ year: s.year, value: pick(s) })).filter((v) => v.value !== null && v.value > 0);
  if (values.length < 2) {
    return false;
  }
  const max = Math.max(...values.map((v) => v.value as number));
  const top = values.filter((v) => v.value === max);
  return top.length === 1 && top[0].year === year;
}

/**
 * Sentence shown next to the year title: the most remarkable fact about the year compared with
 * the others (most hours, most runs, best average), else something about the year itself.
 * Null when the year has nothing to say.
 */
export function yearHighlight(summary: YearSummary, byYear: readonly YearStat[]): YearHighlight | null {
  const year = summary.year;
  if (isUniqueMax(byYear, year, (s) => s.totalHours)) {
    return { key: 'mostHours' };
  }
  if (isUniqueMax(byYear, year, (s) => s.experienceCount)) {
    return { key: 'mostRuns' };
  }
  if (isUniqueMax(byYear, year, (s) => s.averageRating)) {
    return { key: 'bestRated' };
  }
  const withData = byYear.filter((s) => s.experienceCount > 0);
  if (withData.length > 1 && Math.min(...withData.map((s) => s.year)) === year) {
    return { key: 'firstYear' };
  }
  if (summary.platinumCount > 0) {
    return { key: 'platinums', params: { count: summary.platinumCount } };
  }
  if (summary.completedCount > 0) {
    return { key: 'completed', params: { count: summary.completedCount } };
  }
  if (summary.experienceCount > 0) {
    return { key: 'runs', params: { count: summary.experienceCount } };
  }
  return null;
}

/** Text colour for a run status in the year's run list. */
export const STATUS_TEXT: Record<ExperienceStatus, string> = {
  EN_CURSO: 'text-brand-lighter',
  COMPLETADO: 'text-success',
  ABANDONADO: 'text-danger',
  PENDIENTE: 'text-neutral',
};

/** Compact whole hours under a month bar ("12h"): "" for empty months, "<1h" for a few minutes. */
export function monthValueLabel(hours: number): string {
  if (!(hours > 0)) {
    return '';
  }
  const rounded = Math.round(hours);
  return rounded === 0 ? '<1h' : `${rounded}h`;
}
