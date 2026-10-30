import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { BehaviorSubject, of } from 'rxjs';
import { Game } from '../../core/models/game.model';
import { Saga } from '../../core/models/saga.model';
import { GameService } from '../../core/services/game.service';
import { SagaService } from '../../core/services/saga.service';
import { Navbar } from '../../shared/navbar/navbar';
import { Sagas } from './sagas';

@Component({ selector: 'app-navbar', template: '' })
class NavbarStub {}

function game(id: number, name: string, sagaId: number): Game {
  return {
    id,
    name,
    developer: null,
    publisher: null,
    releaseDate: null,
    category: 'SINGLEPLAYER',
    sagaId,
    sagaName: null,
    coverImageUrl: null,
    reviewStatus: 'CONFIRMED',
    genres: [],
    updatedAt: '2025-01-01T00:00:00',
  };
}

const sagas: Saga[] = [
  { id: 1, name: 'God of War', updatedAt: '' },
  { id: 2, name: 'Pokémon', updatedAt: '' },
  { id: 3, name: 'Zelda', updatedAt: '' },
];
const games: Game[] = [game(10, 'Ascension', 1), game(20, 'Pokémon Rojo', 2), game(30, 'Breath of the Wild', 3)];

describe('Sagas search', () => {
  afterEach(() => vi.useRealTimers());

  function setup(q: string | null = null) {
    const query$ = new BehaviorSubject(convertToParamMap(q === null ? {} : { q }));
    TestBed.configureTestingModule({
      imports: [Sagas],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({})),
            queryParamMap: query$,
            snapshot: { queryParamMap: query$.value },
          },
        },
        { provide: SagaService, useValue: { findAll: () => of(sagas) } },
        { provide: GameService, useValue: { findAll: () => of(games) } },
      ],
    });
    TestBed.overrideComponent(Sagas, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Sagas);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const listed = () => [...el.querySelectorAll('a.saga-card [data-saga-name]')].map((s) => s.textContent!.trim());
    const type = (text: string) => {
      const input = el.querySelector('[data-saga-search]') as HTMLInputElement;
      input.value = text;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { fixture, el, listed, type, navigate, query$ };
  }

  it('filters by saga or game name, accent- and case-insensitive, keeping the total count', () => {
    const { el, listed, type } = setup();
    expect(listed()).toEqual(['God of War', 'Pokémon', 'Zelda']);

    type('POKEMON');
    expect(listed()).toEqual(['Pokémon']);
    type('wild');
    expect(listed()).toEqual(['Zelda']);
    // The count next to the title is the number of sagas, like the library's.
    expect(el.querySelector('h1')!.nextElementSibling!.textContent!.trim()).toBe('3');
  });

  it('sums up the sagas above the list, set apart from it', () => {
    const { el } = setup();
    const overview = el.querySelector('[data-saga-insights]')!;
    // A stacked progress bar with its legend, not a row of tiles cut in the narrow column.
    expect(overview.querySelector('app-stat-strip')).toBeNull();
    expect(overview.querySelector('[data-saga-count="notStarted"]')!.textContent).toContain('3');
    expect(overview.querySelector('[data-saga-count="complete"]')!.textContent).toContain('0');
    // Nothing played yet: no saga is closest to completion or has hours.
    expect(overview.querySelector('[data-saga-pick]')).toBeNull();
  });

  it('starts from the q query param', () => {
    const { el, listed } = setup('ascension');
    expect((el.querySelector('[data-saga-search]') as HTMLInputElement).value).toBe('ascension');
    expect(listed()).toEqual(['God of War']);
  });

  it('writes the text to the URL once typing pauses', () => {
    vi.useFakeTimers();
    const { type, navigate } = setup();
    type('zel');
    expect(navigate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { q: 'zel' }, queryParamsHandling: 'merge', replaceUrl: true }),
    );
  });

  it('shows an empty state that clears the search', () => {
    const { fixture, el, listed, type, navigate } = setup('halo');
    expect(listed()).toEqual([]);
    const empty = el.querySelector('[data-saga-no-matches]')!;
    expect(empty.textContent).toContain('sagas.noMatches');
    type('halo 2');

    (empty.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(listed()).toEqual(['God of War', 'Pokémon', 'Zelda']);
    expect((el.querySelector('[data-saga-search]') as HTMLInputElement).value).toBe('');
    // The pending write of "halo 2" is dropped: the URL goes straight to no search.
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenLastCalledWith([], expect.objectContaining({ queryParams: { q: null } }));
  });

  it('follows external q changes (back / forward)', () => {
    const { fixture, listed, query$ } = setup();
    query$.next(convertToParamMap({ q: 'god' }));
    fixture.detectChanges();
    expect(listed()).toEqual(['God of War']);
  });
});

