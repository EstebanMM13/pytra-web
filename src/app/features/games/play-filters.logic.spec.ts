import { RunFact } from '../../core/models/stats.model';
import {
  NO_PLAY_FILTERS,
  PlayFilters,
  buildPlayIndex,
  bucketRange,
  matchesDecade,
  matchesPlay,
  parseDecade,
  parsePlayedYear,
  parseRange,
  playFilterCount,
  serializeRange,
} from './play-filters.logic';

function run(partial: Partial<RunFact>): RunFact {
  return {
    experienceId: 1,
    gameId: 1,
    platformId: 10,
    year: 2024,
    status: 'COMPLETADO',
    hours: 12,
    daysToFinish: 20,
    ...partial,
  };
}

const filters = (partial: Partial<PlayFilters>): PlayFilters => ({ ...NO_PLAY_FILTERS, ...partial });

describe('play filter parsing', () => {
  it('parses ranges as min-max or open-ended min-', () => {
    expect(parseRange('8-30')).toEqual({ min: 8, max: 30 });
    expect(parseRange('366-')).toEqual({ min: 366, max: null });
    expect(parseRange('0-10')).toEqual({ min: 0, max: 10 });
    for (const bad of [null, '', '30-8', '-5', 'a-b', '1.5-3', '8-30-40', '123456-']) {
      expect(parseRange(bad)).toBeNull();
    }
  });

  it('serializes ranges back to the URL form', () => {
    expect(serializeRange({ min: 8, max: 30 })).toBe('8-30');
    expect(serializeRange({ min: 60, max: null })).toBe('60-');
    expect(serializeRange(null)).toBeNull();
    expect(parseRange(serializeRange(bucketRange(10, 30)))).toEqual({ min: 10, max: 30 });
    expect(bucketRange(366, null)).toEqual({ min: 366, max: null });
  });

  it('accepts plausible played years and decades only', () => {
    expect(parsePlayedYear('2024')).toBe(2024);
    expect(parsePlayedYear('24')).toBeNull();
    expect(parsePlayedYear('1900')).toBeNull();
    expect(parseDecade('1990')).toBe(1990);
    expect(parseDecade('1995')).toBeNull();
    expect(parseDecade('abcd')).toBeNull();
  });

  it('counts the active run filters', () => {
    expect(playFilterCount(NO_PLAY_FILTERS)).toBe(0);
    expect(playFilterCount(filters({ year: 2024, days: { min: 0, max: 7 } }))).toBe(2);
  });
});

describe('matchesDecade', () => {
  it('keeps games released in the decade', () => {
    expect(matchesDecade({ releaseDate: '1998-03-01' }, 1990)).toBe(true);
    expect(matchesDecade({ releaseDate: '2000-01-01' }, 1990)).toBe(false);
    expect(matchesDecade({ releaseDate: null }, 1990)).toBe(false);
    expect(matchesDecade({ releaseDate: null }, null)).toBe(true);
  });
});

describe('matchesPlay', () => {
  const index = buildPlayIndex({
    runs: [
      run({ experienceId: 1, gameId: 1, platformId: 10, year: 2024, daysToFinish: 20, hours: 12 }),
      run({ experienceId: 2, gameId: 1, platformId: 20, year: 2023, status: 'ABANDONADO', daysToFinish: null, hours: 70 }),
      run({ experienceId: 3, gameId: 2, platformId: 20, year: null, daysToFinish: 400, hours: 61 }),
    ],
    onlineYears: [{ gameId: 3, year: 2024, platformIds: [30] }],
  });

  it('passes every game when no run filter is set, even without facts', () => {
    expect(matchesPlay(undefined, NO_PLAY_FILTERS)).toBe(true);
  });

  it('fails games without facts once a run filter is set', () => {
    expect(matchesPlay(undefined, filters({ year: 2024 }))).toBe(false);
  });

  it('matches the played year from runs and online play', () => {
    expect(matchesPlay(index.get(1), filters({ year: 2023 }))).toBe(true);
    expect(matchesPlay(index.get(2), filters({ year: 2024 }))).toBe(false);
    expect(matchesPlay(index.get(3), filters({ year: 2024 }))).toBe(true);
  });

  it('checks the platform on the same run (or online year) as the year', () => {
    // Game 1 has a platform-20 run, but in 2023: not "platform 20 in 2024".
    expect(matchesPlay(index.get(1), filters({ year: 2024 }), ['20'])).toBe(false);
    expect(matchesPlay(index.get(1), filters({ year: 2024 }), ['10'])).toBe(true);
    expect(matchesPlay(index.get(3), filters({ year: 2024 }), ['30'])).toBe(true);
    expect(matchesPlay(index.get(3), filters({ year: 2024 }), ['10'])).toBe(false);
  });

  it('matches days to finish inclusively on completed, timed runs', () => {
    expect(matchesPlay(index.get(1), filters({ days: { min: 8, max: 20 } }))).toBe(true);
    expect(matchesPlay(index.get(1), filters({ days: { min: 21, max: 30 } }))).toBe(false);
    expect(matchesPlay(index.get(2), filters({ days: { min: 366, max: null } }))).toBe(true);
    // With a year: the timed run must be of that year (game 2's has none).
    expect(matchesPlay(index.get(2), filters({ days: { min: 366, max: null }, year: 2024 }))).toBe(false);
  });

  it('matches run hours on completed runs with an exclusive upper bound', () => {
    expect(matchesPlay(index.get(1), filters({ runHours: { min: 10, max: 30 } }))).toBe(true);
    expect(matchesPlay(index.get(1), filters({ runHours: { min: 0, max: 12 } }))).toBe(false);
    // The 70 h run was abandoned: it does not count, like in "Duration vs rating".
    expect(matchesPlay(index.get(1), filters({ runHours: { min: 60, max: null } }))).toBe(false);
    expect(matchesPlay(index.get(2), filters({ runHours: { min: 60, max: null } }))).toBe(true);
  });

  it('never matches online play for days or hours', () => {
    expect(matchesPlay(index.get(3), filters({ year: 2024, runHours: { min: 0, max: null } }))).toBe(false);
  });
});
