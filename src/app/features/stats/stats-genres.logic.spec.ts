import { MIN_ABANDONMENT_SAMPLE, MIN_GENRE_RATINGS } from './stats.logic';
import { genreHighlights, genreProfiles, genreShareBase, genresOfTheYear, inGenre } from './stats-genres.logic';

const stat = (genreId: number, genreName: string, gameCount: number, totalHours: number) => ({ genreId, genreName, gameCount, totalHours });
const rated = (genreId: number, ratedCount: number, averageRating: number) => ({ genreId, genreName: '', ratedCount, averageRating });
const runs = (genreId: number, completedCount: number, abandonedCount: number) => ({
  genreId,
  genreName: '',
  completedCount,
  abandonedCount,
  abandonmentRate: completedCount + abandonedCount ? abandonedCount / (completedCount + abandonedCount) : 0,
});

describe('genreProfiles', () => {
  const byGenre = [stat(1, 'RPG', 4, 300), stat(2, 'Shooter', 6, 300), stat(3, 'Puzzle', 1, 10), stat(4, 'Empty', 0, 0)];

  it('ranks genres by hours (ties by games), with their share of the base, dropping empty ones', () => {
    const profiles = genreProfiles(byGenre, [], [], 400);
    expect(profiles.map((p) => p.name)).toEqual(['Shooter', 'RPG', 'Puzzle']);
    expect(profiles[0].share).toBe(0.75);
  });

  it('clamps the share to 100% when the base is smaller than a genre (a partial fallback base)', () => {
    expect(genreProfiles([stat(1, 'RPG', 1, 500)], [], [], 400)[0].share).toBe(1);
    expect(genreProfiles([stat(1, 'RPG', 1, 500)], [], [], 0)[0].share).toBe(0);
  });

  it('breaks full ties by the displayed name (Spanish collation, any case), then by id', () => {
    const tied = [stat(9, 'zelda-like', 1, 10), stat(3, 'Árcade', 1, 10), stat(2, 'arcade', 1, 10)];
    const names = genreProfiles(tied, [], [], 30, (name) => name.toUpperCase()).map((p) => `${p.genreId}:${p.name}`);
    expect(names).toEqual(['2:ARCADE', '3:ÁRCADE', '9:ZELDA-LIKE']);
  });

  it('ranks ratings from exactly MIN_GENRE_RATINGS and abandonment from exactly MIN_ABANDONMENT_SAMPLE', () => {
    const [under, at] = genreProfiles(
      [stat(1, 'A', 1, 20), stat(2, 'B', 1, 10)],
      [rated(1, MIN_GENRE_RATINGS - 1, 9), rated(2, MIN_GENRE_RATINGS, 8)],
      [runs(1, MIN_ABANDONMENT_SAMPLE - 2, 1), runs(2, MIN_ABANDONMENT_SAMPLE - 1, 1)],
      30,
    );
    expect(under.rating).toBeNull();
    expect(at.rating).toBe(8);
    expect(under.abandonment).toBeNull();
    expect(under.finished).toBe(MIN_ABANDONMENT_SAMPLE - 1);
    expect(at.abandonment).toBeCloseTo(1 / MIN_ABANDONMENT_SAMPLE);
  });
});

describe('genreShareBase', () => {
  it("adds up the confirmed library games' hours (the by-genre figures' own base)", () => {
    const library = [
      { totalHours: 100, reviewStatus: 'CONFIRMED' as const },
      { totalHours: null, reviewStatus: 'CONFIRMED' as const },
      { totalHours: 50, reviewStatus: 'PENDING_REVIEW' as const },
    ];
    expect(genreShareBase(library, [{ totalHours: 999 }])).toBe(100);
  });

  it('falls back to the yearly hours without a library', () => {
    expect(genreShareBase(null, [{ totalHours: 30 }, { totalHours: 12 }])).toBe(42);
    expect(genreShareBase([], [{ totalHours: 30 }])).toBe(30);
  });
});

describe('genreHighlights', () => {
  it('picks the best rated, most abandoned and biggest genres among those that qualify', () => {
    const profiles = genreProfiles(
      [stat(1, 'RPG', 4, 300), stat(2, 'Shooter', 6, 200), stat(3, 'Puzzle', 1, 10)],
      [rated(1, 4, 8.5), rated(3, 1, 9.9)],
      [runs(2, 3, 1), runs(3, 0, 1)],
      510,
    );
    const highlights = genreHighlights(profiles);
    expect(highlights.bestRated?.name).toBe('RPG');
    expect(highlights.mostAbandoned?.name).toBe('Shooter');
    expect(highlights.mostGames?.name).toBe('Shooter');
    expect(genreHighlights([])).toEqual({ bestRated: null, mostAbandoned: null, mostGames: null });
  });

  it('has no most abandoned genre when every rate is 0', () => {
    const profiles = genreProfiles([stat(1, 'RPG', 1, 10), stat(2, 'Puzzle', 1, 5)], [], [runs(1, 5, 0), runs(2, 4, 0)], 15);
    expect(genreHighlights(profiles).mostAbandoned).toBeNull();
  });

  it('breaks ties by hours, then by name', () => {
    const profiles = genreProfiles(
      [stat(1, 'B', 3, 10), stat(2, 'A', 3, 10), stat(3, 'C', 3, 20)],
      [rated(1, 3, 8), rated(2, 3, 8), rated(3, 3, 8)],
      [],
      40,
    );
    const highlights = genreHighlights(profiles);
    expect(highlights.bestRated?.name).toBe('C');
    expect(genreHighlights(profiles.filter((p) => p.name !== 'C')).mostGames?.name).toBe('A');
  });
});

describe('inGenre', () => {
  it('matches the games listing the genre', () => {
    expect(inGenre(2)({ genres: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] })).toBe(true);
    expect(inGenre(2)({ genres: [] })).toBe(false);
  });
});

describe('genresOfTheYear', () => {
  const games = [
    { id: 1, genres: [{ id: 10, name: 'RPG' }, { id: 20, name: 'Action' }] },
    { id: 2, genres: [{ id: 20, name: 'Action' }] },
    { id: 3, genres: [] },
  ];

  it("credits each run's hours to every genre of its game and picks each year's top, newest first", () => {
    const years = genresOfTheYear(
      [
        { gameId: 1, year: 2025, hours: 30 },
        { gameId: 2, year: 2025, hours: 10 },
        { gameId: 1, year: 2026, hours: 5 },
        { gameId: 9, year: 2026, hours: 50 },
        { gameId: 2, year: null, hours: 99 },
      ],
      games,
    );
    expect(years).toEqual([
      // A tie (5 h each): the displayed name decides.
      { year: 2026, genreId: 20, name: 'Action', hours: 5, share: 1 },
      { year: 2025, genreId: 20, name: 'Action', hours: 40, share: 1 },
    ]);
  });

  it("counts a genre-less game in the year's total only, so the top genre's share is honest", () => {
    const [year] = genresOfTheYear(
      [
        { gameId: 2, year: 2025, hours: 30 },
        { gameId: 3, year: 2025, hours: 70 },
      ],
      games,
    );
    expect(year).toMatchObject({ genreId: 20, hours: 30, share: 0.3 });
  });

  it('names the genre as displayed', () => {
    expect(genresOfTheYear([{ gameId: 2, year: 2025, hours: 1 }], games, (n) => n.toLowerCase())[0].name).toBe('action');
  });
});
