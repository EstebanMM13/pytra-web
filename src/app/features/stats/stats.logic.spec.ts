import { GenreAbandonment, PlatformYear, SagaStat } from '../../core/models/stats.model';
import {
  NEUTRAL_PLATFORM_COLOR,
  abandonmentRanking,
  activityYears,
  buildHeatmap,
  decadeParams,
  platformColor,
  ratingSpread,
  ratingTemperament,
  sagaTeaser,
  shares,
  splitBySample,
  stackLegend,
  weekdayShortLabels,
  yearSegments,
} from './stats.logic';

describe('buildHeatmap', () => {
  it('lays a year out as Monday-first week columns, padded before the first and after the last day', () => {
    // 2024-01-01 was a Monday, 2024-12-31 a Tuesday (leap year: 366 days).
    const map = buildHeatmap(2024, []);
    expect(map.columns).toBe(53);
    expect(map.cells).toHaveLength(53 * 7);
    expect(map.cells[0]).toMatchObject({ date: '2024-01-01', row: 0 });
    const last = map.cells.map((c) => c !== null).lastIndexOf(true);
    expect(map.cells[last]).toMatchObject({ date: '2024-12-31', row: 1 });
    expect(map.cells.slice(last + 1).every((c) => c === null)).toBe(true);
    expect(map.cells.filter((c) => c !== null)).toHaveLength(366);
  });

  it('pads the first week when the span does not start on a Monday', () => {
    // 2026-01-01 is a Thursday: Monday..Wednesday of that week stay empty.
    const map = buildHeatmap(2026, []);
    expect(map.cells.slice(0, 3)).toEqual([null, null, null]);
    expect(map.cells[3]).toMatchObject({ date: '2026-01-01', row: 3 });
    expect(map.columns).toBe(53);
  });

  it('builds a half year with its own month labels', () => {
    const map = buildHeatmap(2026, [], 6, 11);
    // 2026-07-01 is a Wednesday.
    expect(map.cells[2]).toMatchObject({ date: '2026-07-01', row: 2 });
    expect(map.months.map((m) => m.month)).toEqual([6, 7, 8, 9, 10, 11]);
    expect(map.months[0].column).toBe(0);
    // August 1st (a Saturday) is in the fifth week column.
    expect(map.months[1]).toEqual({ month: 7, column: 4 });
    expect(map.cells.filter((c) => c !== null)).toHaveLength(184);
  });

  it('colours played days on the diary scale and keeps their figures', () => {
    const map = buildHeatmap(2026, [
      { date: '2026-01-02', hours: 0.5, gameCount: 1 },
      { date: '2026-01-03', hours: 7, gameCount: 2 },
    ]);
    const byDate = new Map(map.cells.filter((c) => c !== null).map((c) => [c!.date, c!]));
    expect(byDate.get('2026-01-01')!.level).toBe(0);
    expect(byDate.get('2026-01-02')).toMatchObject({ level: 1, hours: 0.5, gameCount: 1 });
    expect(byDate.get('2026-01-03')).toMatchObject({ level: 4, hours: 7, gameCount: 2 });
  });
});

describe('activityYears', () => {
  it('adds the current and viewed years to the years with runs, most recent first', () => {
    expect(activityYears([2023, 2021], 2026, null)).toEqual([2026, 2023, 2021]);
    expect(activityYears([2026], 2026, 2019)).toEqual([2026, 2019]);
  });
});

describe('weekdayShortLabels', () => {
  it('starts on Monday', () => {
    expect(weekdayShortLabels('en-US')).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });
});

