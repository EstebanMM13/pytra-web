import { InProgressExperience, StatsSummary, YearStat } from '../../core/models/stats.model';
import { parseCategoryFilter, parseSort, parseStatusFilter } from '../games/library.logic';
import {
  dayOfYear,
  daysSince,
  pickTagline,
  STAT_LINKS,
  share,
  statMeters,
  taglineCandidates,
  TaglineInput,
  topRatedKey,
  topRatedLink,
} from './dashboard.logic';

const summary = (partial: Partial<StatsSummary> = {}): StatsSummary => ({
  totalGames: 0,
  totalSagas: 0,
  totalExperiences: 0,
  totalSingleplayerHours: 0,
  totalOnlineHours: 0,
  totalPlatinums: 0,
  averageRating: null,
  replayCount: 0,
  completedCount: 0,
  abandonedCount: 0,
  inProgressCount: 0,
  ...partial,
});

const run = (gameName: string, startDate: string | null): InProgressExperience => ({
  experienceId: 1,
  gameId: 1,
  gameName,
  coverImageUrl: null,
  runLabel: 'Run',
  platform: 'PC',
  platformId: 1,
  platformName: 'PC',
  platformColor: '#8A857C',
  startDate,
  hours: null,
  updatedAt: '2026-01-01',
});

const year = (y: number, totalHours: number): YearStat => ({ year: y, totalHours, experienceCount: 1, averageRating: null });

const base = (partial: Partial<TaglineInput> = {}): TaglineInput => ({
  playing: [],
  byYear: [],
  summary: summary(),
  topRated: [],
  today: new Date(2026, 9, 10),
  ...partial,
});

describe('dashboard tagline', () => {
  it('computes day of year and days since', () => {
    expect(dayOfYear(new Date(2026, 0, 1))).toBe(1);
    expect(dayOfYear(new Date(2026, 11, 31))).toBe(365);
    expect(daysSince('2026-10-01', new Date(2026, 9, 10))).toBe(9);
    expect(daysSince('2027-01-01', new Date(2026, 9, 10))).toBe(0);
  });

  it('falls back to a generic line without data', () => {
    expect(pickTagline(base())).toEqual({ key: 'fallback', params: {} });
    expect(pickTagline(base({ playing: null, byYear: null, summary: null, topRated: null })).key).toBe('fallback');
  });

  it('collects every applicable candidate in order', () => {
    const keys = taglineCandidates(
      base({
        playing: [run('Recent', '2026-10-08'), run('Elden Ring', '2026-09-01'), run('Undated', null)],
        byYear: [year(2024, 300), year(2026, 120)],
        summary: summary({ totalPlatinums: 3 }),
        topRated: [{ gameId: 1, gameName: 'Hades', runLabel: 'Run', rating: 9.5 }],
      }),
    );
    expect(keys.map((t) => t.key)).toEqual(['longRun', 'bestYear', 'platinums', 'bestRating', 'thisYear']);
    expect(keys[0].params).toEqual({ days: 39, game: 'Elden Ring' });
    expect(keys[1].params).toEqual({ year: 2024 });
    expect(keys[4].params).toEqual({ hours: 120 });
  });

  it('skips runs started today/yesterday and single-year histories', () => {
    const keys = taglineCandidates(base({ playing: [run('New', '2026-10-09')], byYear: [year(2026, 10)] })).map((t) => t.key);
    expect(keys).toEqual(['thisYear']);
  });

  it('rotates by day of year deterministically', () => {
    const input = base({ summary: summary({ totalPlatinums: 2 }), byYear: [year(2025, 50), year(2026, 10)] });
    // candidates: bestYear, platinums, thisYear
    const day1 = pickTagline({ ...input, today: new Date(2026, 0, 1) }); // doy 1 -> index 1
    const day2 = pickTagline({ ...input, today: new Date(2026, 0, 2) }); // doy 2 -> index 2
    expect(day1.key).toBe('platinums');
    expect(day2.key).toBe('thisYear');
    expect(pickTagline({ ...input, today: new Date(2026, 0, 1) })).toEqual(day1);
  });
});

