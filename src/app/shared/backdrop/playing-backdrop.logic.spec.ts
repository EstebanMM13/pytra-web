import { API_ORIGIN } from '../../core/api-base-url';
import { Game } from '../../core/models/game.model';
import { MAX_BACKDROP_GAMES, backdropCoverChain, backdropGames } from './playing-backdrop.logic';

const game = (id: number, overrides: Partial<Game> = {}): Game =>
  ({
    id,
    name: `Game ${id}`,
    reviewStatus: 'CONFIRMED',
    lastExperienceStatus: 'EN_CURSO',
    lastActivityAt: null,
    lastPlayedAt: null,
    ...overrides,
  }) as Game;

const ids = (games: Game[]): number[] => games.map((g) => g.id);

describe('backdropGames', () => {
  it('keeps only confirmed games whose latest run is in progress', () => {
    const games = [
      game(1),
      game(2, { lastExperienceStatus: 'COMPLETADO' }),
      game(3, { lastExperienceStatus: null }),
      game(4, { reviewStatus: 'PENDING_REVIEW' }),
      game(5),
    ];
    expect(ids(backdropGames(games))).toEqual([1, 5]);
  });

  it('orders by most recent activity, falling back to the last played date, unknown last', () => {
    const games = [
      game(1),
      game(2, { lastActivityAt: '2026-01-10' }),
      game(3, { lastPlayedAt: '2026-03-01' }),
      game(4, { lastActivityAt: '2026-05-02', lastPlayedAt: '2025-01-01' }),
    ];
    expect(ids(backdropGames(games))).toEqual([4, 3, 2, 1]);
  });

  it('keeps list order on ties', () => {
    const games = [
      game(7, { lastActivityAt: '2026-01-01' }),
      game(3, { lastActivityAt: '2026-01-01' }),
    ];
    expect(ids(backdropGames(games))).toEqual([7, 3]);
  });

  it(`caps the list at ${MAX_BACKDROP_GAMES}, keeping the most recent`, () => {
    const games = Array.from({ length: 8 }, (_, i) =>
      game(i + 1, { lastActivityAt: `2026-01-0${i + 1}` }),
    );
    expect(ids(backdropGames(games))).toEqual([8, 7, 6, 5, 4]);
  });

  it('is empty when nothing is in progress, so the aura stays', () => {
    expect(backdropGames([])).toEqual([]);
    expect(backdropGames([game(1, { lastExperienceStatus: 'ABANDONADO' })])).toEqual([]);
  });

  it('does not reorder the input list', () => {
    const games = [game(1), game(2, { lastActivityAt: '2026-01-01' })];
    backdropGames(games);
    expect(ids(games)).toEqual([1, 2]);
  });
});

describe('backdropCoverChain', () => {
  const igdb = (size: string) => `https://images.igdb.com/igdb/image/upload/${size}/abc.jpg`;

  it('tries the tiny IGDB cover first, then the stored one', () => {
    expect(backdropCoverChain(igdb('t_cover_big'))).toEqual([
      igdb('t_cover_small'),
      igdb('t_cover_big'),
    ]);
  });

  it('keeps an IGDB image that is already tiny', () => {
    expect(backdropCoverChain(igdb('t_thumb'))).toEqual([igdb('t_thumb')]);
  });

  it('thumbnails a Steam capsule to 120px, then tries the capsule and its landscape art', () => {
    const base = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/';
    const capsule = `${base}library_600x900.jpg`;
    expect(backdropCoverChain(capsule)).toEqual([
      `${API_ORIGIN}/api/v1/covers/thumb?url=${encodeURIComponent(capsule)}&w=120`,
      capsule,
      `${base}header.jpg`,
      `${base}capsule_616x353.jpg`,
    ]);
  });

  it('uses a custom url as is, and is empty without a cover', () => {
    expect(backdropCoverChain('https://example.com/c.png')).toEqual(['https://example.com/c.png']);
    expect(backdropCoverChain(null)).toEqual([]);
  });
});
