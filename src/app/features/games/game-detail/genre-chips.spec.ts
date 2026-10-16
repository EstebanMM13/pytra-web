import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { CollapseStateService } from '../../../core/services/collapse-state.service';
import { GenreChips, splitGenres } from './genre-chips';

describe('splitGenres', () => {
  it('keeps two genres and counts the rest', () => {
    expect(splitGenres(['Acción', 'Aventura', 'Rol', 'Shooter'])).toEqual({ shown: ['Acción', 'Aventura'], hidden: 2 });
    expect(splitGenres(['Rol', 'Shooter'])).toEqual({ shown: ['Rol', 'Shooter'], hidden: 0 });
    expect(splitGenres([])).toEqual({ shown: [], hidden: 0 });
    expect(splitGenres(['A', 'B'], 1)).toEqual({ shown: ['A'], hidden: 1 });
  });
});

@Component({
  imports: [GenreChips],
  template: `<app-genre-chips [genres]="genres()" />`,
})
class Host {
  readonly genres = signal<string[]>(['Acción', 'Aventura', 'Rol', 'Shooter']);
}

describe('GenreChips', () => {
  function setup(wide: boolean, genres?: string[]) {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideTranslateService(),
        { provide: CollapseStateService, useValue: { atLeast: () => signal(wide).asReadonly() } },
      ],
    });
    const fixture = TestBed.createComponent(Host);
    if (genres) fixture.componentInstance.genres.set(genres);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const chips = () => [...el.querySelectorAll('app-genre-chips > span')].map((c) => c.textContent?.trim());
    const more = () => el.querySelector<HTMLButtonElement>('[data-more-genres]');
    return { fixture, el, chips, more };
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
});
