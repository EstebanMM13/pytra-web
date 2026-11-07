import { Game } from '../../../core/models/game.model';
import { normalizeText } from '../../games/library.logic';

/** What the pending list shows of a game, whichever integration imported it. */
export interface PendingItem<G extends Game = Game> {
  game: G;
  hours: number;
  /** ISO instant of the last session on the platform. */
  lastPlayedAt: string | null;
  /** Console of the imported title, when the integration has several. */
  badge: string | null;
}

export type PendingSort = 'hours' | 'recent' | 'name';

const byName = (a: PendingItem, b: PendingItem) =>
  a.game.name.localeCompare(b.game.name, undefined, { sensitivity: 'base' });

/** Never-played games sort last. */
const lastSession = (item: PendingItem) => (item.lastPlayedAt ? Date.parse(item.lastPlayedAt) : -Infinity);

const COMPARE: Record<PendingSort, (a: PendingItem, b: PendingItem) => number> = {
  hours: (a, b) => b.hours - a.hours || byName(a, b),
  recent: (a, b) => {
    const [left, right] = [lastSession(a), lastSession(b)];
    return left === right ? byName(a, b) : right > left ? 1 : -1;
  },
  name: byName,
};

/** The pending games matching `query` (forgiving on case and accents), in `sort` order. */
export function visiblePending<G extends Game>(
  items: readonly PendingItem<G>[],
  query: string,
  sort: PendingSort,
): PendingItem<G>[] {
  const needle = normalizeText(query);
  return items.filter((item) => normalizeText(item.game.name).includes(needle)).sort(COMPARE[sort]);
}
