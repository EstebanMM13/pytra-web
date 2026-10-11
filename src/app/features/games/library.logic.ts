import { ExperienceStatus } from '../../core/models/experience.model';
import { Game } from '../../core/models/game.model';
import { PlatformRef } from '../../core/models/platform.model';
import { distinctPlatformRefs } from '../../core/services/platform.logic';

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

/** Platform dropdown of the toolbar: a catalog platform id (as text, it lives in the URL) or all. */
export type LibraryPlatformFilter = string;

/** Platforms the user's games have runs on, distinct, by name (the options of the platform filter). */
export function libraryPlatforms(games: readonly Game[]): PlatformRef[] {
  return distinctPlatformRefs(games.flatMap((g) => g.platformRefs ?? [])).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }),
  );
}

export interface LibraryQuery {
  text: string;
  status: LibraryStatusFilter;
  sort: LibrarySort;
  /** Defaults to 'ALL' when omitted. */
  platform?: LibraryPlatformFilter;
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
    return isOnlineOnly(game);
  }
  const last = game.lastExperienceStatus ?? null;
  return status === 'PENDIENTE' ? last === 'PENDIENTE' || (last === null && !isOnlineOnly(game)) : last === status;
}

export function matchesPlatform(game: Game, platform: LibraryPlatformFilter | undefined): boolean {
  return !platform || platform === 'ALL' || (game.platformRefs ?? []).some((ref) => String(ref.id) === platform);
}

export function matchesText(game: Game, text: string): boolean {
  const needle = normalizeText(text);
  return !needle || normalizeText(game.name).includes(needle);
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
      (g) => matchesText(g, query.text) && matchesStatus(g, query.status) && matchesPlatform(g, query.platform),
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

export function parsePlatformFilter(value: string | null): LibraryPlatformFilter {
  return value && /^\d+$/.test(value) ? String(Number(value)) : 'ALL';
}

export function parsePage(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** The status a library row shows: the game's last run, or null when it has none. */
export function rowStatus(game: Game): ExperienceStatus | null {
  return game.lastExperienceStatus ?? null;
}
