import { Game } from '../../core/models/game.model';
import {
  countByStatus,
  filterGames,
  isLibraryGame,
  isOnlineOnly,
  isUpcoming,
  pendingSource,
  pendingSummary,
  matchesCategory,
  parseCategoryFilter,
  lastPlayedKey,
  libraryPlatforms,
  matchesPlatforms,
  matchesGenres,
  libraryGenres,
  libraryStatusLine,
  panelFilterCount,
  parseIdList,
  pruneIds,
  serializeIdList,
  matchesStatus,
  paginate,
  parseLibraryView,
  parsePage,
  parseSort,
  parseStatusFilter,
  sortGames,
  libraryNames,
  matchesName,
  matchesText,
  parseNameList,
  pruneNames,
  serializeNameList,
} from './library.logic';

const PC = { id: 1, name: 'PC', color: '#8A857C' };
const PS5 = { id: 2, name: 'PS5', color: '#4F7BE8' };
const SWITCH = { id: 14, name: 'Switch', color: '#E0524C' };
const DS = { id: 20, name: 'DS', color: '#E0524C' };

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
    platforms: [],
    platformRefs: [],
    lastPlayedAt: null,
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
      expect(countByStatus(all)).toEqual({ ALL: 5, EN_CURSO: 1, COMPLETADO: 1, ABANDONADO: 1, PENDIENTE: 2, ONLINE: 0 });
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

    it('filters by platform (games with a run on it)', () => {
      const pc = game({ id: 10, name: 'Hades', platformRefs: [PC, SWITCH] });
      const ps = game({ id: 11, name: 'Astro Bot', platformRefs: [PS5] });
      const list = [pc, ps, unplayed];
      expect(filterGames(list, { text: '', status: 'ALL', sort: 'name', platforms: ['14'] }).map((g) => g.id)).toEqual([10]);
      // ANY of the picked platforms.
      expect(filterGames(list, { text: '', status: 'ALL', sort: 'name', platforms: ['14', '2'] }).map((g) => g.id)).toEqual([11, 10]);
      expect(filterGames(list, { text: '', status: 'ALL', sort: 'name', platforms: [] })).toHaveLength(3);
      expect(matchesPlatforms(unplayed, ['1'])).toBe(false);
      expect(matchesPlatforms(game({ id: 12, name: 'X', platformRefs: null }), ['1'])).toBe(false);
    });

    it('filters by genre: a game matches only with ALL picked genres', () => {
      const rpg = { id: 1, name: 'RPG' };
      const acc = { id: 2, name: 'ACCIÓN' };
      const both = game({ id: 10, name: 'Elden Ring', genres: [rpg, acc] });
      const action = game({ id: 11, name: 'DOOM', genres: [acc] });
      const list = [both, action, unplayed];
      expect(filterGames(list, { text: '', status: 'ALL', sort: 'name', genres: [1] }).map((g) => g.id)).toEqual([10]);
      expect(filterGames(list, { text: '', status: 'ALL', sort: 'name', genres: [1, 2] }).map((g) => g.id)).toEqual([10]);
      expect(filterGames(list, { text: '', status: 'ALL', sort: 'name', genres: [2] }).map((g) => g.id)).toEqual([11, 10]);
      expect(matchesGenres(unplayed, [])).toBe(true);
      expect(matchesGenres(game({ id: 12, name: 'X', genres: undefined as never }), [1])).toBe(false);
      expect(libraryGenres(list, (n) => n.toLowerCase())).toEqual([
        { id: 2, label: 'acción' },
        { id: 1, label: 'rpg' },
      ]);
    });

    it('combines panel filters with AND across kinds and counts them', () => {
      const a = game({ id: 10, name: 'A', category: 'ONLINE', platformRefs: [PC], genres: [{ id: 1, name: 'RPG' }] });
      const b = game({ id: 11, name: 'B', category: 'SINGLEPLAYER', platformRefs: [PC], genres: [{ id: 1, name: 'RPG' }] });
      const query = { text: '', status: 'ALL' as const, sort: 'name' as const, category: 'ONLINE' as const, platforms: ['1'], genres: [1] };
      expect(filterGames([a, b], query).map((g) => g.id)).toEqual([10]);
      expect(panelFilterCount(query)).toBe(3);
      expect(panelFilterCount({ category: 'ALL', platforms: [], genres: [] })).toBe(0);
    });

    it('lists the platforms present in the games, distinct and by name', () => {
      const list = [
        game({ id: 10, name: 'Hades', platformRefs: [PC, SWITCH] }),
        game({ id: 11, name: 'Astro Bot', platformRefs: [PS5, PC] }),
        game({ id: 12, name: 'Pokémon Platino', platformRefs: [DS] }),
        unplayed,
      ];
      expect(libraryPlatforms(list).map((p) => p.name)).toEqual(['DS', 'PC', 'PS5', 'Switch']);
      expect(libraryPlatforms([unplayed])).toEqual([]);
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

    it('sorts by lastPlayedAt, falling back to the year of the last run', () => {
      const march = game({ id: 20, name: 'March', lastPlayedAt: '2024-03-10', lastPlayedYear: 2024 });
      const june = game({ id: 21, name: 'June', lastPlayedAt: '2024-06-01', lastPlayedYear: 2024 });
      const yearOnly = game({ id: 22, name: 'Year only', lastPlayedYear: 2024 });
      const older = game({ id: 23, name: 'Older', lastPlayedAt: '2023-12-31', lastPlayedYear: 2023 });
      expect(sortGames([older, march, yearOnly, june, unplayed], 'recent').map((g) => g.id)).toEqual([22, 21, 20, 23, 4]);
      expect(lastPlayedKey(march)).toBe('2024-03-10');
      expect(lastPlayedKey(yearOnly)).toBe('2024-12-31');
      expect(lastPlayedKey(unplayed)).toBeNull();
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
      expect(parseIdList('14')).toEqual([14]);
      expect(parseIdList('014,3, 3 ,7')).toEqual([14, 3, 7]);
      expect(parseIdList('PS5,1.5,-2,0,,99999999999')).toEqual([]);
      expect(parseIdList(null)).toEqual([]);
      expect(parseIdList(Array.from({ length: 50 }, (_, i) => i + 1).join(','))).toHaveLength(30);
    });

    it('round-trips id lists through the URL', () => {
      expect(serializeIdList([3, 14])).toBe('3,14');
      expect(parseIdList(serializeIdList([3, 14]))).toEqual([3, 14]);
      expect(serializeIdList([])).toBeNull();
      expect(parseIdList(serializeIdList([]))).toEqual([]);
    });
  });
});

