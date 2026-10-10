import { Game } from '../../core/models/game.model';
import { Saga } from '../../core/models/saga.model';
import { lastPlayedKey, normalizeText } from '../../features/games/library.logic';

/** App sections reachable from the search (matched by their translated label). */
export interface SearchPage {
  path: string;
  labelKey: string;
}

export type SearchItem =
  | { kind: 'page'; page: SearchPage; label: string }
  | { kind: 'game'; game: Game }
  | { kind: 'saga'; saga: Saga }
  | { kind: 'year'; year: number };

export type SearchGroupKind = SearchItem['kind'];

/** A result plus its position in the flat list used for keyboard navigation. */
export interface SearchEntry {
  item: SearchItem;
  index: number;
  key: string;
}

export interface SearchGroup {
  kind: SearchGroupKind;
  entries: SearchEntry[];
}

export interface SearchSources {
  games: readonly Game[];
  sagas: readonly Saga[];
  years: readonly number[];
  /** Pages with their already-translated labels. */
  pages: readonly { page: SearchPage; label: string }[];
}

/** Max results per group while typing. */
export const GROUP_LIMITS: Record<SearchGroupKind, number> = {
  game: 6,
  saga: 4,
  year: 4,
  page: 6,
};

/** Games shown before the user types anything (most recently played first). */
export const INITIAL_GAME_COUNT = 5;

/** Group order: content first, shortcuts last (they are shown first when the query is empty). */
const QUERY_ORDER: SearchGroupKind[] = ['game', 'saga', 'year', 'page'];
const INITIAL_ORDER: SearchGroupKind[] = ['game', 'page'];

/**
 * 0 when `text` starts with the query, 1 when a later word starts with it, 2 when it only
 * contains it, null when it does not match. Inputs are expected to be normalized.
 */
export function matchRank(text: string, query: string): number | null {
  const position = text.indexOf(query);
  if (position < 0) {
    return null;
  }
  if (position === 0) {
    return 0;
  }
  return /[\s:\-–—_/.(]/.test(text[position - 1]) ? 1 : 2;
}

/** Items whose `name` matches the query, best rank first, original order as tie-breaker. */
function rankByName<T>(items: readonly T[], name: (item: T) => string, query: string): T[] {
  return items
    .map((item, order) => ({ item, order, rank: matchRank(normalizeText(name(item)), query) }))
    .filter((r): r is { item: T; order: number; rank: number } => r.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .map((r) => r.item);
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name);
}

/** Most recently played first (games never played go last, by name). */
function byRecent(a: Game, b: Game): number {
  const ka = lastPlayedKey(a);
  const kb = lastPlayedKey(b);
  if (ka !== kb) {
    return ka === null ? 1 : kb === null ? -1 : kb.localeCompare(ka);
  }
  return byName(a, b);
}

function itemKey(item: SearchItem): string {
  switch (item.kind) {
    case 'page':
      return `page:${item.page.path}`;
    case 'game':
      return `game:${item.game.id}`;
    case 'saga':
      return `saga:${item.saga.id}`;
    case 'year':
      return `year:${item.year}`;
  }
}

function collectItems(sources: SearchSources, query: string): Record<SearchGroupKind, SearchItem[]> {
  if (!query) {
    return {
      game: [...sources.games]
        .sort(byRecent)
        .slice(0, INITIAL_GAME_COUNT)
        .map((game) => ({ kind: 'game', game })),
      page: sources.pages.map((p) => ({ kind: 'page', ...p })),
      saga: [],
      year: [],
    };
  }
  return {
    game: rankByName([...sources.games].sort(byName), (g) => g.name, query)
      .slice(0, GROUP_LIMITS.game)
      .map((game) => ({ kind: 'game', game })),
    saga: rankByName([...sources.sagas].sort(byName), (s) => s.name, query)
      .slice(0, GROUP_LIMITS.saga)
      .map((saga) => ({ kind: 'saga', saga })),
    year: [...sources.years]
      .sort((a, b) => b - a)
      .filter((year) => String(year).includes(query))
      .slice(0, GROUP_LIMITS.year)
      .map((year) => ({ kind: 'year', year })),
    page: rankByName(sources.pages, (p) => p.label, query)
      .slice(0, GROUP_LIMITS.page)
      .map((p) => ({ kind: 'page', ...p })),
  };
}

/**
 * Grouped search results. With an empty query: recent games plus every shortcut; otherwise
 * accent/case-insensitive matches per group (prefix matches first), capped by GROUP_LIMITS.
 * Empty groups are dropped and each entry gets its index in the flat keyboard-navigation list.
 */
export function buildSearchGroups(sources: SearchSources, rawQuery: string): SearchGroup[] {
  const query = normalizeText(rawQuery);
  const items = collectItems(sources, query);
  let index = 0;
  return (query ? QUERY_ORDER : INITIAL_ORDER)
    .filter((kind) => items[kind].length > 0)
    .map((kind) => ({
      kind,
      entries: items[kind].map((item) => ({ item, index: index++, key: itemKey(item) })),
    }));
}

export function flattenGroups(groups: readonly SearchGroup[]): SearchItem[] {
  return groups.flatMap((group) => group.entries.map((entry) => entry.item));
}

/** Router commands for a result. */
export function searchItemLink(item: SearchItem): (string | number)[] {
  switch (item.kind) {
    case 'page':
      return [item.page.path];
    case 'game':
      return ['/games', item.game.id];
    case 'saga':
      return ['/sagas', item.saga.id];
    case 'year':
      return ['/years', item.year];
  }
}

/** Release year of a game (from `yyyy-MM-dd`), or null when unknown. */
export function releaseYear(game: Game): number | null {
  const year = game.releaseDate ? Number(game.releaseDate.slice(0, 4)) : NaN;
  return Number.isFinite(year) && year > 0 ? year : null;
}
