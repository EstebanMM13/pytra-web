import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { Observable, Subject, of, throwError } from 'rxjs';
import { PlatformService } from '../../core/services/platform.service';
import { GameService } from '../../core/services/game.service';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';
import { StatsService } from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { StatsHub } from './stats-hub';

@Component({ selector: 'app-navbar', template: '' })
class NavbarStub {}

const LIBRARY = [
  { id: 1, name: 'Elden Ring', developer: 'FromSoftware', sagaId: null, coverImageUrl: 'er.jpg', totalHours: 200 },
  { id: 2, name: 'Witcher 3', developer: 'CDPR', sagaId: 1, coverImageUrl: 'w3.jpg', totalHours: 90 },
];

describe('Stats hub', () => {
  function setup(
    overrides: Record<string, () => Observable<unknown>> = {},
    findAll: () => Observable<unknown> = () => of(LIBRARY),
  ) {
    const saved$ = new Subject<void>();
    TestBed.configureTestingModule({
      imports: [StatsHub],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: RunFormLauncher, useValue: { saved$ } },
        {
          provide: GameService,
          useValue: { findAll },
        },
        { provide: PlatformService, useValue: { platforms: () => null, load: () => of([]) } },
        {
          provide: StatsService,
          useValue: {
            getActivity: () =>
              of({ currentStreak: { length: 4 }, longestStreak: { length: 12 }, activeDays: 30 }),
            getByYear: () => of([{ year: 2024, totalHours: 80 }, { year: 2026, totalHours: 12.5 }]),
            getBySaga: () => of([{ sagaId: 1, sagaName: 'Zelda', gameCount: 3, totalHours: 90 }]),
            getByPlatform: () =>
              of({
                platforms: [
                  { platformId: 1, name: 'PlayStation 5', color: '#6b93f5', hours: 300 },
                  { platformId: 2, name: 'PC', color: null, hours: 100 },
                ],
              }),
            getByDeveloper: () => of({ topByHours: [{ developer: 'FromSoftware', hours: 250 }] }),
            getCompletion: () => of({ completedCount: 8, abandonedCount: 2, timeToFinish: { medianDays: 22.6 } }),
            getRatings: () =>
              of({ mean: 7.94, ratedCount: 40, histogram: [{ from: 7, to: 7.5, count: 30 }, { from: 9, to: 9.5, count: 10 }] }),
            ...overrides,
          },
        },
      ],
    });
    TestBed.overrideComponent(StatsHub, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    const fixture = TestBed.createComponent(StatsHub);
    fixture.detectChanges();
    return Object.assign(fixture.nativeElement as HTMLElement, { fixture, saved$ });
  }

  afterEach(() => TestBed.resetTestingModule());

  it('links every section, years and sagas to their existing pages', () => {
    const el = setup();
    const links = [...el.querySelectorAll('[data-hub-card]')].map((a) => a.getAttribute('href'));
    expect(links).toEqual([
      '/stats/activity',
      '/years',
      '/sagas',
      '/stats/platforms',
      '/stats/studios',
      '/stats/habits',
      '/stats/ratings',
    ]);
  });

  it('shows a teaser figure per section', () => {
    const el = setup();
    const figures = [...el.querySelectorAll('[data-hub-figure]')].map((f) => f.textContent!.trim());
    expect(figures).toEqual(['stats.days', '12,5 h', 'stats.hub.sagasFigure', 'PlayStation 5', 'FromSoftware', 'stats.days', '7,94']);
  });

  it('draws a small visual of the same data on every card', () => {
    const el = setup();
    const visuals = [...el.querySelectorAll<HTMLElement>('[data-hub-visual]')];
    expect(visuals).toHaveLength(7);
    // Activity: one cell per day of the last five weeks; platforms: one slice each; ratings: 11 whole points.
    expect(visuals[0].querySelectorAll('[data-hub-day]')).toHaveLength(35);
    expect(visuals[1].querySelectorAll('[data-hub-year-bar]').length).toBeGreaterThan(0);
    expect(visuals[3].querySelectorAll('[data-hub-slice]')).toHaveLength(2);
    // Habits: completed and abandoned.
    expect(visuals[5].querySelectorAll('[data-hub-slice]')).toHaveLength(2);
    expect(visuals[6].querySelectorAll('[data-hub-rating-bar]')).toHaveLength(11);
  });

  it('heads the hub with the all-time hours and the most played covers, and shows saga and studio covers', () => {
    const el = setup();
    const hero = el.querySelector('[data-hub-hero]')!;
    expect(hero.querySelector('[data-hub-total]')!.textContent).toContain('92,5 h');
    expect(hero.querySelectorAll('app-stats-cover-stack')[0].querySelectorAll('app-game-cover')).toHaveLength(2);
    const visuals = el.querySelectorAll('[data-hub-visual]');
    expect(visuals[2].querySelectorAll('app-game-cover')).toHaveLength(1);
    expect(visuals[4].querySelectorAll('app-game-cover')).toHaveLength(1);
  });

  for (const [name, findAll] of [
    ['fails', () => throwError(() => new Error('down'))],
    ['is empty', () => of([])],
    ['has no covers', () => of(LIBRARY.map((g) => ({ ...g, coverImageUrl: null, totalHours: 0 })))],
  ] as const) {
    it(`keeps the hero and falls back to bars when the library ${name}`, () => {
      const el = setup({}, findAll);
      expect(el.querySelector('[data-hub-hero] [data-hub-total]')!.textContent).toContain('92,5 h');
      const visuals = el.querySelectorAll('[data-hub-visual]');
      expect(visuals[2].querySelector('app-game-cover')).toBeNull();
      expect(visuals[2].querySelectorAll('[data-hub-slice]')).toHaveLength(1);
      expect(visuals[4].querySelector('app-game-cover')).toBeNull();
      expect(visuals[4].querySelectorAll('[data-hub-studio-bar]')).toHaveLength(1);
    });
  }

  it('shows the hero with a dash when the years fail', () => {
    const el = setup({ getByYear: () => throwError(() => new Error('down')) });
    expect(el.querySelector('[data-hub-hero] [data-hub-total]')!.textContent!.trim()).toBe('—');
  });

  it('shows a dash on a section whose teaser failed, keeping the others', () => {
    const el = setup({ getRatings: () => throwError(() => new Error('down')) });
    const figures = [...el.querySelectorAll('[data-hub-figure]')].map((f) => f.textContent!.trim());
    expect(figures[6]).toBe('—');
    expect(figures[4]).toBe('FromSoftware');
  });

  it('reloads the teasers when a run is saved from the "+" menu', () => {
    let mean = 7;
    const el = setup({ getRatings: () => of({ mean, ratedCount: 1 }) });
    mean = 9;
    el.saved$.next();
    el.fixture.detectChanges();
    const figures = [...el.querySelectorAll('[data-hub-figure]')].map((f) => f.textContent!.trim());
    expect(figures[6]).toBe('9,00');
  });
});
