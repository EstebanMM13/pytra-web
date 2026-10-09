import { Game } from '../../core/models/game.model';
import {
  countByStatus,
  filterGames,
  isLibraryGame,
  matchesStatus,
  paginate,
  parsePage,
  parseSort,
  parseStatusFilter,
  sortGames,
} from './library.logic';

function game(overrides: Partial<Game> & { id: number; name: string }): Game {
  return {
    developer: null,
    publisher: null,
    releaseDate: null,
    category: 'SINGLEPLAYER',
    sagaId: null,
    sagaName: null,
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

const hollow = game({ id: 1, name: 'Hollow Knight', experienceCount: 1, totalHours: 40, bestRating: 9.5, lastExperienceStatus: 'COMPLETADO', lastPlayedYear: 2023 });
const pokemon = game({ id: 2, name: 'Pokémon Rojo', experienceCount: 2, totalHours: 80, bestRating: 8, lastExperienceStatus: 'EN_CURSO', lastPlayedYear: 2025 });
const celeste = game({ id: 3, name: 'Celeste', experienceCount: 1, totalHours: 10, bestRating: 9.25, lastExperienceStatus: 'ABANDONADO', lastPlayedYear: 2023, updatedAt: '2025-06-01T00:00:00' });
const unplayed = game({ id: 4, name: 'Alan Wake' });
const planned = game({ id: 5, name: 'Bloodborne', experienceCount: 1, lastExperienceStatus: 'PENDIENTE', lastPlayedYear: null });
const all = [hollow, pokemon, celeste, unplayed, planned];

describe('library logic', () => {
  it('keeps Steam games pending review out of the library', () => {
    expect(isLibraryGame(hollow)).toBe(true);
    expect(isLibraryGame({ ...hollow, reviewStatus: 'PENDING_REVIEW' })).toBe(false);
  });

  describe('status filter', () => {
    it('matches the last run status; Pendientes also covers games without runs', () => {
      expect(matchesStatus(hollow, 'COMPLETADO')).toBe(true);
      expect(matchesStatus(hollow, 'EN_CURSO')).toBe(false);
      expect(matchesStatus(unplayed, 'PENDIENTE')).toBe(true);
      expect(matchesStatus(planned, 'PENDIENTE')).toBe(true);
      expect(matchesStatus(unplayed, 'ALL')).toBe(true);
    });

    it('counts every tab', () => {
      expect(countByStatus(all)).toEqual({ ALL: 5, EN_CURSO: 1, COMPLETADO: 1, ABANDONADO: 1, PENDIENTE: 2 });
    });
  });

  describe('filterGames', () => {
    it('matches names ignoring case and accents', () => {
      const result = filterGames(all, { text: '  POKEMON ', status: 'ALL', sort: 'name' });
      expect(result.map((g) => g.id)).toEqual([2]);
    });

    it('combines the text and status filters', () => {
      expect(filterGames(all, { text: 'e', status: 'PENDIENTE', sort: 'name' }).map((g) => g.id)).toEqual([4, 5]);
    });
  });

  describe('sortGames', () => {
    it('sorts by name', () => {
      expect(sortGames(all, 'name').map((g) => g.name)).toEqual([
        'Alan Wake',
        'Bloodborne',
        'Celeste',
        'Hollow Knight',
        'Pokémon Rojo',
      ]);
    });

    it('sorts by rating, highest first and unrated last', () => {
      expect(sortGames(all, 'rating').map((g) => g.id)).toEqual([1, 3, 2, 4, 5]);
    });

    it('sorts by hours, games without hours last', () => {
      expect(sortGames(all, 'hours').map((g) => g.id)).toEqual([2, 1, 3, 4, 5]);
    });

    it('sorts by last played year, then most recently updated; never played last', () => {
      expect(sortGames(all, 'recent').map((g) => g.id)).toEqual([2, 3, 1, 4, 5]);
    });

    it('does not mutate the input', () => {
      const input = [...all];
      sortGames(input, 'name');
      expect(input).toEqual(all);
    });
  });

  describe('paginate', () => {
    const items = Array.from({ length: 23 }, (_, i) => i);

    it('slices the requested page', () => {
      expect(paginate(items, 2, 10)).toEqual({ items: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19], page: 2, totalPages: 3, total: 23 });
      expect(paginate(items, 3, 10).items).toEqual([20, 21, 22]);
    });

    it('clamps out-of-range pages', () => {
      expect(paginate(items, 99, 10).page).toBe(3);
      expect(paginate(items, 0, 10).page).toBe(1);
      expect(paginate([], 4, 10)).toEqual({ items: [], page: 1, totalPages: 1, total: 0 });
    });
  });

  describe('query param parsing', () => {
    it('falls back to defaults for unknown values', () => {
      expect(parseStatusFilter('COMPLETADO')).toBe('COMPLETADO');
      expect(parseStatusFilter('nope')).toBe('ALL');
      expect(parseStatusFilter(null)).toBe('ALL');
      expect(parseSort('hours')).toBe('hours');
      expect(parseSort('constructor')).toBe('recent');
      expect(parsePage('3')).toBe(3);
      expect(parsePage('-1')).toBe(1);
      expect(parsePage('abc')).toBe(1);
      expect(parsePage('2.5')).toBe(1);
    });
  });
});