describe('pruneIds', () => {
  it('drops filter ids the library does not have, keeping the order', () => {
    expect(pruneIds([999, 3, 7], [7, 3])).toEqual([3, 7]);
    expect(pruneIds(['14', '2'], ['2'])).toEqual(['2']);
    expect(pruneIds([5], [])).toEqual([]);
  });
});

describe('library status line', () => {
  it('shows only the hours for ONLINE games, "Online" for HYBRID ones without runs', () => {
    expect(libraryStatusLine(game({ id: 1, name: 'Fortnite', category: 'ONLINE' }))).toBe('played');
    expect(libraryStatusLine(game({ id: 2, name: 'COD', category: 'HYBRID' }))).toBe('online');
    expect(libraryStatusLine(game({ id: 3, name: 'COD 2', category: 'HYBRID', lastExperienceStatus: 'COMPLETADO' }))).toBe('status');
    expect(libraryStatusLine(game({ id: 4, name: 'Zelda' }))).toBe('noRuns');
  });
});

describe('online-only games', () => {
  const fortnite = game({ id: 1, name: 'Fortnite', category: 'ONLINE', lastExperienceStatus: null });
  const codNoRuns = game({ id: 2, name: 'COD', category: 'HYBRID', lastExperienceStatus: null });
  const codWithRun = game({ id: 3, name: 'COD 2', category: 'HYBRID', lastExperienceStatus: 'COMPLETADO' });
  const backlog = game({ id: 4, name: 'GTA 6', category: 'SINGLEPLAYER', lastExperienceStatus: null });

  it('are online-only when online or hybrid without runs', () => {
    expect([fortnite, codNoRuns, codWithRun, backlog].map(isOnlineOnly)).toEqual([true, true, false, false]);
  });

  it('go to the ONLINE tab instead of PENDIENTE', () => {
    expect(matchesStatus(fortnite, 'ONLINE')).toBe(true);
    expect(matchesStatus(fortnite, 'PENDIENTE')).toBe(false);
    expect(matchesStatus(backlog, 'PENDIENTE')).toBe(true);
    expect(matchesStatus(backlog, 'ONLINE')).toBe(false);
  });

  it('lists hybrids with runs in the ONLINE tab as well as in their run status tab', () => {
    expect(matchesStatus(codWithRun, 'ONLINE')).toBe(true);
    expect(matchesStatus(codWithRun, codWithRun.lastExperienceStatus!)).toBe(true);
  });

  it('parses the library view, defaulting to the list', () => {
    expect(parseLibraryView('grid')).toBe('grid');
    expect(parseLibraryView('list')).toBe('list');
    expect(parseLibraryView(null)).toBe('list');
    expect(parseLibraryView('poster')).toBe('list');
  });
});

