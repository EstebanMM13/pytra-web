import { GenreAbandonment, PlatformYear, SagaStat } from '../../core/models/stats.model';
import {
  NEUTRAL_PLATFORM_COLOR,
  REST_SLICE_COLOR,
  abandonmentRanking,
  activityYears,
  activeDayShare,
  buildHeatmap,
  byDeveloper,
  coverMap,
  genreCovers,
  releaseYearCovers,
  releaseYearOf,
  developerCovers,
  columnHeights,
  decadeParams,
  donutArcs,
  finishRate,
  gamesLinkParams,
  percentFormat,
  histogramColumns,
  hoursTrend,
  monthlyHours,
  platformColor,
  platformShades,
  shadeLightnesses,
  ratingSpread,
  ratingTemperament,
  recentDays,
  recentYearBars,
  sagaTeaser,
  shareSlices,
  shares,
  splitBySample,
  stackLegend,
  topCovers,
  withArt,
  totalHours,
  trimEmptyEnds,
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
      // Not the colourless platform's grey: the two would read as one.
      ['unassigned', 100 / 12, REST_SLICE_COLOR],
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

/** Relative luminance-free lightness of a #rrggbb colour (HSL L), for the shade assertions. */
function lightness(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255);
  return (Math.max(...channels) + Math.min(...channels)) / 2;
}

