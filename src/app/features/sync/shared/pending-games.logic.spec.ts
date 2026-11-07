import { Game } from '../../../core/models/game.model';
import { PendingItem, visiblePending } from './pending-games.logic';

function item(id: number, name: string, hours: number, lastPlayedAt: string | null = null): PendingItem {
  return { game: { id, name } as Game, hours, lastPlayedAt, badge: null };
}

const ids = (items: readonly PendingItem[]) => items.map((i) => i.game.id);

describe('visiblePending', () => {
  const items = [
    item(1, 'Zelda', 2, '2026-01-01T10:00:00Z'),
    item(2, 'Pokémon Rojo', 40, null),
    item(3, 'Astro Bot', 40, '2026-03-01T10:00:00Z'),
    item(4, 'Hades', 0, '2026-02-01T10:00:00Z'),
  ];

  it('sorts by most hours, breaking ties by name', () => {
    expect(ids(visiblePending(items, '', 'hours'))).toEqual([3, 2, 1, 4]);
  });

  it('sorts by latest session, with never-played games last', () => {
    expect(ids(visiblePending(items, '', 'recent'))).toEqual([3, 4, 1, 2]);
  });

  it('sorts by name', () => {
    expect(ids(visiblePending(items, '', 'name'))).toEqual([3, 4, 2, 1]);
  });

  it('finds names ignoring case, accents and surrounding spaces', () => {
    expect(ids(visiblePending(items, '  POKEMON ', 'hours'))).toEqual([2]);
  });

  it('does not reorder the list it receives', () => {
    visiblePending(items, '', 'name');
    expect(ids(items)).toEqual([1, 2, 3, 4]);
  });
});
