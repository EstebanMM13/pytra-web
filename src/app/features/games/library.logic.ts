import { ExperienceStatus } from '../../core/models/experience.model';
import { Game, GameCategory } from '../../core/models/game.model';
import { PlatformRef } from '../../core/models/platform.model';
import { distinctPlatformRefs } from '../../core/services/platform.logic';
import { todayIso } from '../../shared/utils/run-dates';

/**
 * Status tab of the library toolbar. `PENDIENTE` also covers games with no runs yet, except online
 * games: those are tracked through online playtime, not runs, so they get their own `ONLINE` tab.
 */
export type LibraryStatusFilter = 'ALL' | 'EN_CURSO' | 'COMPLETADO' | 'ABANDONADO' | 'PENDIENTE' | 'ONLINE';
export type LibrarySort = 'recent' | 'name' | 'rating' | 'hours';

export const LIBRARY_STATUS_FILTERS: readonly LibraryStatusFilter[] = [
  'ALL',
  'EN_CURSO',
  'COMPLETADO',
  'ABANDONADO',
  'PENDIENTE',
  'ONLINE',
];
export const LIBRARY_SORTS: readonly LibrarySort[] = ['recent', 'name', 'rating', 'hours'];
export const LIBRARY_PAGE_SIZE = 10;

/** Category dropdown of the toolbar: a game category or all. */
export type LibraryCategoryFilter = 'ALL' | GameCategory;

export const GAME_CATEGORIES: readonly GameCategory[] = ['SINGLEPLAYER', 'ONLINE', 'HYBRID'];
export const LIBRARY_CATEGORY_FILTERS: readonly LibraryCategoryFilter[] = ['ALL', ...GAME_CATEGORIES];

/**
 * Platforms the user's games were played on, distinct, by name (the options of the platform filter).
 * The API's platformRefs already merge run platforms with the online playtime's platforms.
 */
export function libraryPlatforms(games: readonly Game[]): PlatformRef[] {
  return distinctPlatformRefs(games.flatMap((g) => g.platformRefs ?? [])).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }),
  );
}

export interface LibraryQuery {
  text: string;
  status: LibraryStatusFilter;
  sort: LibrarySort;
  /** Catalog platform ids (as text, they live in the URL); a game matches with ANY of them. Empty: all. */
  platforms?: readonly string[];
  /** Genre ids; a game matches when it has ALL of them. Empty: all. */
  genres?: readonly number[];
  /** Defaults to 'ALL' when omitted. */
  category?: LibraryCategoryFilter;
  /** Developer names; a game matches when its developer is ANY of them (accent/case-insensitive). Empty: all. */
  developers?: readonly string[];
  /** Publisher names; same rules as `developers`. */
  publishers?: readonly string[];
}

/** Steam imports waiting for review live on /steam until confirmed; the library only lists confirmed games. */
export function isLibraryGame(game: Game): boolean {
  return game.reviewStatus !== 'PENDING_REVIEW';
}

/** Lower-case, accent-free text for forgiving name matching ("pokemon" finds "Pokémon"). */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Online (or hybrid) game with no runs: played through online playtime, so never "pending". */
export function isOnlineOnly(game: Game): boolean {
  return !game.lastExperienceStatus && (game.category === 'ONLINE' || game.category === 'HYBRID');
}

export function matchesStatus(game: Game, status: LibraryStatusFilter): boolean {
  if (status === 'ALL') {
    return true;
  }
  if (status === 'ONLINE') {
    // Every game with an online side, so hybrids also show here alongside their run status tab.
    return game.category === 'ONLINE' || game.category === 'HYBRID';
  }
  const last = game.lastExperienceStatus ?? null;
  return status === 'PENDIENTE' ? last === 'PENDIENTE' || (last === null && !isOnlineOnly(game)) : last === status;
}

/** ANY of the platforms (none picked: every game). */
export function matchesPlatforms(game: Game, platforms: readonly string[] | undefined): boolean {
  return !platforms?.length || (game.platformRefs ?? []).some((ref) => platforms.includes(String(ref.id)));
}

/** ALL of the genres, so each extra genre narrows the list (none picked: every game). */
export function matchesGenres(game: Game, genres: readonly number[] | undefined): boolean {
  if (!genres?.length) return true;
  const ids = new Set((game.genres ?? []).map((g) => g.id));
  return genres.every((id) => ids.has(id));
}

/** ANY of the names, compared accent/case-insensitively (none picked: every game). */
export function matchesName(value: string | null | undefined, names: readonly string[] | undefined): boolean {
  if (!names?.length) {
    return true;
  }
  const key = normalizeText(value ?? '');
  return !!key && names.some((name) => normalizeText(name) === key);
}

