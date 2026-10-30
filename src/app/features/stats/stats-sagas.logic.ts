import { Game } from '../../core/models/game.model';
import { gameGroupFigures } from '../sagas/saga.logic';

/** A saga's progress as the sagas page counts it (played games of its reviewed games). */
export interface SagaProgress {
  sagaId: number;
  name: string;
  played: number;
  total: number;
  hours: number;
}

/** What the sagas add up to, and the two that stand out. */
export interface SagaInsights {
  /** Every game played. */
  complete: number;
  /** Some games played, some not. */
  inProgress: number;
  /** No game played yet. */
  notStarted: number;
  /** The unfinished saga with the most of its games played (by share, then by size, then by name). */
  closest: SagaProgress | null;
  /** The saga with the most hours (ties by name). */
  longest: SagaProgress | null;
}

/** One computation per library list: the hub and the genres page read the same list. */
const progressCache = new WeakMap<readonly Game[], SagaProgress[]>();

/**
 * Each saga's progress, grouped from the library's games with the sagas page's figures
 * (`gameGroupFigures`: games pending review are left out). A saga whose games are all pending
 * review has no reviewed game and is left out here, while the sagas page still lists it (empty).
 * Memoised per list instance.
 */
export function sagaProgress(games: readonly Game[]): SagaProgress[] {
  const cached = progressCache.get(games);
  if (cached) return cached;
  const groups = new Map<number, Game[]>();
  for (const game of games) {
    if (game.sagaId === null) continue;
    const group = groups.get(game.sagaId) ?? [];
    group.push(game);
    groups.set(game.sagaId, group);
  }
  const progress = [...groups]
    .map(([sagaId, group]) => {
      const figures = gameGroupFigures(group);
      return { sagaId, name: group[0].sagaName ?? '', played: figures.played, total: figures.total, hours: figures.hours };
    })
    .filter((saga) => saga.total > 0);
  progressCache.set(games, progress);
  return progress;
}

const byName = (a: SagaProgress, b: SagaProgress): number =>
  a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }) || a.sagaId - b.sagaId;

export function sagaInsights(sagas: readonly SagaProgress[]): SagaInsights {
  const unfinished = sagas.filter((s) => s.played > 0 && s.played < s.total);
  const closest =
    [...unfinished].sort((a, b) => b.played / b.total - a.played / a.total || b.total - a.total || byName(a, b))[0] ?? null;
  const longest = [...sagas].filter((s) => s.hours > 0).sort((a, b) => b.hours - a.hours || byName(a, b))[0] ?? null;
  return {
    complete: sagas.filter((s) => s.played === s.total).length,
    inProgress: unfinished.length,
    notStarted: sagas.filter((s) => s.played === 0).length,
    closest,
    longest,
  };
}