describe('top rated links', () => {
  it('lead to the run page for runs and to the game page for online entries', () => {
    expect(topRatedLink({ gameId: 3, gameName: 'Hades', runLabel: 'Run 1', rating: 9, experienceId: 42, online: false })).toEqual([
      '/games',
      3,
      'experiences',
      42,
    ]);
    expect(topRatedLink({ gameId: 7, gameName: 'Fortnite', runLabel: null, rating: 8, experienceId: null, online: true })).toEqual([
      '/games',
      7,
    ]);
  });

  it('fall back to the game page when the API sends no experience id', () => {
    expect(topRatedLink({ gameId: 3, gameName: 'Hades', runLabel: 'Run 1', rating: 9 })).toEqual(['/games', 3]);
  });

  it('give runs and online entries of the same game distinct keys', () => {
    const run = topRatedKey({ gameId: 3, gameName: 'G', runLabel: 'Run 1', rating: 9, experienceId: 42, online: false });
    const online = topRatedKey({ gameId: 3, gameName: 'G', runLabel: null, rating: 9, experienceId: null, online: true });
    expect(run).not.toEqual(online);
  });
});

describe('dashboard stat meters', () => {
  it('computes each card share, null when there is nothing to divide', () => {
    expect(share(1, 4)).toBe(0.25);
    expect(share(5, 4)).toBe(1);
    expect(share(1, 0)).toBeNull();

    const games = [
      { reviewStatus: 'CONFIRMED', sagaId: 1, experienceCount: 2, totalHours: 10 },
      { reviewStatus: 'CONFIRMED', sagaId: null, experienceCount: 0, totalHours: 3 },
      { reviewStatus: 'CONFIRMED', sagaId: null, experienceCount: 0, totalHours: 0 },
      { reviewStatus: 'CONFIRMED', sagaId: 2, experienceCount: 0, totalHours: 0 },
      { reviewStatus: 'PENDING_REVIEW', sagaId: 3, experienceCount: 0, totalHours: 0 },
    ];
    const meters = statMeters(
      summary({
        totalExperiences: 4,
        completedCount: 3,
        totalSingleplayerHours: 75,
        totalOnlineHours: 25,
        averageRating: 8.5,
      }),
      games,
    );
    expect(meters).toEqual({ games: 0.5, sagas: 0.5, runs: 0.75, singleHours: 0.75, onlineHours: 0.25, rating: 0.85 });
  });

  it('has no meters without data', () => {
    expect(statMeters(summary(), null)).toEqual({
      games: null,
      sagas: null,
      runs: null,
      singleHours: null,
      onlineHours: null,
      rating: null,
    });
  });
});

describe('STAT_LINKS', () => {
  it('leads each stat card to the list behind its figure', () => {
    expect(STAT_LINKS.singleHours).toEqual({ link: '/games', queryParams: { category: 'SINGLEPLAYER', sort: 'hours' } });
    expect(STAT_LINKS.onlineHours).toEqual({ link: '/games', queryParams: { status: 'ONLINE', sort: 'hours' } });
    expect(STAT_LINKS.rating).toEqual({ link: '/games', queryParams: { sort: 'rating' } });
    expect(STAT_LINKS.games).toEqual({ link: '/games', queryParams: null });
    expect(STAT_LINKS.runs).toEqual({ link: '/games', queryParams: null });
    expect(STAT_LINKS.sagas).toEqual({ link: '/sagas', queryParams: null });
  });

  it('only uses values the library accepts from the URL', () => {
    for (const { queryParams } of Object.values(STAT_LINKS)) {
      if (queryParams?.category) expect(parseCategoryFilter(queryParams.category)).toBe(queryParams.category);
      if (queryParams?.status) expect(parseStatusFilter(queryParams.status)).toBe(queryParams.status);
      if (queryParams?.sort) expect(parseSort(queryParams.sort)).toBe(queryParams.sort);
    }
  });
});
