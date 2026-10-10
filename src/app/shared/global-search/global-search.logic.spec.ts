import { Game } from '../../core/models/game.model';
import { Saga } from '../../core/models/saga.model';
import {
  GROUP_LIMITS,
  INITIAL_GAME_COUNT,
  SearchSources,
  buildSearchGroups,
  flattenGroups,
  matchRank,
  releaseYear,
  searchItemLink,
} from './global-search.logic';

function game(id: number, name: string, partial: Partial<Game> = {}): Game {
  return {
    id,
    name,
    developer: null,
    publisher: null,
    releaseDate: null,
    category: null,
    sagaId: null,
    sagaName: null,
    coverImageUrl: null,
    reviewStatus: 'CONFIRMED',
    genres: [],
    updatedAt: '2024-01-01T00:00:00',
    ...partial,
  };
}

function saga(id: number, name: string): Saga {
  return { id, name, updatedAt: '2024-01-01T00:00:00' };
}

const PAGES = [
  { page: { path: '/dashboard', labelKey: 'nav.home' }, label: 'Inicio' },
  { page: { path: '/games', labelKey: 'nav.games' }, label: 'Juegos' },
  { page: { path: '/years', labelKey: 'nav.years' }, label: 'Años' },
];

function sources(partial: Partial<SearchSources> = {}): SearchSources {
  return { games: [], sagas: [], years: [], pages: PAGES, ...partial };
}

describe('matchRank', () => {
  it('ranks prefix, word-start and substring matches', () => {
    expect(matchRank('zelda: breath', 'zel')).toBe(0);
    expect(matchRank('the legend of zelda', 'zel')).toBe(1);
    expect(matchRank('hollow knight', 'low')).toBe(2);
    expect(matchRank('hollow knight', 'xyz')).toBeNull();
  });
});

describe('buildSearchGroups', () => {
  it('shows recent games and every shortcut when the query is empty', () => {
    const games = [
      game(1, 'Old', { lastPlayedAt: '2020-01-01' }),
      game(2, 'Never'),
      game(3, 'New', { lastPlayedAt: '2024-05-01' }),
      game(4, 'Mid', { lastPlayedYear: 2022 }),
    ];
    const groups = buildSearchGroups(sources({ games, sagas: [saga(1, 'Zelda')], years: [2024] }), '  ');

    expect(groups.map((g) => g.kind)).toEqual(['game', 'page']);
    expect(groups[0].entries.map((e) => (e.item.kind === 'game' ? e.item.game.name : ''))).toEqual([
      'New',
      'Mid',
      'Old',
      'Never',
    ]);
    expect(groups[1].entries).toHaveLength(PAGES.length);
  });

  it('caps the initial games list', () => {
    const games = Array.from({ length: 10 }, (_, i) => game(i, `Game ${i}`));
    expect(buildSearchGroups(sources({ games }), '')[0].entries).toHaveLength(INITIAL_GAME_COUNT);
  });

  it('matches every group accent- and case-insensitively, prefix matches first', () => {
    const games = [game(1, 'Super Pokémon Ranger'), game(2, 'Pokemon Rojo'), game(3, 'Halo')];
    const groups = buildSearchGroups(
      sources({ games, sagas: [saga(1, 'Pokémon'), saga(2, 'Halo')], years: [2020] }),
      'POKE',
    );

    expect(groups.map((g) => g.kind)).toEqual(['game', 'saga']);
    expect(flattenGroups(groups).map((i) => (i.kind === 'game' ? i.game.id : i.kind === 'saga' ? i.saga.name : null))).toEqual([
      2,
      1,
      'Pokémon',
    ]);
  });

  it('matches years by digits (newest first) and pages by translated label', () => {
    const groups = buildSearchGroups(sources({ years: [2019, 2021, 2020] }), '202');
    expect(flattenGroups(groups)).toEqual([
      { kind: 'year', year: 2021 },
      { kind: 'year', year: 2020 },
    ]);

    const pages = flattenGroups(buildSearchGroups(sources(), 'anos'));
    expect(pages).toEqual([{ kind: 'page', ...PAGES[2] }]);
  });

  it('limits each group and numbers entries across groups for keyboard navigation', () => {
    const games = Array.from({ length: 20 }, (_, i) => game(i, `Mario ${i}`));
    const sagas = Array.from({ length: 20 }, (_, i) => saga(i, `Mario saga ${i}`));
    const groups = buildSearchGroups(sources({ games, sagas }), 'mario');

    expect(groups[0].entries).toHaveLength(GROUP_LIMITS.game);
    expect(groups[1].entries).toHaveLength(GROUP_LIMITS.saga);
    const indexes = groups.flatMap((g) => g.entries.map((e) => e.index));
    expect(indexes).toEqual(indexes.map((_, i) => i));
    expect(new Set(groups.flatMap((g) => g.entries.map((e) => e.key))).size).toBe(indexes.length);
  });

  it('returns no groups when nothing matches', () => {
    expect(buildSearchGroups(sources({ games: [game(1, 'Halo')] }), 'zzz')).toEqual([]);
  });
});

describe('searchItemLink', () => {
  it('maps every kind to its route', () => {
    expect(searchItemLink({ kind: 'game', game: game(7, 'X') })).toEqual(['/games', 7]);
    expect(searchItemLink({ kind: 'saga', saga: saga(3, 'S') })).toEqual(['/sagas', 3]);
    expect(searchItemLink({ kind: 'year', year: 2023 })).toEqual(['/years', 2023]);
    expect(searchItemLink({ kind: 'page', ...PAGES[1] })).toEqual(['/games']);
  });
});

describe('releaseYear', () => {
  it('reads the year from the release date', () => {
    expect(releaseYear(game(1, 'A', { releaseDate: '2017-03-03' }))).toBe(2017);
    expect(releaseYear(game(1, 'A'))).toBeNull();
  });
});
