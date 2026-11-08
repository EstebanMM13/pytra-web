import { signal } from '@angular/core';

/**
 * Shared-element route transition of a game cover: the library poster that was tapped and the game
 * detail hero carry the same `view-transition-name`, so the router's view transition morphs one
 * into the other (and back on Back). Only the tapped poster is named: a page must never hold two
 * elements with one name (the browser would skip the whole transition), and naming every poster
 * would make the browser snapshot hundreds of covers per navigation.
 *
 * The name lives only while the user is on that game: opening another game, or finishing a
 * transition to a page outside `games/<id>`, clears it (see `settleCoverTransition`), so a stale
 * poster never morphs into the wrong hero or flies alone. With reduced motion the router skips
 * every view transition (see core/view-transitions.ts).
 */
export const COVER_TRANSITION_NAME = 'game-cover';

const activeGameId = signal<string | null>(null);

/**
 * Names the tapped poster at once (the router snapshots the old page before the next render, so a
 * template binding alone could be too late) and remembers its game for the way back.
 */
export function markCoverTransition(gameId: number | string, link?: EventTarget | null): void {
  activeGameId.set(String(gameId));
  const cover = link instanceof Element ? link.querySelector<HTMLElement>('app-game-cover') : null;
  cover?.style.setProperty('view-transition-name', COVER_TRANSITION_NAME);
}

/** The `view-transition-name` of a library poster: the shared name for the tapped game, else none. */
export function posterTransitionName(gameId: number | string): string | null {
  return activeGameId() === String(gameId) ? COVER_TRANSITION_NAME : null;
}

/** Whether `path` (`games/7`, `games/7/runs/3`) belongs to the game whose poster was tapped. */
function onActiveGame(path: string): boolean {
  const active = activeGameId();
  return active !== null && (path === `games/${active}` || path.startsWith(`games/${active}/`));
}

/** A navigation to `toPath` starts: opening a different game drops the old poster's name right away. */
export function beginCoverTransition(toPath: string): void {
  if (/^games\/[^/]+/.test(toPath) && !onActiveGame(toPath)) activeGameId.set(null);
}

/** A navigation to `toPath` finished: outside the tapped game, the name has served its way back. */
export function settleCoverTransition(toPath: string): void {
  if (!onActiveGame(toPath)) activeGameId.set(null);
}
