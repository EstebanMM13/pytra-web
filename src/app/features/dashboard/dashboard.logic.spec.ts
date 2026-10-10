import { InProgressExperience, StatsSummary, YearStat } from '../../core/models/stats.model';
import { dayOfYear, daysSince, pickTagline, taglineCandidates, TaglineInput } from './dashboard.logic';

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
