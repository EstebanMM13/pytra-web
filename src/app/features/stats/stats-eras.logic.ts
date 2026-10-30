import { Game } from '../../core/models/game.model';
import { ReleaseDecadeStat } from '../../core/models/stats.model';
import { isPlayed } from '../sagas/saga.logic';
import { releaseYearOf } from './stats.logic';

/** Fewest rated games a decade needs before its mean rating is ranked. */
export const MIN_DECADE_RATED = 3;

/** The decade (first year) a release year belongs to: 1997 -> 1990. */
export function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10;
}

/** The decade with the most hours (ties: more games, then the newer decade); null when none has hours. */
export function topDecade<T extends Pick<ReleaseDecadeStat, 'decade' | 'hours' | 'gameCount'>>(decades: readonly T[]): T | null {
  return (
    [...decades]
      .filter((d) => d.hours > 0)
      .sort((a, b) => b.hours - a.hours || b.gameCount - a.gameCount || b.decade - a.decade)[0] ?? null
  );
}

/**
 * The decade with the best mean rating among those with at least `min` rated games (ties: more
 * rated games, then the newer decade).
 */
export function bestRatedDecade<T extends Pick<ReleaseDecadeStat, 'decade' | 'averageRating' | 'ratedGameCount'>>(
  decades: readonly T[],
  min = MIN_DECADE_RATED,
): T | null {
  return (
    [...decades]
      .filter((d) => d.averageRating !== null && d.ratedGameCount >= min)
      .sort((a, b) => b.averageRating! - a.averageRating! || b.ratedGameCount - a.ratedGameCount || b.decade - a.decade)[0] ??
    null
  );
}

/** Whether a library game was released in `decade` (its first year). */
export function inDecade(decade: number): (game: Pick<Game, 'releaseDate'>) => boolean {
  return (game) => {
    const year = releaseYearOf(game.releaseDate);
    return year !== null && decadeOf(year) === decade;
  };
}

/**
 * The played games released first and last. Release dates may be partial (`2001`, `2001-05`):
 * games are ordered by release year, then by the date as stored (a bare year sorts before its
 * months), then by id, so equal dates resolve the same way every time. Null when no played game
 * is dated.
 */
export function releaseExtremes(games: readonly Game[]): { oldest: Game | null; newest: Game | null } {
  const dated = games
    .filter((g) => isPlayed(g) && releaseYearOf(g.releaseDate) !== null)
    .sort(
      (a, b) =>
        releaseYearOf(a.releaseDate)! - releaseYearOf(b.releaseDate)! ||
        a.releaseDate!.localeCompare(b.releaseDate!) ||
        a.id - b.id,
    );
  return { oldest: dated[0] ?? null, newest: dated[dated.length - 1] ?? null };
}