describe('sample-size filtering', () => {
  const genre = (genreName: string, completedCount: number, abandonedCount: number): GenreAbandonment => ({
    genreId: genreName.length,
    genreName,
    completedCount,
    abandonedCount,
    abandonmentRate: abandonedCount / (completedCount + abandonedCount),
  });

  it('keeps items with enough samples, in order, and counts the rest', () => {
    expect(splitBySample([5, 1, 3, 2], (n) => n, 3)).toEqual({ shown: [5, 3], hidden: 2 });
  });

  it('ranks genres by abandonment rate, hiding tiny samples', () => {
    const ranking = abandonmentRanking([
      genre('RPG', 8, 2),
      genre('PUZZLE', 0, 2),
      genre('SHOOTER', 1, 2),
      genre('ROGUELIKE', 2, 4),
    ]);
    expect(ranking.shown.map((g) => g.genreName)).toEqual(['ROGUELIKE', 'SHOOTER', 'RPG']);
    expect(ranking.hidden).toBe(1);
  });

  it('breaks rate ties by the bigger sample', () => {
    const ranking = abandonmentRanking([genre('A', 2, 1), genre('B', 4, 2)]);
    expect(ranking.shown.map((g) => g.genreName)).toEqual(['B', 'A']);
  });
});

describe('rating reads', () => {
  it('reads the mean as generous, balanced or strict', () => {
    expect(ratingTemperament(8.1)).toBe('generous');
    expect(ratingTemperament(7.5)).toBe('generous');
    expect(ratingTemperament(6.4)).toBe('balanced');
    expect(ratingTemperament(5.5)).toBe('strict');
    expect(ratingTemperament(null)).toBeNull();
  });

  it('reads the deviation as tight, moderate or wide', () => {
    expect(ratingSpread(0.8)).toBe('tight');
    expect(ratingSpread(1.5)).toBe('moderate');
    expect(ratingSpread(2.4)).toBe('wide');
    expect(ratingSpread(undefined)).toBeNull();
  });

  it('scales counts to the largest one', () => {
    expect(shares([0, 2, 4])).toEqual([0, 0.5, 1]);
    expect(shares([0, 0])).toEqual([0, 0]);
  });
});

describe('platform stacks', () => {
  const year: PlatformYear = {
    year: 2025,
    totalHours: 60,
    unassignedOnlineHours: 10,
    platforms: [
      { platformId: 1, name: 'PS5', color: '#112233', hours: 40 },
      { platformId: 2, name: 'Switch', color: null, hours: 10 },
      { platformId: 3, name: 'PC', color: 'red', hours: 0 },
    ],
  };

  it('scales a year to the busiest one, the unassigned online hours last', () => {
    const segments = yearSegments(year, 120, 'Sin plataforma');
    expect(segments.map((s) => [s.key, s.width, s.color])).toEqual([
      [1, 100 / 3, '#112233'],
      [2, 100 / 12, NEUTRAL_PLATFORM_COLOR],
      ['unassigned', 100 / 12, NEUTRAL_PLATFORM_COLOR],
    ]);
  });

  it('lists the legend by overall hours', () => {
    const other: PlatformYear = { ...year, platforms: [{ platformId: 2, name: 'Switch', color: null, hours: 45 }] };
    expect(stackLegend([year, other]).map((p) => p.platformId)).toEqual([2, 1]);
  });

  it('only binds well-formed hex colours', () => {
    expect(platformColor('#A1b2C3')).toBe('#A1b2C3');
    expect(platformColor('url(x)')).toBe(NEUTRAL_PLATFORM_COLOR);
    expect(platformColor(null)).toBe(NEUTRAL_PLATFORM_COLOR);
  });
});

describe('hub teasers', () => {
  it('picks the saga with the most hours, ignoring games without a saga', () => {
    const stats: SagaStat[] = [
      { sagaId: null, sagaName: 'Sin saga', gameCount: 9, totalHours: 900 },
      { sagaId: 1, sagaName: 'Zelda', gameCount: 3, totalHours: 120 },
      { sagaId: 2, sagaName: 'Souls', gameCount: 4, totalHours: 300 },
    ];
    expect(sagaTeaser(stats)).toEqual({ count: 2, top: stats[2] });
    expect(sagaTeaser([])).toEqual({ count: 0, top: null });
  });

  it('shortens decades of the last century', () => {
    expect(decadeParams(1990)).toEqual({ decade: 1990, short: '90' });
    expect(decadeParams(2000)).toEqual({ decade: 2000, short: '2000' });
    expect(decadeParams(2010).short).toBe('2010');
  });
});
