import { Game } from '../../core/models/game.model';
import { bestRatedDecade, decadeOf, inDecade, releaseExtremes, topDecade } from './stats-eras.logic';

const decade = (d: number, hours: number, gameCount: number, averageRating: number | null, ratedGameCount: number) => ({
  decade: d,
  hours,
  gameCount,
  averageRating,
  ratedGameCount,
});

describe('eras logic', () => {
  it('puts a release year in its decade', () => {
    expect(decadeOf(1997)).toBe(1990);
    expect(decadeOf(2000)).toBe(2000);
  });

  it('finds the decade with the most hours, ties by games', () => {
    expect(topDecade([decade(1990, 10, 1, null, 0), decade(2000, 50, 2, null, 0), decade(2010, 50, 5, null, 0)])?.decade).toBe(2010);
    expect(topDecade([decade(1990, 0, 1, null, 0)])).toBeNull();
  });

  it('ranks decade ratings only with enough rated games', () => {
    const decades = [decade(1990, 1, 1, 9.9, 1), decade(2000, 1, 5, 8, 4), decade(2010, 1, 9, 7, 9)];
    expect(bestRatedDecade(decades)?.decade).toBe(2000);
    expect(bestRatedDecade([decade(1990, 1, 1, 9.9, 1)])).toBeNull();
  });

  const game = (id: number, releaseDate: string | null, played = true) =>
    ({ id, name: `G${id}`, releaseDate, experienceCount: played ? 1 : 0, totalHours: 0 }) as unknown as Game;

  it('matches library games by release decade', () => {
    expect(inDecade(1990)(game(1, '1998-05-01'))).toBe(true);
    expect(inDecade(1990)(game(2, '2001-01-01'))).toBe(false);
    expect(inDecade(1990)(game(3, null))).toBe(false);
  });

  it('finds the oldest and the newest played release, unplayed and undated games left out', () => {
    const { oldest, newest } = releaseExtremes([game(1, '2001-03-02'), game(2, '1994-12-01'), game(3, '1980-01-01', false), game(4, null), game(5, '2024-06-01')]);
    expect(oldest?.id).toBe(2);
    expect(newest?.id).toBe(5);
    expect(releaseExtremes([])).toEqual({ oldest: null, newest: null });
  });

  it('breaks decade ties explicitly: more games, then the newer decade', () => {
    expect(topDecade([decade(1990, 50, 2, null, 0), decade(2000, 50, 2, null, 0)])?.decade).toBe(2000);
    expect(bestRatedDecade([decade(1990, 1, 5, 8, 4), decade(2000, 1, 5, 8, 3)])?.decade).toBe(1990);
  });

  it('orders partial release dates by year first, and equal dates by id', () => {
    const { oldest, newest } = releaseExtremes([
      game(1, '2001-05-01'),
      game(2, '2001'),
      game(3, '2001-01'),
      game(4, '2024-06-01'),
      game(5, '2024-06-01'),
    ]);
    // A bare year sorts before its months; the same date resolves by id.
    expect(oldest?.id).toBe(2);
    expect(newest?.id).toBe(5);
  });
});