/** Text, platform, genre, category, developer and publisher filters: everything except the status tab. */
export function matchesPanelFilters(game: Game, query: LibraryQuery): boolean {
  return (
    matchesText(game, query.text) &&
    matchesPlatforms(game, query.platforms) &&
    matchesGenres(game, query.genres) &&
    matchesCategory(game, query.category) &&
    matchesName(game.developer, query.developers) &&
    matchesName(game.publisher, query.publishers)
  );
}

/** Number of filters set in the filter panel (category, each platform, genre, developer and publisher). */
export function panelFilterCount(
  query: Pick<LibraryQuery, 'category' | 'platforms' | 'genres' | 'developers' | 'publishers'>,
): number {
  return (
    (query.category && query.category !== 'ALL' ? 1 : 0) +
    (query.platforms?.length ?? 0) +
    (query.genres?.length ?? 0) +
    (query.developers?.length ?? 0) +
    (query.publishers?.length ?? 0)
  );
}

/**
 * Distinct non-blank values of a game field (developer or publisher), trimmed, sorted for Spanish.
 * Values differing only in case or accents collapse into the first one seen.
 */
export function libraryNames(games: readonly Game[], pick: (game: Game) => string | null | undefined): string[] {
  const byKey = new Map<string, string>();
  for (const game of games) {
    const name = cleanName(pick(game) ?? '');
    const key = normalizeText(name);
    if (key && !byKey.has(key)) {
      byKey.set(key, name);
    }
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true }));
}

/** Genres present in the games, distinct, by display name (the options of the genre filter). */
export function libraryGenres(
  games: readonly Game[],
  format: (name: string) => string,
): { id: number; label: string }[] {
  const byId = new Map<number, string>();
  for (const genre of games.flatMap((g) => g.genres ?? [])) {
    byId.set(genre.id, format(genre.name));
  }
  return [...byId].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

export function matchesCategory(game: Game, category: LibraryCategoryFilter | undefined): boolean {
  return !category || category === 'ALL' || game.category === category;
}

/** Announced game whose release date (`yyyy-MM-dd`) is still ahead of `today`. */
export function isUpcoming(game: Pick<Game, 'releaseDate'>, today: string = todayIso()): boolean {
  return !!game.releaseDate && game.releaseDate.slice(0, 10) > today;
}

/** The search box matches the game's name, developer or publisher. */
export function matchesText(game: Game, text: string): boolean {
  const needle = normalizeText(text);
  return (
    !needle ||
    [game.name, game.developer, game.publisher].some((value) => !!value && normalizeText(value).includes(needle))
  );
}

/** Count per status tab, for the given (already name-filtered) games. */
export function countByStatus(games: readonly Game[]): Record<LibraryStatusFilter, number> {
  const counts = Object.fromEntries(LIBRARY_STATUS_FILTERS.map((s) => [s, 0])) as Record<
    LibraryStatusFilter,
    number
  >;
  for (const game of games) {
    for (const status of LIBRARY_STATUS_FILTERS) {
      if (matchesStatus(game, status)) {
        counts[status]++;
      }
    }
  }
  return counts;
}

const byName = (a: Game, b: Game) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });

/** Descending by a nullable number; missing values always go last, ties by name. */
function byNumberDesc(pick: (g: Game) => number | null | undefined) {
  return (a: Game, b: Game): number => {
    const va = pick(a) ?? null;
    const vb = pick(b) ?? null;
    if (va === null && vb === null) {
      return byName(a, b);
    }
    if (va === null) {
      return 1;
    }
    if (vb === null) {
      return -1;
    }
    return vb - va || byName(a, b);
  };
}

/** Sortable `yyyy-MM-dd` for "last played": the exact date, else the end of `lastPlayedYear`. */
export function lastPlayedKey(game: Game): string | null {
  if (game.lastPlayedAt) {
    return game.lastPlayedAt.slice(0, 10);
  }
  return game.lastPlayedYear != null ? `${String(game.lastPlayedYear).padStart(4, '0')}-12-31` : null;
}

const COMPARATORS: Record<LibrarySort, (a: Game, b: Game) => number> = {
  // Most recent `lastPlayedAt` first; games without it fall back to `lastPlayedYear`
  // (compared as the year's last day), then most recently updated, then name.
  recent: (a, b) => {
    const ka = lastPlayedKey(a);
    const kb = lastPlayedKey(b);
    if (ka !== kb) {
      return ka === null ? 1 : kb === null ? -1 : kb.localeCompare(ka);
    }
    return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || byName(a, b);
  },
  name: byName,
  rating: byNumberDesc((g) => g.bestRating),
  hours: byNumberDesc((g) => (g.totalHours ? g.totalHours : null)),
};

export function sortGames(games: readonly Game[], sort: LibrarySort): Game[] {
  return [...games].sort(COMPARATORS[sort]);
}

