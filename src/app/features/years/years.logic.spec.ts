import { YearStat, YearSummary } from '../../core/models/stats.model';
import {
  latestYear,
  monthLabels,
  monthValueLabel,
  parseYearParam,
  yearHighlight,
  yearTabs,
} from './years.logic';

function summary(partial: Partial<YearSummary>): YearSummary {
  return {
    year: 2023,
    totalHours: 0,
    experienceCount: 0,
    completedCount: 0,
    abandonedCount: 0,
    averageRating: null,
    platinumCount: 0,
    hoursWithoutMonth: 0,
    months: [],
    experiences: [],
    goty: null,
    topRated: [],
    mostPlayed: [],
    topSagas: [],
    topGenres: [],
    surprises: [],
    disappointments: [],
    note: { summary: null, highlights: null, updatedAt: null },
    ...partial,
  };
}

function stat(year: number, totalHours: number, experienceCount: number, averageRating: number | null): YearStat {
  return { year, totalHours, experienceCount, averageRating };
}

describe('monthLabels', () => {
  it('returns 12 Spanish abbreviations by default', () => {
    const labels = monthLabels('es', 'short');
    expect(labels).toHaveLength(12);
    expect(labels[0]).toBe('Ene');
    expect(labels[11]).toBe('Dic');
  });

  it('returns initials for mobile and English names', () => {
    expect(monthLabels('es', 'initial').join('')).toBe('EFMAMJJASOND');
    expect(monthLabels('en', 'short')[7]).toBe('Aug');
    expect(monthLabels('fr', 'short')[0]).toBe('Ene');
  });
});

describe('parseYearParam / latestYear / yearTabs', () => {
  it('accepts only plausible 4-digit years', () => {
    expect(parseYearParam('2023')).toBe(2023);
    expect(parseYearParam('23')).toBeNull();
    expect(parseYearParam('abcd')).toBeNull();
    expect(parseYearParam('1500')).toBeNull();
    expect(parseYearParam(null)).toBeNull();
  });

  it('picks the most recent year', () => {
    expect(latestYear([2021, 2025, 2023])).toBe(2025);
    expect(latestYear([])).toBeNull();
  });

  it('lists tabs newest first, including the viewed year', () => {
    expect(yearTabs([2021, 2023], 2022)).toEqual([2023, 2022, 2021]);
    expect(yearTabs([2021, 2023], 2023)).toEqual([2023, 2021]);
  });
});

describe('yearHighlight', () => {
  const byYear = [stat(2021, 100, 5, 8), stat(2022, 300, 4, 7.5), stat(2023, 200, 9, 8.9)];

  it('prefers "most hours" when the year has the unique maximum', () => {
    expect(yearHighlight(summary({ year: 2022 }), byYear)).toEqual({ key: 'mostHours' });
  });

  it('falls back to most runs, then best average', () => {
    expect(yearHighlight(summary({ year: 2023 }), byYear)).toEqual({ key: 'mostRuns' });
    const ratings = [stat(2021, 100, 5, 9.1), stat(2022, 300, 9, 7.5)];
    expect(yearHighlight(summary({ year: 2021 }), ratings)).toEqual({ key: 'bestRated' });
  });

  it('ignores ties and single-year histories for comparisons', () => {
    const tied = [stat(2021, 100, 5, 8), stat(2022, 100, 5, 8)];
    expect(yearHighlight(summary({ year: 2022, completedCount: 3 }), tied)).toEqual({
      key: 'completed',
      params: { count: 3 },
    });
    expect(yearHighlight(summary({ year: 2021, platinumCount: 2 }), [stat(2021, 50, 3, 8)])).toEqual({
      key: 'platinums',
      params: { count: 2 },
    });
  });

  it('mentions the first year of the history', () => {
    const history = [stat(2019, 10, 1, 6), stat(2020, 100, 5, 8)];
    expect(yearHighlight(summary({ year: 2019 }), history)).toEqual({ key: 'firstYear' });
  });

  it('returns null for an empty year', () => {
    expect(yearHighlight(summary({ year: 2030 }), [])).toBeNull();
  });
});

describe('monthValueLabel', () => {
  it('rounds hours and hides empty months', () => {
    expect(monthValueLabel(0)).toBe('');
    expect(monthValueLabel(0.2)).toBe('<1');
    expect(monthValueLabel(41.6)).toBe('42');
  });
});
