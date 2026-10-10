import { ExperienceStatus } from '../../core/models/experience.model';
import { YearStat, YearSummary } from '../../core/models/stats.model';

/** Pure helpers behind the yearly summary page. */

const MONTHS: Record<'es' | 'en', readonly string[]> = {
  es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

/** Month labels, January first: `short` (Ene…Dic, web) or `initial` (E F M…, mobile). */
export function monthLabels(lang: string, style: 'short' | 'initial'): string[] {
  const names = MONTHS[lang === 'en' ? 'en' : 'es'];
  return style === 'short' ? [...names] : names.map((name) => name.charAt(0));
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

/** Whole hours for the dense month chart: "" for empty months, "<1" for a few minutes. */
export function monthValueLabel(hours: number): string {
  if (hours <= 0) {
    return '';
  }
  const rounded = Math.round(hours);
  return rounded === 0 ? '<1' : String(rounded);
}
