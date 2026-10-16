import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { CollapseStateService } from '../../../core/services/collapse-state.service';
import { GenreChips, fitChipCount, splitGenres } from './genre-chips';

describe('splitGenres', () => {
  it('keeps two genres and counts the rest', () => {
    expect(splitGenres(['Acción', 'Aventura', 'Rol', 'Shooter'])).toEqual({ shown: ['Acción', 'Aventura'], hidden: 2 });
    expect(splitGenres(['Rol', 'Shooter'])).toEqual({ shown: ['Rol', 'Shooter'], hidden: 0 });
    expect(splitGenres([])).toEqual({ shown: [], hidden: 0 });
    expect(splitGenres(['A', 'B'], 1)).toEqual({ shown: ['A'], hidden: 1 });
  });
});

describe('fitChipCount', () => {
  // Chips 60, 80, 70 and 90 px wide, 8 px apart; "+N" is 36 px.
  const widths = [60, 80, 70, 90];

  it('shows every chip when the whole line fits', () => {
    expect(fitChipCount(widths, 60 + 80 + 70 + 90 + 3 * 8, 8, 36)).toBe(4);
    expect(fitChipCount(widths, 1000, 8, 36)).toBe(4);
  });

  it('keeps as many as fit next to the "+N" chip', () => {
    // 60 + 8 + 80 + 8 + 70 = 226, plus 8 + 36 for "+N" = 270.
    expect(fitChipCount(widths, 270, 8, 36)).toBe(3);
    expect(fitChipCount(widths, 269, 8, 36)).toBe(2);
    expect(fitChipCount(widths, 192, 8, 36)).toBe(2);
  });

  it('always keeps at least one chip', () => {
    expect(fitChipCount(widths, 50, 8, 36)).toBe(1);
  });

  it('shows them all while sizes are unknown (no layout yet, or jsdom)', () => {
    expect(fitChipCount(widths, 0, 8, 36)).toBe(4);
    expect(fitChipCount([0, 0, 0], 0, 8, 0)).toBe(3);
    expect(fitChipCount([], 300, 8, 36)).toBe(0);
  });
});

@Component({
  imports: [GenreChips],
  template: `<app-genre-chips [genres]="genres()" [fit]="fit()" size="md" />`,
})
class Host {
  readonly genres = signal<string[]>(['Acción', 'Aventura', 'Rol', 'Shooter']);
  readonly fit = signal(false);
}

describe('GenreChips', () => {
  function setup(wide: boolean, genres?: string[]) {
    const wideSignal = signal(wide);
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideTranslateService(),
        { provide: CollapseStateService, useValue: { atLeast: () => wideSignal.asReadonly() } },
      ],
    });
    const fixture = TestBed.createComponent(Host);
    if (genres) fixture.componentInstance.genres.set(genres);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const chips = () => [...el.querySelectorAll('app-genre-chips > span')].map((c) => c.textContent?.trim());
    const more = () => el.querySelector<HTMLButtonElement>('[data-more-genres]');
    return { fixture, el, chips, more, wideSignal };
  }

  it('shows every genre when there are two or fewer', () => {
    const { chips, more } = setup(true, ['Rol', 'Shooter']);
    expect(chips()).toEqual(['Rol', 'Shooter']);
    expect(more()).toBeNull();
  });

  it('folds the rest into "+N", listed in a popover on wide screens', () => {
    const { fixture, el, chips, more } = setup(true);
    expect(chips()).toEqual(['Acción', 'Aventura']);
    expect(more()?.textContent?.trim()).toBe('+2');

    more()!.click();
    fixture.detectChanges();
    const popover = el.querySelector('[data-genre-popover]')!;
    expect([...popover.querySelectorAll('li')].map((li) => li.textContent?.trim())).toEqual([
      'Acción',
      'Aventura',
      'Rol',
      'Shooter',
    ]);
    document.body.click();
    fixture.detectChanges();
    expect(el.querySelector('[data-genre-popover]')).toBeNull();
  });

  it('lists every genre in a view-only sheet on phones', () => {
    const { fixture, more } = setup(false);
    more()!.click();
    fixture.detectChanges();
    const dialog = document.body.querySelector('app-modal-sheet [role="dialog"]')!;
    expect(dialog.getAttribute('aria-label')).toBe('game.genre');
    expect(dialog.querySelectorAll('li')).toHaveLength(4);
    (dialog.querySelector('header button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(document.body.querySelector('app-modal-sheet')).toBeNull();
  });

  it('closes the popover or the sheet when the md breakpoint changes', () => {
    const { fixture, el, more, wideSignal } = setup(true);
    more()!.click();
    fixture.detectChanges();
    expect(el.querySelector('[data-genre-popover]')).not.toBeNull();
    wideSignal.set(false);
    fixture.detectChanges();
    expect(el.querySelector('[data-genre-popover]')).toBeNull();

    more()!.click();
    fixture.detectChanges();
    expect(document.body.querySelector('app-modal-sheet')).not.toBeNull();
    wideSignal.set(true);
    fixture.detectChanges();
    expect(document.body.querySelector('app-modal-sheet')).toBeNull();
  });

  it('shows every genre on one line in fit mode until a measurement says otherwise', () => {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideTranslateService(),
        { provide: CollapseStateService, useValue: { atLeast: () => signal(true).asReadonly() } },
      ],
    });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.fit.set(true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    // jsdom has no layout: nothing measures, so nothing is folded.
    expect(el.querySelectorAll('app-genre-chips > span')).toHaveLength(4);
    expect(el.querySelector('[data-more-genres]')).toBeNull();
    expect(el.querySelector('app-genre-chips')!.className).toContain('flex-nowrap');
  });
});
