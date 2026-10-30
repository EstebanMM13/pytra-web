import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable, Subject, of, throwError } from 'rxjs';
import { GameService } from '../../core/services/game.service';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';
import { StatsService } from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { GENRE_YEARS, StatsGenres } from './stats-genres';

@Component({ selector: 'app-navbar', template: '' })
class NavbarStub {}

const RPG = { id: 1, name: 'RPG' };
const SHOOTER = { id: 2, name: 'SHOOTER' };
const game = (id: number, name: string, genre: { id: number; name: string }, sagaId: number | null, hours: number) => ({
  id,
  name,
  genres: [genre],
  sagaId,
  sagaName: sagaId ? 'The Witcher' : null,
  coverImageUrl: `${id}.jpg`,
  totalHours: hours,
  experienceCount: hours > 0 ? 1 : 0,
  reviewStatus: 'CONFIRMED',
  releaseDate: null,
});
/** 150 + 0 + 50 = 200 confirmed hours: RPG's 150 are 75%. */
const LIBRARY = [game(1, 'Witcher 3', RPG, 7, 150), game(2, 'Witcher 2', RPG, 7, 0), game(3, 'Doom', SHOOTER, null, 50)];
const PLAY_FACTS = { runs: [{ gameId: 3, year: 2025, hours: 30 }], onlineYears: [] };
const BY_GENRE = [
  { genreId: 1, genreName: 'RPG', gameCount: 2, totalHours: 150 },
  { genreId: 2, genreName: 'SHOOTER', gameCount: 1, totalHours: 50 },
];

type Calls = Partial<Record<'getByGenre' | 'getRatings' | 'getCompletion' | 'getByYear' | 'getPlayFacts' | 'findAll', () => Observable<unknown>>>;

const down = () => throwError(() => new Error('down'));

describe('Stats genres page', () => {
  function setup(calls: Calls = {}) {
    const queryParamMap = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      imports: [StatsGenres],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: ActivatedRoute, useValue: { queryParamMap, snapshot: { queryParamMap: queryParamMap.value } } },
        { provide: RunFormLauncher, useValue: { saved$: new Subject() } },
        { provide: GameService, useValue: { findAll: calls.findAll ?? (() => of(LIBRARY)) } },
        {
          provide: StatsService,
          useValue: {
            getYears: () => of([]),
            getByYear: calls.getByYear ?? (() => of([{ year: 2025, totalHours: 180 }])),
            getByGenre: calls.getByGenre ?? (() => of(BY_GENRE)),
            getRatings: calls.getRatings ?? (() => of({ byGenre: [{ genreId: 1, genreName: 'RPG', ratedCount: 5, averageRating: 9 }] })),
            getCompletion:
              calls.getCompletion ??
              (() =>
                of({
                  abandonmentByGenre: [{ genreId: 2, genreName: 'SHOOTER', completedCount: 2, abandonedCount: 2, abandonmentRate: 0.5 }],
                })),
            getPlayFacts: calls.getPlayFacts ?? (() => of(PLAY_FACTS)),
          },
        },
      ],
    });
    TestBed.overrideComponent(StatsGenres, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    const fixture = TestBed.createComponent(StatsGenres);
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('spotlights the most played genre and its share of the confirmed library hours', () => {
    const el = setup();
    const hero = el.querySelector('[data-top-genre]')!;
    expect(hero.querySelector('[data-spotlight-link]')!.getAttribute('href')).toBe('/games?genre=1');
    expect(hero.querySelector('[data-spotlight-name]')!.textContent!.trim()).toBe('RPG');
    expect(hero.querySelector('[data-top-genre-share]')!.textContent).toContain('75');
  });

  it('calls out the best rated, most abandoned and biggest genres, and ranks every genre', () => {
    const el = setup();
    expect(el.querySelector('[data-genre-callout="bestRated"] a')!.getAttribute('href')).toBe('/games?genre=1');
    expect(el.querySelector('[data-genre-callout="mostAbandoned"] a')!.getAttribute('href')).toBe('/games?genre=2');
    expect(el.querySelectorAll('[data-genre-list] [data-bar-row]')).toHaveLength(2);
    expect(el.querySelector('[data-genre-list] [data-rank-first]')).not.toBeNull();
  });

  it('names the main genre of each year with its share, linking to its games of that year', () => {
    const el = setup();
    const rows = el.querySelectorAll('[data-genre-years] [data-bar-row]');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('2025 · Shooter');
    expect(rows[0].textContent).toContain('100');
    expect(rows[0].querySelector('a')!.getAttribute('href')).toBe('/games?genre=2&year=2025');
  });

  it(`lists at most ${GENRE_YEARS} years`, () => {
    const runs = Array.from({ length: GENRE_YEARS + 3 }, (_, i) => ({ gameId: 3, year: 2000 + i, hours: 1 }));
    const el = setup({ getPlayFacts: () => of({ runs, onlineYears: [] }) });
    expect(el.querySelectorAll('[data-genre-years] [data-bar-row]')).toHaveLength(GENRE_YEARS);
  });

  it('leaves the genre of the year out when the play facts fail', () => {
    const el = setup({ getPlayFacts: down });
    expect(el.querySelector('[data-genre-years]')).toBeNull();
    expect(el.querySelector('[data-top-genre]')).not.toBeNull();
  });

  it('keeps the page when the ratings, completion and yearly hours fail (only the genres are essential)', () => {
    const el = setup({ getRatings: down, getCompletion: down, getByYear: down });
    expect(el.querySelectorAll('[data-genre-list] [data-bar-row]')).toHaveLength(2);
    expect(el.querySelector('[data-genre-callout="bestRated"]')).toBeNull();
    expect(el.querySelector('[data-genre-callout="mostAbandoned"]')).toBeNull();
    expect(el.querySelector('[data-genre-callout="mostGames"]')).not.toBeNull();
  });

  it('shows the load error when the genres fail, and the empty state without genres', () => {
    expect(setup({ getByGenre: down }).querySelector('app-stats-load-error')).not.toBeNull();
    TestBed.resetTestingModule();
    const empty = setup({ getByGenre: () => of([]) });
    expect(empty.querySelector('[data-genres-empty]')).not.toBeNull();
    expect(empty.querySelector('[data-top-genre]')).toBeNull();
  });

  for (const [name, findAll] of [
    ['fails', down],
    ['is empty', () => of([])],
  ] as const) {
    it(`still ranks the genres, without covers, when the library ${name}`, () => {
      const el = setup({ findAll });
      expect(el.querySelectorAll('[data-genre-list] [data-bar-row]')).toHaveLength(2);
      expect(el.querySelector('[data-genre-list] app-game-cover')).toBeNull();
      // Without the library, the share falls back to the yearly hours: 150 of 180.
      expect(el.querySelector('[data-top-genre-share]')!.textContent).toContain('83');
    });
  }

  it('leaves the sagas to the sagas page and keeps the spotlight to the genre and its share', () => {
    const el = setup();
    expect(el.querySelector('[data-saga-insights]')).toBeNull();
    expect(el.querySelector('[data-top-genre] [data-hero-games]')).toBeNull();
  });
});