describe('platformShades', () => {
  const playstation = ['PS5', 'PS4', 'PS3', 'PS2', 'PS1', 'PSP', 'PS Vita'].map((name, i) => ({
    id: i + 1,
    name,
    color: '#4F7BE8',
    sortOrder: 20 + i * 10,
  }));

  it('gives every platform of a shared colour its own shade, deterministically', () => {
    const shades = platformShades([...playstation].reverse());
    const colors = playstation.map((p) => shades.get(p.id)!);
    expect(new Set(colors).size).toBe(playstation.length);
    // Same catalog in another order: same colours.
    expect(platformShades(playstation)).toEqual(shades);
  });

  it('keeps catalog neighbours far apart and every shade readable on both themes', () => {
    const shades = platformShades(playstation);
    const ps5 = lightness(shades.get(1)!);
    const ps4 = lightness(shades.get(2)!);
    expect(Math.abs(ps5 - ps4)).toBeGreaterThan(0.15);
    for (const color of shades.values()) {
      expect(lightness(color)).toBeGreaterThanOrEqual(0.29);
      expect(lightness(color)).toBeLessThanOrEqual(0.77);
    }
  });

  it('keeps the hue of the family colour', () => {
    const shades = platformShades(playstation);
    for (const color of shades.values()) {
      const n = parseInt(color.slice(1), 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      // A blue: blue is the strongest channel, red the weakest.
      expect(b).toBeGreaterThan(g);
      expect(g).toBeGreaterThan(r);
    }
  });

  it('leaves a platform with a colour of their own alone, and a lone colourless one neutral', () => {
    const shades = platformShades([
      { id: 1, color: '#E60012', sortOrder: 1 },
      { id: 2, color: null, sortOrder: 2 },
    ]);
    expect(shades.get(1)).toBe('#e60012');
    expect(shades.get(2)).toBe(NEUTRAL_PLATFORM_COLOR);
  });

  it('gives several colourless (or invalid-colour) platforms distinct grey shades', () => {
    const shades = platformShades([
      { id: 1, color: null, sortOrder: 1 },
      { id: 2, color: 'red', sortOrder: 2 },
      { id: 3, color: null, sortOrder: null },
    ]);
    const greys = [1, 2, 3].map((id) => shades.get(id)!);
    expect(new Set(greys).size).toBe(3);
    for (const grey of greys) {
      expect(grey).toMatch(/^#[0-9a-f]{6}$/);
      expect(lightness(grey)).toBeGreaterThanOrEqual(0.29);
      expect(lightness(grey)).toBeLessThanOrEqual(0.77);
    }
  });

  it('spreads lightness slots around the base, the first one closest to it', () => {
    const slots = shadeLightnesses(0.5, 3);
    expect(slots[0]).toBeCloseTo(0.5, 1);
    expect(new Set(slots.map((l) => l.toFixed(3))).size).toBe(3);
    expect(shadeLightnesses(0.5, 1)).toEqual([0.5]);
  });
});

describe('histogramColumns', () => {
  const buckets = Array.from({ length: 21 }, (_, i) => ({ from: i / 2, to: i === 20 ? 10 : (i + 1) / 2, count: i }));

  it('keeps the half-point buckets on wide screens', () => {
    expect(histogramColumns(buckets, false)).toHaveLength(21);
  });

  it('groups them into whole points plus the perfect 10s', () => {
    const columns = histogramColumns(buckets, true);
    expect(columns).toHaveLength(11);
    expect(columns[0]).toEqual({ from: 0, to: 1, count: 0 + 1 });
    expect(columns[9]).toEqual({ from: 9, to: 10, count: 18 + 19 });
    expect(columns[10]).toEqual({ from: 10, to: 10, count: 20 });
  });
});

describe('gamesLinkParams', () => {
  it('orders the library like the tile ranks it', () => {
    expect(gamesLinkParams({ released: 2015, sort: 'hours' })).toEqual({ released: '2015', sort: 'hours' });
    expect(gamesLinkParams({ genre: 4, sort: 'rating' })).toEqual({ genre: '4', sort: 'rating' });
  });

  it('writes the library URL filters, leaving out what is not set', () => {
    expect(gamesLinkParams({ platform: 3, year: 2024 })).toEqual({ platform: '3', year: '2024' });
    expect(gamesLinkParams({ genre: 5, year: null })).toEqual({ genre: '5' });
    expect(gamesLinkParams({ days: { min: 366, max: null }, hours: { min: 10, max: 30 }, decade: 1990 })).toEqual({
      decade: '1990',
      days: '366-',
      hours: '10-30',
    });
  });
});

describe('shareSlices', () => {
  const item = (key: number, value: number) => ({ key, name: `P${key}`, value, color: `#00000${key}` });
  const other = { name: 'Other', color: 'grey' };

  it('keeps the biggest items, most first, and sums the rest into one slice', () => {
    const slices = shareSlices([item(1, 10), item(2, 50), item(3, 25), item(4, 15), item(5, 0)], 2, other);
    expect(slices.map((s) => s.key)).toEqual([2, 3, 'other']);
    expect(slices.map((s) => s.share)).toEqual([0.5, 0.25, 0.25]);
    expect(slices[2]).toMatchObject({ name: 'Other', value: 25, color: 'grey' });
  });

  it('does not fold a single leftover item into "other"', () => {
    expect(shareSlices([item(1, 3), item(2, 2), item(3, 1)], 2, other).map((s) => s.key)).toEqual([1, 2, 3]);
  });

  it('is empty without positive values', () => {
    expect(shareSlices([item(1, 0)], 3, other)).toEqual([]);
  });
});

describe('donutArcs', () => {
  it('lays the shares end to end from the top, each shortened by the gap', () => {
    const arcs = donutArcs(
      [
        { key: 'a', color: 'red', share: 0.75 },
        { key: 'b', color: 'blue', share: 0.25 },
      ],
      0.02,
    );
    expect(arcs).toHaveLength(2);
    expect(arcs[0]).toMatchObject({ key: 'a', start: 0.01 });
    expect(arcs[0].length).toBeCloseTo(0.73);
    expect(arcs[1].start).toBeCloseTo(0.76);
    expect(arcs[1].length).toBeCloseTo(0.23);
  });

  it('draws a lone slice as the whole circle, with no gap', () => {
    expect(donutArcs([{ key: 'a', color: 'red', share: 1 }], 0.02)).toEqual([{ key: 'a', color: 'red', start: 0, length: 1 }]);
  });

  it('drops empty slices and slices thinner than the gap', () => {
    const arcs = donutArcs(
      [
        { key: 'a', color: 'red', share: 0.99 },
        { key: 'b', color: 'blue', share: 0 },
        { key: 'c', color: 'green', share: 0.01 },
      ],
      0.02,
    );
    expect(arcs.map((a) => a.key)).toEqual(['a']);
  });
});

describe('finishRate', () => {
  it('is the completed share of the finished and abandoned runs', () => {
    expect(finishRate(12, 3)).toBe(0.8);
    expect(finishRate(0, 4)).toBe(0);
  });

  it('is null when nothing was finished or abandoned', () => {
    expect(finishRate(0, 0)).toBeNull();
  });
});

describe('columnHeights', () => {
  it('scales to the largest count, keeping small counts visible and empty ones flat', () => {
    expect(columnHeights([0, 1, 100, 50])).toEqual([0, 3, 100, 50]);
    expect(columnHeights([0, 0])).toEqual([0, 0]);
  });
});

describe('trimEmptyEnds', () => {
  it('drops the empty items at both ends only', () => {
    expect(trimEmptyEnds([0, 0, 2, 0, 3, 0], (n) => n)).toEqual([2, 0, 3]);
    expect(trimEmptyEnds([0, 0], (n) => n)).toEqual([]);
  });
});

describe('recentDays', () => {
  it('gives the heat level of each day up to today, oldest first, empty days at 0', () => {
    const days = recentDays(
      [
        { date: '2024-02-28', hours: 0.5, gameCount: 1 },
        { date: '2024-03-01', hours: 8, gameCount: 2 },
      ],
      '2024-03-01',
      3,
    );
    // 2024 is a leap year: the 29th sits between them.
    expect(days).toEqual([
      { date: '2024-02-28', level: 1 },
      { date: '2024-02-29', level: 0 },
      { date: '2024-03-01', level: 4 },
    ]);
  });
});

describe('recentYearBars', () => {
  it('spans the last years up to the latest played one, gaps at 0, scaled to the busiest', () => {
    const bars = recentYearBars(
      [
        { year: 2019, totalHours: 10 },
        { year: 2021, totalHours: 40 },
        { year: 2022, totalHours: 20 },
        { year: 2023, totalHours: 0 },
      ],
      3,
      8,
    );
    expect(bars).toEqual([
      { year: 2020, height: 0 },
      { year: 2021, height: 100 },
      { year: 2022, height: 50 },
    ]);
  });

  it('does not reach back before the first played year', () => {
    expect(recentYearBars([{ year: 2024, totalHours: 5 }], 6)).toEqual([{ year: 2024, height: 100 }]);
    expect(recentYearBars([], 6)).toEqual([]);
  });
});

describe('percentFormat', () => {
  it('rounds to whole points, keeping one decimal under 10%', () => {
    const percent = percentFormat('en-US');
    expect(percent(0.456)).toBe('46%');
    expect(percent(0.034)).toBe('3.4%');
    expect(percent(1)).toBe('100%');
  });
});

describe('topCovers', () => {
  const game = (id: number, totalHours: number | null, cover: string | null, developer = 'FromSoftware') => ({
    id,
    name: `G${id}`,
    coverImageUrl: cover,
    totalHours,
    developer,
  });

  it('keeps the matching games, covered ones first, then most played', () => {
    const games = [game(1, 10, 'a'), game(2, 90, null), game(3, 50, 'c'), game(4, 70, 'd', 'Valve'), game(5, null, 'e')];
    expect(topCovers(games, byDeveloper(' fromsoftware '), 3)).toEqual([
      { id: 3, name: 'G3', url: 'c', hours: 50 },
      { id: 1, name: 'G1', url: 'a', hours: 10 },
      { id: 5, name: 'G5', url: 'e', hours: undefined },
    ]);
  });

  it('keeps a stack only when some cover has art', () => {
    const plain = { id: 1, name: 'A', url: null };
    expect(withArt([plain])).toEqual([]);
    expect(withArt([plain, { id: 2, name: 'B', url: 'b' }])).toHaveLength(2);
  });

  it('maps cover urls by game id, leaving out games without one', () => {
    const map = coverMap([game(1, 1, 'a'), game(2, 1, null)]);
    expect(map.get(1)).toBe('a');
    expect(map.has(2)).toBe(false);
  });
});

describe('monthlyHours', () => {
  it('adds the diary hours of the year per month, other years left out', () => {
    const months = monthlyHours(
      [
        { date: '2025-01-03', hours: 2, gameCount: 1 },
        { date: '2025-01-20', hours: 1.5, gameCount: 1 },
        { date: '2025-12-31', hours: 4, gameCount: 1 },
        { date: '2024-12-31', hours: 9, gameCount: 1 },
      ],
      2025,
    );
    expect(months).toHaveLength(12);
    expect(months[0]).toBe(3.5);
    expect(months[11]).toBe(4);
    expect(months.slice(1, 11).every((h) => h === 0)).toBe(true);
  });
});

describe('totalHours', () => {
  it('adds every year up', () => {
    expect(totalHours([{ totalHours: 10 }, { totalHours: 2.5 }])).toBe(12.5);
    expect(totalHours([])).toBe(0);
  });
});

describe('developerCovers', () => {
  it('groups the covers by developer in one pass, case and spaces ignored, games without one left out', () => {
    const games = [
      { id: 1, name: 'Elden Ring', developer: 'FromSoftware', coverImageUrl: 'er', totalHours: 100 },
      { id: 2, name: 'Sekiro', developer: ' fromsoftware', coverImageUrl: 'sk', totalHours: 150 },
      { id: 3, name: 'Hades', developer: 'Supergiant', coverImageUrl: null, totalHours: 40 },
      { id: 4, name: 'Unknown', developer: null, coverImageUrl: 'u', totalHours: 1 },
    ];
    const index = developerCovers(games, 4);
    expect(index.get('fromsoftware')!.map((c) => c.id)).toEqual([2, 1]);
    expect(index.get('supergiant')).toEqual([{ id: 3, name: 'Hades', url: null, hours: 40 }]);
    expect(index.size).toBe(2);
  });
});

describe('activeDayShare', () => {
  it('divides by the days elapsed so far in the current year', () => {
    expect(activeDayShare(16, 2025, '2025-02-01')).toBeCloseTo(16 / 32);
  });

  it('divides by the whole year (leap years included) once it is over', () => {
    expect(activeDayShare(183, 2024, '2026-01-01')).toBeCloseTo(183 / 366);
    expect(activeDayShare(365, 2025, '2026-01-01')).toBe(1);
  });

  it('has no share for a future year', () => {
    expect(activeDayShare(0, 2027, '2026-01-01')).toBeNull();
  });
});

describe('hoursTrend', () => {
  const days = [
    { date: '2025-01-10', hours: 2, gameCount: 1 },
    { date: '2025-03-01', hours: 5, gameCount: 1 },
  ];

  it('stops at the current month in the current year', () => {
    expect(hoursTrend(days, 2025, '2025-03-15')).toEqual([2, 0, 5]);
  });

  it('has a single point in January (the stat card then draws no line)', () => {
    expect(hoursTrend(days, 2025, '2025-01-20')).toEqual([2]);
  });

  it('spans every month of a past year and none of a future one', () => {
    expect(hoursTrend(days, 2025, '2026-02-01')).toHaveLength(12);
    expect(hoursTrend(days, 2027, '2026-02-01')).toEqual([]);
  });
});

describe('covers per key', () => {
  const game = (id: number, genres: number[], releaseDate: string | null, totalHours: number | null, cover: string | null = `${id}.jpg`) => ({
    id,
    name: `G${id}`,
    genres: genres.map((g) => ({ id: g, name: `Genre ${g}` })),
    releaseDate,
    totalHours,
    coverImageUrl: cover,
  });

  it('indexes the covers of every genre in one pass, a game under each of its genres', () => {
    const index = genreCovers([game(1, [10, 20], null, 5), game(2, [20], null, 50), game(3, [], null, 9)], 4);
    expect(index.get(10)!.map((c) => c.id)).toEqual([1]);
    expect(index.get(20)!.map((c) => c.id)).toEqual([2, 1]);
    expect(index.size).toBe(2);
  });

  it('keeps the most played game of each release year (ties by the lower id), undated games left out', () => {
    const covers = releaseYearCovers([game(1, [], '2015-05-19', 10), game(2, [], '2015', 40), game(3, [], '2015-01', 40), game(4, [], null, 99)]);
    expect(covers.get(2015)).toEqual({ id: 2, name: 'G2', url: '2.jpg', hours: 40 });
    expect(covers.size).toBe(1);
  });

  it('reads the year of full and partial dates', () => {
    expect(releaseYearOf('2001')).toBe(2001);
    expect(releaseYearOf('2001-05')).toBe(2001);
    expect(releaseYearOf('2001-05-03')).toBe(2001);
    expect(releaseYearOf(null)).toBeNull();
    expect(releaseYearOf('n/a')).toBeNull();
  });
});
