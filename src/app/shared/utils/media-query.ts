/** One MediaQueryList per query string, plus the matchMedia that created it. */
const cache = new Map<string, { source: typeof matchMedia; list: MediaQueryList }>();

/**
 * Shared MediaQueryList for `query`, created once instead of on every check (hot paths such as a
 * pointermove read it per event). Rebuilt if `matchMedia` itself was replaced (tests swap it). Null
 * where matchMedia is missing (jsdom, SSR).
 */
export function mediaQuery(query: string): MediaQueryList | null {
  if (typeof matchMedia !== 'function') {
    return null;
  }
  let entry = cache.get(query);
  if (!entry || entry.source !== matchMedia) {
    entry = { source: matchMedia, list: matchMedia(query) };
    cache.set(query, entry);
  }
  return entry.list;
}