export function filterGames(games: readonly Game[], query: LibraryQuery): Game[] {
  return sortGames(
    games.filter(
      (g) => matchesPanelFilters(g, query) && matchesStatus(g, query.status),
    ),
    query.sort,
  );
}

export interface Page<T> {
  items: T[];
  /** 1-based page actually shown (clamped to the available range). */
  page: number;
  totalPages: number;
  total: number;
}

export function paginate<T>(items: readonly T[], page: number, pageSize = LIBRARY_PAGE_SIZE): Page<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), totalPages);
  const start = (current - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: current, totalPages, total: items.length };
}

export function parseStatusFilter(value: string | null): LibraryStatusFilter {
  return (LIBRARY_STATUS_FILTERS as readonly string[]).includes(value ?? '')
    ? (value as LibraryStatusFilter)
    : 'ALL';
}

export function parseSort(value: string | null): LibrarySort {
  return (LIBRARY_SORTS as readonly string[]).includes(value ?? '') ? (value as LibrarySort) : 'recent';
}

/** How the library lays out its games: rows, or a grid of box-art posters. */
export type LibraryView = 'list' | 'grid';

/** localStorage key of the library view (per device). */
export const LIBRARY_VIEW_KEY = 'pytra_library_view';

export function parseLibraryView(value: string | null): LibraryView {
  return value === 'grid' ? 'grid' : 'list';
}

/** Most ids a list filter keeps from the URL (anything longer is not a hand-made link). */
const MAX_FILTER_IDS = 30;

/**
 * Comma-separated catalog ids from the URL (`platform=3,14`; a single id from older links works too):
 * positive integers only, normalized, distinct, in order. Anything else is dropped.
 */
export function parseIdList(value: string | null): number[] {
  const ids = (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => /^\d{1,9}$/.test(part))
    .map(Number)
    .filter((n) => n > 0);
  return [...new Set(ids)].slice(0, MAX_FILTER_IDS);
}

/**
 * Drops filter ids the library does not have (a stale `?genre=999` from an old link or a deleted
 * genre), so they neither empty the list nor count as active filters. Keeps the order.
 */
export function pruneIds<T extends number | string>(ids: readonly T[], known: Iterable<T>): T[] {
  const valid = new Set(known);
  return ids.filter((id) => valid.has(id));
}

/** URL form of an id list; null (param removed) when empty. */
export function serializeIdList(ids: readonly (number | string)[]): string | null {
  return ids.length ? ids.join(',') : null;
}

/** Most characters a developer / publisher name keeps from the URL. */
const MAX_NAME_LENGTH = 100;

/** Trimmed, single-spaced name without control characters. */
function cleanName(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Developer / publisher names from repeated URL params (`dev=Nintendo&dev=Capcom`): cleaned,
 * non-blank, at most MAX_NAME_LENGTH characters, distinct (accent/case-insensitive), in order,
 * capped like the id lists. Anything else is dropped.
 */
export function parseNameList(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of values) {
    const name = cleanName(raw);
    const key = normalizeText(name);
    if (!key || name.length > MAX_NAME_LENGTH || seen.has(key)) {
      continue;
    }
    seen.add(key);
    names.push(name);
    if (names.length === MAX_FILTER_IDS) {
      break;
    }
  }
  return names;
}

/**
 * Keeps the names the library has (accent/case-insensitive), spelled as the library spells them,
 * in order; drops the rest (stale links), like pruneIds.
 */
export function pruneNames(names: readonly string[], known: readonly string[]): string[] {
  const byKey = new Map(known.map((name) => [normalizeText(name), name]));
  return names.flatMap((name) => {
    const match = byKey.get(normalizeText(name));
    return match === undefined ? [] : [match];
  });
}

/** URL form of a name list (one repeated param per name); null (param removed) when empty. */
export function serializeNameList(names: readonly string[]): string[] | null {
  return names.length ? [...names] : null;
}

export function parseCategoryFilter(value: string | null): LibraryCategoryFilter {
  return (LIBRARY_CATEGORY_FILTERS as readonly string[]).includes(value ?? '') ? (value as LibraryCategoryFilter) : 'ALL';
}

export function parsePage(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/**
 * What a library row says next to its status dot: the last run's status; for ONLINE games just the
 * hours played (their badge already says "Online"); "Online" for HYBRID games without runs; else "no runs".
 */
export type LibraryStatusLine = 'status' | 'played' | 'online' | 'noRuns';

export function libraryStatusLine(game: Game): LibraryStatusLine {
  if (game.lastExperienceStatus) return 'status';
  if (game.category === 'ONLINE') return 'played';
  return isOnlineOnly(game) ? 'online' : 'noRuns';
}

/** The status a library row shows: the game's last run, or null when it has none. */
export function rowStatus(game: Game): ExperienceStatus | null {
  return game.lastExperienceStatus ?? null;
}
