import { signal } from '@angular/core';

/**
 * Shared-element route transition of a game cover: the library poster that was tapped and the game
 * detail hero carry the same `view-transition-name`, so the router's view transition morphs one
 * into the other (and back on Back). Only the tapped poster is named: a page must never hold two
 * elements with one name (the browser would skip the whole transition), and naming every poster
 * would make the browser snapshot hundreds of covers per navigation.
 *
 * With reduced motion the router skips every view transition (see core/view-transitions.ts).
 */
export const COVER_TRANSITION_NAME = 'game-cover';

const activeGameId = signal<number | string | null>(null);

/** Remembers the game whose poster was tapped, so its poster (and only it) gets the shared name. */
export function markCoverTransition(gameId: number | string): void {
  activeGameId.set(gameId);
}

/** The `view-transition-name` of a library poster: the shared name for the tapped game, else none. */
export function posterTransitionName(gameId: number | string): string | null {
  return activeGameId() === gameId ? COVER_TRANSITION_NAME : null;
}
