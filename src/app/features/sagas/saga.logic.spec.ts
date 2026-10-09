import { Game } from '../../core/models/game.model';
import { Saga } from '../../core/models/saga.model';
import { playedPercent, sagaMetaLine, summarizeSaga, summarizeSagas } from './saga.logic';

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
