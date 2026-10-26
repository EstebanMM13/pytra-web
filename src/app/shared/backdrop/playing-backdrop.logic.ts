import { Game } from '../../core/models/game.model';
import { backdropCoverUrl, nextCoverSource } from '../ui/game-cover';

/** At most this many games share the background. */
export const MAX_BACKDROP_GAMES = 5;

/** Most recent activity (`yyyy-MM-dd`, so it sorts as text); '' when unknown. */
function lastActivity(game: Game): string {
  return game.lastActivityAt ?? game.lastPlayedAt ?? '';
}

/**
 * The games the background is made of: confirmed games whose latest run is in progress, most
 * recently played first (unknown dates last, ties in list order), at most `MAX_BACKDROP_GAMES`.
 * Empty when there are none: the page keeps its aura.
 */
export function backdropGames(games: readonly Game[]): Game[] {
  return games
    .filter((game) => game.lastExperienceStatus === 'EN_CURSO' && game.reviewStatus !== 'PENDING_REVIEW')
    .sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)))
    .slice(0, MAX_BACKDROP_GAMES);
}

/**
 * Images to try for a game's strip, in order: the backdrop-sized cover, then the cover's own
 * fallback chain (original url, Steam landscape art). Empty when the game has no cover.
 */
export function backdropCoverChain(url: string | null | undefined): string[] {
  const chain: string[] = [];
  let next = backdropCoverUrl(url);
  while (next && !chain.includes(next)) {
    chain.push(next);
    next = nextCoverSource(url, next, chain[0]);
  }
  return chain;
}
