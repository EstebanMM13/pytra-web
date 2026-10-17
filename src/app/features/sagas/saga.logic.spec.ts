import { Game } from '../../core/models/game.model';
import { Saga } from '../../core/models/saga.model';
import {
  SAGA_SORTS,
  SagaSummary,
  isPlayed,
  lastActivityKey,
  parseSagaSort,
  playedPercent,
  sagaGameStatus,
  sagaMetaLine,
  sortSagas,
  summarizeSaga,
  summarizeSagas,
} from './saga.logic';

function game(overrides: Partial<Game> & { id: number; name: string }): Game {
  return {
    developer: null,
    publisher: null,
    releaseDate: null,
    category: 'SINGLEPLAYER',
    sagaId: 1,
    sagaName: 'God of War',
    coverImageUrl: null,
    reviewStatus: 'CONFIRMED',
    genres: [],
    updatedAt: '2025-01-01T00:00:00',
    experienceCount: 0,
    totalHours: 0,
    bestRating: null,
    lastExperienceStatus: null,
    lastPlayedYear: null,
    hasPlatinum: false,
    ...overrides,
  };
}

const gow: Saga = { id: 1, name: 'God of War', updatedAt: '' };
const zelda: Saga = { id: 2, name: 'Zelda', updatedAt: '' };
const empty: Saga = { id: 3, name: 'Alan Wake', updatedAt: '' };

const games: Game[] = [
  game({ id: 10, name: 'God of War (2018)', releaseDate: '2018-04-20', developer: 'Santa Monica Studio', experienceCount: 2, totalHours: 40, bestRating: 9, hasPlatinum: true }),
  game({ id: 11, name: 'God of War', releaseDate: '2005-03-22', developer: 'Santa Monica Studio', experienceCount: 1, totalHours: 12.5, bestRating: 8 }),
  game({ id: 12, name: 'Ascension', releaseDate: '2013-03-12', developer: 'Other' }),
  game({ id: 13, name: 'Ragnarök', releaseDate: '2022-11-09', reviewStatus: 'PENDING_REVIEW', experienceCount: 1, totalHours: 99 }),
  game({ id: 20, name: 'Zelda BotW', sagaId: 2, releaseDate: '2017-03-03', experienceCount: 1, totalHours: 100, bestRating: 10 }),
  game({ id: 30, name: 'No saga', sagaId: null, experienceCount: 1, totalHours: 5 }),
];

describe('saga logic', () => {
  it('aggregates a saga from its confirmed games', () => {
    const summary = summarizeSaga(gow, games);
    expect(summary.games.map((g) => g.id)).toEqual([11, 12, 10]);
    expect(summary).toMatchObject({
      total: 3,
      played: 2,
      hours: 52.5,
      avgRating: 8.5,
      platinums: 1,
      studio: 'Santa Monica Studio',
      firstYear: 2005,
      lastYear: 2018,
    });
    expect(playedPercent(summary)).toBe(67);
    expect(sagaMetaLine(summary)).toBe('Santa Monica Studio · 2005–2018');
  });

  it('handles sagas without games', () => {
    const summary = summarizeSaga(empty, games);
    expect(summary).toMatchObject({ total: 0, played: 0, hours: 0, avgRating: null, platinums: 0, studio: null });
    expect(playedPercent(summary)).toBe(0);
    expect(sagaMetaLine(summary)).toBe('');
  });

  it('shows a single year once', () => {
    expect(sagaMetaLine(summarizeSaga(zelda, games))).toBe('2017');
  });

  it('lists sagas alphabetically', () => {
    expect(summarizeSagas([zelda, gow, empty], games).map((s) => s.saga.name)).toEqual([
      'Alan Wake',
      'God of War',
      'Zelda',
    ]);
  });
});

describe('online-only saga games', () => {
  const onlineOnly = game({ id: 1, name: 'Online', category: 'ONLINE', experienceCount: 0, totalHours: 120 });
  const runs = game({ id: 2, name: 'Runs', experienceCount: 1, totalHours: 30, lastExperienceStatus: 'COMPLETADO' });
  const untouched = game({ id: 3, name: 'Untouched', experienceCount: 0, totalHours: 0 });
  const saga: Saga = { id: 1, name: 'Saga', updatedAt: '2025-01-01T00:00:00' };

  it('counts online hours without runs as played, with an Online status', () => {
    expect(isPlayed(onlineOnly)).toBe(true);
    expect(sagaGameStatus(onlineOnly)).toEqual({ kind: 'online' });
    expect(sagaGameStatus(runs)).toEqual({ kind: 'run', status: 'COMPLETADO' });
    expect(isPlayed(untouched)).toBe(false);
    expect(sagaGameStatus(untouched)).toEqual({ kind: 'notPlayed' });
  });

  it('includes them in the saga played count', () => {
    const summary = summarizeSaga(saga, [onlineOnly, runs, untouched]);
    expect(summary.played).toBe(2);
    expect(summary.total).toBe(3);
    expect(playedPercent(summary)).toBe(67);
  });
});