describe('category filter', () => {
  const zelda = game({ id: 1, name: 'Zelda', category: 'SINGLEPLAYER' });
  const fortnite = game({ id: 2, name: 'Fortnite', category: 'ONLINE' });
  const cod = game({ id: 3, name: 'COD', category: 'HYBRID' });
  const uncategorized = game({ id: 4, name: 'Old import', category: null });
  const games = [zelda, fortnite, cod, uncategorized];

  it('keeps every game for ALL or no category', () => {
    expect(games.filter((g) => matchesCategory(g, 'ALL'))).toHaveLength(4);
    expect(games.filter((g) => matchesCategory(g, undefined))).toHaveLength(4);
  });

  it('keeps only the games of the chosen category', () => {
    expect(filterGames(games, { text: '', status: 'ALL', sort: 'name', category: 'ONLINE' })).toEqual([fortnite]);
    expect(filterGames(games, { text: '', status: 'ALL', sort: 'name', category: 'HYBRID' })).toEqual([cod]);
    expect(filterGames(games, { text: '', status: 'ALL', sort: 'name', category: 'SINGLEPLAYER' })).toEqual([zelda]);
  });

  it('combines with the platform filter', () => {
    const ps5Online = { ...fortnite, platformRefs: [PS5] };
    expect(
      filterGames([zelda, ps5Online, cod], { text: '', status: 'ALL', sort: 'name', category: 'ONLINE', platforms: ['2'] }),
    ).toEqual([ps5Online]);
    expect(
      filterGames([zelda, ps5Online, cod], { text: '', status: 'ALL', sort: 'name', category: 'HYBRID', platforms: ['2'] }),
    ).toEqual([]);
  });

  it('parses the category query param, defaulting to ALL', () => {
    expect(parseCategoryFilter('ONLINE')).toBe('ONLINE');
    expect(parseCategoryFilter('HYBRID')).toBe('HYBRID');
    expect(parseCategoryFilter('SINGLEPLAYER')).toBe('SINGLEPLAYER');
    expect(parseCategoryFilter('online')).toBe('ALL');
    expect(parseCategoryFilter(null)).toBe('ALL');
  });
});

describe('online platforms in the library', () => {
  // The API merges online playtime platforms into platformRefs, so online-only games have platforms too.
  const fortnite = game({ id: 1, name: 'Fortnite', category: 'ONLINE', platformRefs: [PC, PS5] });
  const zelda = game({ id: 2, name: 'Zelda', platformRefs: [SWITCH] });

  it('offers the platforms of online-only games in the platform filter', () => {
    expect(libraryPlatforms([fortnite, zelda]).map((p) => p.name)).toEqual(['PC', 'PS5', 'Switch']);
  });

  it('lets online-only games match a platform', () => {
    expect(matchesPlatforms(fortnite, ['2'])).toBe(true);
    expect(matchesPlatforms(fortnite, ['14'])).toBe(false);
  });
});

describe('upcoming games', () => {
  const today = '2026-10-15';

  it('are the ones released after today', () => {
    expect(isUpcoming({ releaseDate: '2026-10-16' }, today)).toBe(true);
    expect(isUpcoming({ releaseDate: '2027-03-01' }, today)).toBe(true);
  });

  it('exclude games released today, before, or without a date', () => {
    expect(isUpcoming({ releaseDate: '2026-10-15' }, today)).toBe(false);
    expect(isUpcoming({ releaseDate: '1998-11-21' }, today)).toBe(false);
    expect(isUpcoming({ releaseDate: null }, today)).toBe(false);
  });
});

