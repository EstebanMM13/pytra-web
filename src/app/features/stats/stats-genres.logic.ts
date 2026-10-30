import { Game } from '../../core/models/game.model';
import { GenreAbandonment, GenreRating, GenreStat, RunFact } from '../../core/models/stats.model';
import { MIN_ABANDONMENT_SAMPLE, MIN_GENRE_RATINGS, totalHours } from './stats.logic';

/** One genre as the genres section reads it: hours and games, plus its rating and abandonment. */
export interface GenreProfile {
  genreId: number;
  /** The name as displayed (see `genreProfiles`). */
  name: string;
  hours: number;
  gameCount: number;
  /** Share (0..1) of all the hours played that went to games of this genre (genres overlap). */
  share: number;
  /** Mean rating when at least `MIN_GENRE_RATINGS` runs are rated, else null. */
  rating: number | null;
  ratedCount: number;
  /** Abandoned share of the finished runs when at least `MIN_ABANDONMENT_SAMPLE`, else null. */
  abandonment: number | null;
  /** Completed + abandoned runs (the abandonment sample). */
  finished: number;
}

/** Display order of genres with equal figures: by displayed name (Spanish collation, any case), then id. */
function byDisplayName(a: { name: string; genreId: number }, b: { name: string; genreId: number }): number {
  return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }) || a.genreId - b.genreId;
}

/**
 * The hours a genre's share is measured against. `/stats/by-genre` credits each confirmed game
 * with all its hours: every run (dated or not) plus its whole online playtime. The library list
 * carries the same per-game total (`Game.totalHours`, run + online), so the confirmed games'
 * totals are the matching base. `/stats/by-year` is only the fallback (library not loaded or
 * failed): it counts dated runs and the online hours logged in the diary, so it can be smaller
 * than a genre's hours, and `genreProfiles` clamps the share to 100%.
 */
export function genreShareBase(
  library: readonly Pick<Game, 'totalHours' | 'reviewStatus'>[] | null,
  years: readonly { totalHours: number }[],
): number {
  const confirmed = (library ?? []).filter((g) => g.reviewStatus !== 'PENDING_REVIEW');
  return confirmed.length ? confirmed.reduce((sum, g) => sum + (g.totalHours ?? 0), 0) : totalHours(years);
}

/**
 * Every genre with games, most hours first (ties: more games, then the displayed name, then the
 * id), joined with its rating and abandonment figures. Rates on tiny samples are left out (null)
 * rather than shown as facts. `base` is the share's denominator (see `genreShareBase`); a game in
 * two genres counts in both, and a share never exceeds 1.
 */
export function genreProfiles(
  byGenre: readonly GenreStat[],
  ratings: readonly GenreRating[],
  abandonment: readonly GenreAbandonment[],
  base: number,
  displayName: (name: string) => string = (name) => name,
): GenreProfile[] {
  const ratingOf = new Map(ratings.map((r) => [r.genreId, r]));
  const abandonOf = new Map(abandonment.map((a) => [a.genreId, a]));
  return byGenre
    .filter((g) => g.gameCount > 0 || g.totalHours > 0)
    .map((g) => {
      const rated = ratingOf.get(g.genreId);
      const runs = abandonOf.get(g.genreId);
      const finished = runs ? runs.completedCount + runs.abandonedCount : 0;
      return {
        genreId: g.genreId,
        name: displayName(g.genreName),
        hours: g.totalHours,
        gameCount: g.gameCount,
        share: base > 0 ? Math.min(1, g.totalHours / base) : 0,
        rating: rated && rated.ratedCount >= MIN_GENRE_RATINGS ? rated.averageRating : null,
        ratedCount: rated?.ratedCount ?? 0,
        abandonment: runs && finished >= MIN_ABANDONMENT_SAMPLE ? runs.abandonmentRate : null,
        finished,
      };
    })
    .sort((a, b) => b.hours - a.hours || b.gameCount - a.gameCount || byDisplayName(a, b));
}

/** The genres that stand out, each null when no genre qualifies. */
export interface GenreHighlights {
  /** Best mean rating (among genres with enough ratings). */
  bestRated: GenreProfile | null;
  /** Highest abandonment rate above 0 (among genres with enough finished runs). */
  mostAbandoned: GenreProfile | null;
  /** Most games in the library. */
  mostGames: GenreProfile | null;
}

/** The highest scoring profile; ties go to the most hours, then the displayed name, then the id. */
function best(profiles: readonly GenreProfile[], score: (p: GenreProfile) => number): GenreProfile | null {
  return [...profiles].sort((a, b) => score(b) - score(a) || b.hours - a.hours || byDisplayName(a, b))[0] ?? null;
}

export function genreHighlights(profiles: readonly GenreProfile[]): GenreHighlights {
  return {
    bestRated: best(profiles.filter((p) => p.rating !== null), (p) => p.rating!),
    mostAbandoned: best(profiles.filter((p) => (p.abandonment ?? 0) > 0), (p) => p.abandonment!),
    mostGames: best(profiles.filter((p) => p.gameCount > 0), (p) => p.gameCount),
  };
}

/** Whether a library game has genre `genreId`. */
export function inGenre(genreId: number): (game: Pick<Game, 'genres'>) => boolean {
  return (game) => (game.genres ?? []).some((genre) => genre.id === genreId);
}

/** The genre with the most run hours of a year. */
export interface GenreOfYear {
  year: number;
  genreId: number;
  /** The name as displayed. */
  name: string;
  hours: number;
  /** Share (0..1) of the year's run hours spent on games of this genre. */
  share: number;
}

/**
 * Each year's genre with the most run hours, newest year first: the runs' hours (`/stats/play-facts`)
 * credited to every genre of their game (from the library list). Runs without a year, without
 * hours or of games the library does not list are left out; a listed game without genres counts
 * in the year's total only. Online playtime is not a run. Ties go to the displayed name, then
 * the id.
 */
export function genresOfTheYear(
  runs: readonly Pick<RunFact, 'gameId' | 'year' | 'hours'>[],
  games: readonly Pick<Game, 'id' | 'genres'>[],
  displayName: (name: string) => string = (name) => name,
): GenreOfYear[] {
  const genresOf = new Map(games.map((g) => [g.id, g.genres ?? []]));
  const years = new Map<number, { total: number; byGenre: Map<number, { name: string; hours: number }> }>();
  for (const run of runs) {
    const genres = genresOf.get(run.gameId);
    if (run.year === null || run.hours <= 0 || !genres) continue;
    const entry = years.get(run.year) ?? { total: 0, byGenre: new Map() };
    entry.total += run.hours;
    for (const genre of genres) {
      const acc = entry.byGenre.get(genre.id) ?? { name: displayName(genre.name), hours: 0 };
      acc.hours += run.hours;
      entry.byGenre.set(genre.id, acc);
    }
    years.set(run.year, entry);
  }
  const result: GenreOfYear[] = [];
  for (const [year, entry] of years) {
    const top = [...entry.byGenre]
      .map(([genreId, g]) => ({ genreId, ...g }))
      .sort((a, b) => b.hours - a.hours || byDisplayName(a, b))[0];
    if (top) result.push({ year, genreId: top.genreId, name: top.name, hours: top.hours, share: top.hours / entry.total });
  }
  return result.sort((a, b) => b.year - a.year);
}
