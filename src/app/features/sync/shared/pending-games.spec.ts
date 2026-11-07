import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { Game } from '../../../core/models/game.model';
import { PENDING_PAGE_SIZE, PendingGames } from './pending-games';
import { PendingItem } from './pending-games.logic';

function item(id: number, name: string, hours = 1, category: Game['category'] = 'SINGLEPLAYER', metadataPending = false): PendingItem {
  return { game: { id, name, category } as Game, hours, lastPlayedAt: null, badge: null, metadataPending };
}

describe('PendingGames', () => {
  let fixture: ComponentFixture<PendingGames>;

  function setup(items: PendingItem[], inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideTranslateService()] });
    fixture = TestBed.createComponent(PendingGames);
    fixture.componentRef.setInput('source', 'steam');
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('total', items.length);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const cards = () => [...el().querySelectorAll('li[data-pending-game]')] as HTMLElement[];
  const search = () => el().querySelector<HTMLInputElement>('input[type="search"]');
  const button = (key: string) =>
    [...el().querySelectorAll('button')].find((b) => b.textContent?.includes(key)) as HTMLButtonElement;

  function type(text: string): void {
    search()!.value = text;
    search()!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  const many = (count: number) => Array.from({ length: count }, (_, i) => item(i + 1, `Game ${i + 1}`, count - i));

  it('puts the games with most hours first', () => {
    setup([item(1, 'Few', 1), item(2, 'Many', 90)]);
    expect(cards()[0].textContent).toContain('Many');
    expect(cards()[1].textContent).toContain('Few');
  });

  it('shows one page at a time and reveals the rest on demand', () => {
    setup(many(PENDING_PAGE_SIZE + 5));
    expect(cards()).toHaveLength(PENDING_PAGE_SIZE);

    button('sync.pending.showMore').click();
    fixture.detectChanges();

    expect(cards()).toHaveLength(PENDING_PAGE_SIZE + 5);
    expect(button('sync.pending.showMore')).toBeUndefined();
  });

  it('searches every game, not only the visible page', () => {
    setup(many(PENDING_PAGE_SIZE + 5));
    type(`Game ${PENDING_PAGE_SIZE + 5}`);

    expect(cards()).toHaveLength(1);
    expect(cards()[0].textContent).toContain(`Game ${PENDING_PAGE_SIZE + 5}`);
  });

  it('goes back to the first page when the search changes', () => {
    setup(many(PENDING_PAGE_SIZE * 3));
    button('sync.pending.showMore').click();
    fixture.detectChanges();
    expect(cards()).toHaveLength(PENDING_PAGE_SIZE * 2);

    type('Game');

    expect(cards()).toHaveLength(PENDING_PAGE_SIZE);
  });

  it('says when nothing matches and clears the search', () => {
    setup(many(8));
    type('nope');

    expect(cards()).toHaveLength(0);
    expect(el().textContent).toContain('sync.pending.noMatches');
    expect(el().textContent).not.toContain('steam.noPending');

    button('sync.pending.clearSearch').click();
    fixture.detectChanges();

    expect(cards()).toHaveLength(8);
    expect(search()!.value).toBe('');
  });

  it('hides the toolbar on a short list', () => {
    setup(many(3));
    expect(search()).toBeNull();
  });

  it('keeps the search reachable when the list shrinks while a search is active', () => {
    setup(many(8));
    type('Game 1');
    fixture.componentRef.setInput('items', many(2));
    fixture.detectChanges();

    expect(search()).not.toBeNull();
  });

  it('emits each action with its game', () => {
    setup([item(7, 'Astro Bot')]);
    const events: string[] = [];
    fixture.componentInstance.createRun.subscribe((g) => events.push(`run:${g.id}`));
    fixture.componentInstance.addGame.subscribe((g) => events.push(`add:${g.id}`));
    fixture.componentInstance.ignoreGame.subscribe((g) => events.push(`ignore:${g.id}`));

    button('steam.createRun').click();
    button('sync.pending.addOnly').click();
    button('steam.ignore').click();

    expect(events).toEqual(['run:7', 'add:7', 'ignore:7']);
  });

  it('disables ignoring only on the game being processed', () => {
    setup([item(7, 'Busy'), item(8, 'Idle')], { busyGameId: 7 });
    const ignoreOf = (name: string) =>
      [...cards().find((c) => c.textContent?.includes(name))!.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('steam.ignore'),
      ) as HTMLButtonElement;

    expect(ignoreOf('Busy').disabled).toBe(true);
    expect(ignoreOf('Idle').disabled).toBe(false);
  });

  it('shows the empty state when nothing is pending', () => {
    setup([]);
    expect(el().textContent).toContain('steam.noPending');
    expect(search()).toBeNull();
  });

  describe('while IGDB fills the first page', () => {
    const waiting = () => [item(1, 'Ready', 9), item(2, 'Waiting', 8, 'SINGLEPLAYER', true)];
    const status = () => el().querySelector('[role="status"]') as HTMLElement;

    it('waits with its progress instead of showing covers that are about to change', () => {
      setup(waiting(), { enriching: true });

      expect(cards()).toHaveLength(0);
      expect(el().querySelector('[data-waiting]')).not.toBeNull();
      expect(status().textContent).toContain('sync.pending.preparing');
      expect(status().querySelector<HTMLElement>('[data-progress]')!.style.width).toBe('50%');
    });

    it('opens the list as soon as the page is ready', () => {
      setup(waiting(), { enriching: true });

      fixture.componentRef.setInput('items', [item(1, 'Ready', 9), item(2, 'Waiting', 8)]);
      fixture.detectChanges();

      expect(cards()).toHaveLength(2);
      expect(el().querySelector('[data-waiting]')).toBeNull();
    });

    it('never holds the list once the fill stopped, even with games left without data', () => {
      setup(waiting(), { enriching: false });

      expect(cards()).toHaveLength(2);
      expect(el().querySelector('[data-cover-loading]')).toBeNull();
    });

    it('lets the user see the list right away, with a placeholder for the covers still to come', () => {
      setup(waiting(), { enriching: true });

      button('sync.pending.showNow').click();
      fixture.detectChanges();

      expect(cards()).toHaveLength(2);
      expect(cards()[0].querySelector('[data-cover-loading]')).toBeNull();
      expect(cards()[1].querySelector('[data-cover-loading]')).not.toBeNull();
    });
  });

  it('shows the IGDB fill with its progress', () => {
    setup([item(1, 'A')], { enriching: true, enrichmentCount: { processed: 3, total: 12 } });
    const status = el().querySelector('[role="status"]') as HTMLElement;
    expect(status.textContent).toContain('sync.enrichment.progress');
    expect(status.querySelector<HTMLElement>('[data-progress]')!.style.width).toBe('25%');
  });
});