describe('developer and publisher filters', () => {
  const games = [
    game({ id: 1, name: 'Elden Ring', developer: 'FromSoftware', publisher: 'Bandai Namco' }),
    game({ id: 2, name: 'Sekiro', developer: 'FromSoftware', publisher: 'Activision' }),
    game({ id: 3, name: 'Pokémon Rojo', developer: 'Game Freak', publisher: 'Nintendo' }),
    game({ id: 4, name: 'Tekken 8', developer: ' Bandai  Namco ', publisher: 'BANDAI NAMCO' }),
    game({ id: 5, name: 'Indie', developer: null, publisher: '  ' }),
  ];
  const ids = (list: Game[]) => list.map((g) => g.id).sort();

  it('matches the search text on name, developer and publisher, accent/case-insensitively', () => {
    expect(matchesText(games[0], 'fromsoft')).toBe(true);
    expect(matchesText(games[0], 'BANDAI')).toBe(true);
    expect(matchesText(games[2], 'pokemon')).toBe(true);
    expect(matchesText(games[2], 'nintendo')).toBe(true);
    expect(matchesText(games[4], 'nintendo')).toBe(false);
    expect(ids(filterGames(games, { text: 'freak', status: 'ALL', sort: 'name' }))).toEqual([3]);
  });

  it('matches ANY name within a kind and every kind together', () => {
    expect(matchesName('FromSoftware', undefined)).toBe(true);
    expect(matchesName(null, [])).toBe(true);
    expect(matchesName(null, ['FromSoftware'])).toBe(false);
    expect(matchesName('Bandai Namco', ['bandai namco'])).toBe(true);

    const query = { text: '', status: 'ALL', sort: 'name' } as const;
    expect(ids(filterGames(games, { ...query, developers: ['FromSoftware', 'Game Freak'] }))).toEqual([1, 2, 3]);
    expect(
      ids(filterGames(games, { ...query, developers: ['FromSoftware'], publishers: ['Activision', 'Nintendo'] })),
    ).toEqual([2]);
  });

  it('counts each picked developer and publisher as a filter', () => {
    expect(panelFilterCount({ category: 'ALL', developers: ['A', 'B'], publishers: ['C'] })).toBe(3);
  });

  it('lists the distinct names present, trimmed, case/accent-merged and sorted', () => {
    expect(libraryNames(games, (g) => g.developer)).toEqual(['Bandai Namco', 'FromSoftware', 'Game Freak']);
    expect(libraryNames(games, (g) => g.publisher)).toEqual(['Activision', 'Bandai Namco', 'Nintendo']);
  });

  it('parses names from repeated URL params: cleaned, distinct, bounded', () => {
    expect(parseNameList(['  Capcom ', 'capcom', '', '   ', 'Square\nEnix','x'.repeat(101), 'Sega'])).toEqual([
      'Capcom',
      'Square Enix',
      'Sega',
    ]);
    expect(parseNameList(Array.from({ length: 50 }, (_, i) => `Studio ${i}`))).toHaveLength(30);
  });

  it('round-trips names through the URL, commas and symbols included', () => {
    const names = ['Square Enix, Inc.', 'Bandai Namco & Co', 'Ubisoft/Montreal'];
    expect(parseNameList(serializeNameList(names) ?? [])).toEqual(names);
    expect(serializeNameList([])).toBeNull();
  });

  it('prunes names the library does not have and adopts its spelling', () => {
    expect(pruneNames(['fromsoftware', 'Konami', 'BANDAI NAMCO'], ['Bandai Namco', 'FromSoftware'])).toEqual([
      'FromSoftware',
      'Bandai Namco',
    ]);
  });
});

describe('pendingSource', () => {
  const a = game({ id: 101, name: 'A', reviewStatus: 'PENDING_REVIEW' });
  const b = game({ id: 102, name: 'B', reviewStatus: 'PENDING_REVIEW' });

  it('is steam or psn only when every pending game is in that list', () => {
    expect(pendingSource([a, b], new Set([101, 102]), new Set())).toBe('steam');
    expect(pendingSource([a, b], new Set(), new Set([101, 102]))).toBe('psn');
  });

  it('is mixed with games from both sources, or when a source is unknown', () => {
    expect(pendingSource([a, b], new Set([101]), new Set([102]))).toBe('mixed');
    expect(pendingSource([a, b], new Set([101]), new Set())).toBe('mixed');
    expect(pendingSource([a], new Set(), new Set())).toBe('mixed');
  });
});

describe('pendingSummary', () => {
  const a = game({ id: 101, name: 'A', reviewStatus: 'PENDING_REVIEW' });
  const b = game({ id: 102, name: 'B', reviewStatus: 'PENDING_REVIEW' });

  it('counts Steam and PSN pending games together and names a single source', () => {
    expect(pendingSummary([a, b], [])).toEqual({ count: 2, source: 'steam' });
    expect(pendingSummary([], [a])).toEqual({ count: 1, source: 'psn' });
  });

  it('is mixed with both sources, counting a game in both lists once', () => {
    expect(pendingSummary([a], [b])).toEqual({ count: 2, source: 'mixed' });
    expect(pendingSummary([a, b], [b]).count).toBe(2);
  });

  it('is empty with nothing pending', () => {
    expect(pendingSummary([], []).count).toBe(0);
  });
});