describe('Sagas detail', () => {
  function setup(list: Game[]) {
    TestBed.configureTestingModule({
      imports: [Sagas],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: '1' })),
            queryParamMap: of(convertToParamMap({})),
            snapshot: { queryParamMap: convertToParamMap({}) },
          },
        },
        { provide: SagaService, useValue: { findAll: () => of(sagas) } },
        { provide: GameService, useValue: { findAll: () => of(list) } },
      ],
    });
    TestBed.overrideComponent(Sagas, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    const fixture = TestBed.createComponent(Sagas);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const played = (g: Game, hours: number): Game => ({ ...g, experienceCount: 1, totalHours: hours });

  it("blurs the most played game's cover behind the hero", () => {
    const el = setup([
      played({ ...game(10, 'Ascension', 1), coverImageUrl: 'asc.jpg' }, 8),
      played({ ...game(11, 'Ragnarök', 1), coverImageUrl: 'rag.jpg' }, 50),
    ]);
    const backdrop = el.querySelector('[data-saga-hero] [data-saga-backdrop]') as HTMLImageElement;
    expect(backdrop.getAttribute('src')).toBe('rag.jpg');
  });

  it('keeps the brand glow when no game has a cover', () => {
    const el = setup([game(10, 'Ascension', 1)]);
    expect(el.querySelector('[data-saga-hero]')).not.toBeNull();
    expect(el.querySelector('[data-saga-backdrop]')).toBeNull();
  });

  it('dims the cover and text of unplayed games instead of the whole row', () => {
    const el = setup([played(game(10, 'Ascension', 1), 8), game(11, 'Ragnarök', 1)]);
    const rows = [...el.querySelectorAll('[data-saga-timeline] a')] as HTMLElement[];
    expect(rows).toHaveLength(2);
    expect(rows[0].hasAttribute('data-unplayed')).toBe(false);
    expect(rows[1].hasAttribute('data-unplayed')).toBe(true);
    expect(rows[1].style.opacity).toBe('');
    expect(rows[1].querySelector('[data-saga-cover]')!.classList).toContain('saga-unplayed-cover');
    expect(rows[0].querySelector('[data-saga-cover]')!.classList).not.toContain('saga-unplayed-cover');
  });

  it('keeps list cards at their natural height inside the scrolling list', () => {
    const el = setup([{ ...game(10, 'Ascension', 1), coverImageUrl: 'asc.jpg' }]);
    const cards = [...el.querySelectorAll('a.saga-card')];
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      // An overflow other than visible would drop the flex item's min-height to 0 and let it squash.
      expect(card.classList).toContain('shrink-0');
      expect(card.classList).not.toContain('overflow-hidden');
    }
    expect(el.querySelector('a.saga-card [data-saga-tint]')!.classList).toContain('overflow-hidden');
  });

  it('lists every developer with the year range kept whole', () => {
    const el = setup([
      { ...game(10, 'Ascension', 1), developer: 'Santa Monica Studio', releaseDate: '2013-03-12' },
      { ...game(11, 'Ragnarök', 1), developer: 'Santa Monica Studio', releaseDate: '2022-11-09' },
      { ...game(12, 'Chains of Olympus', 1), developer: 'Ready at Dawn', releaseDate: '2008-03-04' },
    ]);
    const meta = el.querySelector('[data-saga-hero] [data-saga-meta]') as HTMLElement;
    expect(meta.querySelector('[data-saga-studios]')!.textContent!.trim()).toBe('Santa Monica Studio, Ready at Dawn');
    expect(meta.querySelector('[data-saga-studios]')!.classList).toContain('line-clamp-2');
    expect(meta.querySelector('[data-saga-years]')!.textContent!.trim()).toBe('2008–2022');
    expect(meta.getAttribute('title')).toBe('Santa Monica Studio, Ready at Dawn · 2008–2022');
  });
});
