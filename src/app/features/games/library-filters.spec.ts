import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { LibraryCategoryFilter } from './library.logic';
import { LibraryFilters } from './library-filters';

@Component({
  imports: [LibraryFilters],
  template: `<app-library-filters
    [category]="category()"
    [platformIds]="platforms()"
    [genreIds]="genres()"
    [platforms]="platformRefs"
    [genreOptions]="genreOptions"
    (categoryChange)="category.set($event)"
    (platformsChange)="platforms.set($event)"
    (genresChange)="genres.set($event)"
    (cleared)="cleared = cleared + 1"
  />`,
})
class Host {
  readonly category = signal<LibraryCategoryFilter>('ALL');
  readonly platforms = signal<readonly string[]>([]);
  readonly genres = signal<readonly number[]>([]);
  readonly platformRefs = [
    { id: 1, name: 'PC', color: '#888' },
    { id: 2, name: 'PS5', color: '#44f' },
  ];
  readonly genreOptions = [{ id: 7, label: 'RPG' }];
  cleared = 0;
}

describe('LibraryFilters', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTranslateService()] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const trigger = el.querySelector('button[aria-haspopup="dialog"]') as HTMLButtonElement;
    const button = (text: string) =>
      [...el.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find((b) => b.textContent?.trim() === text)!;
    return { fixture, el, trigger, button };
  }

  it('opens the panel and applies type and platform picks right away', () => {
    const { fixture, el, trigger, button } = setup();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    trigger.click();
    fixture.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    button('category.ONLINE').click();
    button('PS5').click();
    fixture.detectChanges();
    button('PC').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.category()).toBe('ONLINE');
    expect(fixture.componentInstance.platforms()).toEqual(['2', '1']);
    // Count badge: type + 2 platforms.
    expect(trigger.textContent).toContain('3');

    button('PS5').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.platforms()).toEqual(['1']);
  });

  it('clears and closes on Escape', () => {
    const { fixture, el, trigger, button } = setup();
    fixture.componentInstance.genres.set([7]);
    trigger.click();
    fixture.detectChanges();
    button('library.filters.clear').click();
    expect(fixture.componentInstance.cleared).toBe(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });
});
