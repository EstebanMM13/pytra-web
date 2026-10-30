import { Game } from '../../core/models/game.model';
import { sagaInsights, sagaProgress } from './stats-sagas.logic';

const game = (id: number, sagaId: number | null, played: boolean, hours = 0, reviewStatus = 'CONFIRMED'): Game =>
  ({
    id,
    name: `G${id}`,
    sagaId,
    sagaName: sagaId ? `Saga ${sagaId}` : null,
    reviewStatus,
    experienceCount: played ? 1 : 0,
    totalHours: hours,
    releaseDate: null,
  }) as unknown as Game;

describe('saga insights', () => {
  const library = [
    game(1, 1, true, 50),
    game(2, 1, true, 20),
    game(3, 2, true, 100),
    game(4, 2, false),
    game(5, 2, false),
    game(6, 3, true, 5),
    game(7, 3, true, 5),
    game(8, 3, false),
    game(9, 4, false),
    game(10, null, true, 999),
    // A saga whose only game is pending review: nothing reviewed to count.
    game(11, 5, true, 30, 'PENDING_REVIEW'),
  ];
  const progress = sagaProgress(library);

  it('groups the library games by saga, as the sagas page counts them, leaving out sagas without reviewed games', () => {
    expect(progress.find((s) => s.sagaId === 2)).toEqual({ sagaId: 2, name: 'Saga 2', played: 1, total: 3, hours: 100 });
    expect(progress.map((s) => s.sagaId).sort()).toEqual([1, 2, 3, 4]);
  });

  it('computes once per library list', () => {
    expect(sagaProgress(library)).toBe(progress);
    expect(sagaProgress([...library])).not.toBe(progress);
  });

  it('counts complete, in progress and not started sagas, and finds the closest and the longest', () => {
    const insights = sagaInsights(progress);
    expect(insights).toMatchObject({ complete: 1, inProgress: 2, notStarted: 1 });
    expect(insights.closest?.sagaId).toBe(3);
    expect(insights.longest?.sagaId).toBe(2);
  });

  it('breaks ties by size, then by name', () => {
    const tied = [
      { sagaId: 1, name: 'Zeta', played: 1, total: 2, hours: 10 },
      { sagaId: 2, name: 'alpha', played: 2, total: 4, hours: 10 },
      { sagaId: 3, name: 'Beta', played: 2, total: 4, hours: 10 },
    ];
    const insights = sagaInsights(tied);
    expect(insights.closest?.name).toBe('alpha');
    expect(insights.longest?.name).toBe('alpha');
  });

  it('has nothing to point at without sagas', () => {
    expect(sagaInsights([])).toEqual({ complete: 0, inProgress: 0, notStarted: 0, closest: null, longest: null });
  });
});
