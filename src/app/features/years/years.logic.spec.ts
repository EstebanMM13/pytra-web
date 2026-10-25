import { YearStat, YearSummary } from '../../core/models/stats.model';
import {
  adjacentYears,
  latestYear,
  gotyCoverUrl,
  monthHourBars,
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
    fullCompletionCount: 0,
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

describe('monthHourBars', () => {
  it('puts each month hours under its label and leaves empty months blank', () => {
    const bars = monthHourBars(
      [
        { month: 1, hours: 12.4 },
        { month: 2, hours: 0 },
        { month: 3, hours: 0.3 },
      ],
      monthLabels('es', 'short'),
    );
    expect(bars.map((b) => [b.label, b.subLabel, b.value])).toEqual([
      ['Ene', '12h', 12.4],
      ['Feb', null, 0],
      ['Mar', '<1h', 0.3],
    ]);
    expect(bars.every((b) => !b.topLabel)).toBe(true);
    expect(bars.map((b) => b.title)).toEqual(['Ene: 12h', 'Feb: 0h', 'Mar: <1h']);
  });
});

describe('monthValueLabel', () => {
  it('shows compact rounded hours and hides empty months', () => {
    expect(monthValueLabel(0)).toBe('');
    expect(monthValueLabel(-1)).toBe('');
    expect(monthValueLabel(Number.NaN)).toBe('');
    expect(monthValueLabel(0.2)).toBe('<1h');
    expect(monthValueLabel(41.6)).toBe('42h');
    expect(monthValueLabel(12)).toBe('12h');
  });
});

describe('gotyCoverUrl', () => {
  const goty = { gameId: 9, gameName: 'Hollow Knight: Silksong', avgRating: 10, experienceCount: 1, totalHours: 40 };
  const run = { gameId: 9, coverImageUrl: 'https://covers.example/from-run.jpg' } as YearSummary['experiences'][number];

  it('uses the cover sent with the GOTY even when its run is not among the year runs', () => {
    expect(gotyCoverUrl({ goty: { ...goty, coverImageUrl: 'https://covers.example/goty.jpg' }, experiences: [] })).toBe(
      'https://covers.example/goty.jpg',
    );
  });

  it('falls back to the year runs for older APIs, else null', () => {
    expect(gotyCoverUrl({ goty, experiences: [run] })).toBe('https://covers.example/from-run.jpg');
    expect(gotyCoverUrl({ goty, experiences: [] })).toBeNull();
    expect(gotyCoverUrl({ goty: null, experiences: [run] })).toBeNull();
    expect(gotyCoverUrl(null)).toBeNull();
  });
});

describe('adjacentYears', () => {
  const tabs = [2026, 2025, 2023];

  it('returns the older and newer neighbours of the viewed year', () => {
    expect(adjacentYears(tabs, 2025)).toEqual({ older: 2023, newer: 2026 });
  });

  it('has no newer year at the most recent end and no older one at the oldest', () => {
    expect(adjacentYears(tabs, 2026)).toEqual({ older: 2025, newer: null });
    expect(adjacentYears(tabs, 2023)).toEqual({ older: null, newer: 2025 });
  });

  it('returns no neighbours for a missing or unknown year', () => {
    expect(adjacentYears(tabs, null)).toEqual({ older: null, newer: null });
    expect(adjacentYears(tabs, 1999)).toEqual({ older: null, newer: null });
    expect(adjacentYears([], 2026)).toEqual({ older: null, newer: null });
  });
});