describe('saga activity', () => {
  it('keys a game by its activity date, then run date, then the end of its last played year', () => {
    expect(lastActivityKey(game({ id: 1, name: 'A', lastActivityAt: '2025-04-02', lastPlayedAt: '2024-01-01' }))).toBe('2025-04-02');
    expect(lastActivityKey(game({ id: 1, name: 'A', lastPlayedAt: '2024-01-01T10:00:00' }))).toBe('2024-01-01');
    expect(lastActivityKey(game({ id: 1, name: 'A', lastPlayedYear: 2019 }))).toBe('2019-12-31');
    expect(lastActivityKey(game({ id: 1, name: 'A' }))).toBeNull();
  });

  it('summarizes the latest activity among the saga games', () => {
    const summary = summarizeSaga(gow, [
      game({ id: 1, name: 'A', lastPlayedYear: 2023 }),
      game({ id: 2, name: 'B', lastActivityAt: '2024-06-01' }),
      game({ id: 3, name: 'C' }),
    ]);
    expect(summary.lastActivity).toBe('2024-06-01');
    expect(summarizeSaga(empty, games).lastActivity).toBeNull();
  });
});

describe('saga sorting', () => {
  function summary(name: string, figures: Partial<SagaSummary>): SagaSummary {
    return {
      saga: { id: name.length, name, updatedAt: '' },
      games: [],
      total: 0,
      played: 0,
      hours: 0,
      avgRating: null,
      platinums: 0,
      studio: null,
      firstYear: null,
      lastYear: null,
      lastActivity: null,
      ...figures,
    };
  }

  const halo = summary('Halo', { hours: 80, avgRating: 7.5, total: 4, played: 1, lastActivity: '2023-05-01' });
  const zeldaS = summary('zelda', { hours: 200, avgRating: 9, total: 2, played: 2, lastActivity: '2022-01-01' });
  const alan = summary('Alan Wake', { hours: 10, avgRating: null, total: 0, played: 0, lastActivity: null });
  const bio = summary('Bioshock', { hours: 80, avgRating: 9, total: 3, played: 3, lastActivity: '2025-02-02' });
  const list = [halo, zeldaS, alan, bio];
  const names = (sort: Parameters<typeof sortSagas>[1]) => sortSagas(list, sort).map((s) => s.saga.name);

  it('sorts by name A–Z, case-insensitively', () => {
    expect(names('name')).toEqual(['Alan Wake', 'Bioshock', 'Halo', 'zelda']);
  });

  it('sorts by hours, most first, ties by name', () => {
    expect(names('hours')).toEqual(['zelda', 'Bioshock', 'Halo', 'Alan Wake']);
  });

  it('sorts by average rating, best first, unrated last', () => {
    expect(names('rating')).toEqual(['Bioshock', 'zelda', 'Halo', 'Alan Wake']);
  });

  it('sorts by completion, sagas without games last', () => {
    expect(names('completion')).toEqual(['Bioshock', 'zelda', 'Halo', 'Alan Wake']);
  });

  it('sorts by recent activity, sagas without activity last', () => {
    expect(names('recent')).toEqual(['Bioshock', 'Halo', 'zelda', 'Alan Wake']);
  });

  it('does not mutate the input', () => {
    sortSagas(list, 'hours');
    expect(list.map((s) => s.saga.name)).toEqual(['Halo', 'zelda', 'Alan Wake', 'Bioshock']);
  });

  it('whitelists the sort query param', () => {
    for (const sort of SAGA_SORTS) {
      expect(parseSagaSort(sort)).toBe(sort);
    }
    expect(parseSagaSort(null)).toBe('name');
    expect(parseSagaSort(undefined)).toBe('name');
    expect(parseSagaSort('')).toBe('name');
    expect(parseSagaSort('HOURS')).toBe('name');
    expect(parseSagaSort('constructor')).toBe('name');
  });
});
