import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable, Subject, of, throwError } from 'rxjs';
import { GameRankings } from '../../core/models/stats.model';
import { GameService } from '../../core/services/game.service';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';
import { STATS_RANKING_LIMIT, StatsService } from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { StatsGames } from './stats-games';
import { waitingDays } from './stats-games.logic';

@Component({ selector: 'app-navbar', template: '' })
class NavbarStub {}

const RANKINGS: GameRankings = {
  mostReplayed: [{ gameId: 1, gameName: 'Elden Ring', runCount: 3, hours: 200 }],
  longestRuns: [
    { experienceId: 11, gameId: 1, gameName: 'Elden Ring', runLabel: 'NG', hours: 120 },
    { experienceId: 21, gameId: 2, gameName: 'Hades', runLabel: 'First', hours: 40 },
  ],
  shortGems: [{ gameId: 3, gameName: 'Inside', rating: 9, hours: 4 }],
  mostDaysPlayed: [],
  longestPending: [
    {
      gameId: 4,
      gameName: 'Persona 5',
      experienceId: 41,
      runLabel: null,
      pendingSince: '2024-03-05T08:00:00',
    },
  ],
};

describe('Stats games page', () => {
  const limits: number[] = [];

  function setup(overrides: Partial<Record<keyof StatsService, () => Observable<unknown>>> = {}) {
    limits.length = 0;
    const queryParamMap = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      imports: [StatsGames],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap, snapshot: { queryParamMap: queryParamMap.value } },
        },
        { provide: RunFormLauncher, useValue: { saved$: new Subject() } },
        {
          provide: GameService,
          useValue: {
            findAll: () =>
              of([{ id: 1, name: 'Elden Ring', coverImageUrl: 'er.jpg', totalHours: 200 }]),
          },
        },
        {
          provide: StatsService,
          useValue: {
            getYears: () => of([]),
            getMostPlayedSingleplayer: (limit: number) => {
              limits.push(limit);
              return of([
                { gameId: 1, gameName: 'Elden Ring', totalHours: 200 },
                { gameId: 2, gameName: 'Hades', totalHours: 60 },
              ]);
            },
            getMostPlayedOnline: (limit: number) => {
              limits.push(limit);
              return of([{ gameId: 5, gameName: 'Fortnite', totalHours: 300 }]);
            },
            getTopRated: (limit: number) => {
              limits.push(limit);
              return of([
                {
                  gameId: 1,
                  gameName: 'Elden Ring',
                  runLabel: 'NG',
                  rating: 9.5,
                  experienceId: 11,
                  online: false,
                },
                {
                  gameId: 5,
                  gameName: 'Fortnite',
                  runLabel: null,
                  rating: 7,
                  experienceId: null,
                  online: true,
                },
              ]);
            },
            getGameRankings: () => of(RANKINGS),
            ...overrides,
          },
        },
      ],
    });
    TestBed.overrideComponent(StatsGames, {
      remove: { imports: [Navbar] },
      add: { imports: [NavbarStub] },
    });
    const fixture = TestBed.createComponent(StatsGames);
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const rows = (el: HTMLElement, ranking: string) =>
    [...el.querySelectorAll(`[data-ranking="${ranking}"] [data-bar-row]`)].map((row) =>
      row.textContent!.replace(/\s+/g, ' ').trim(),
    );
  const links = (el: HTMLElement, ranking: string) =>
    [...el.querySelectorAll(`[data-ranking="${ranking}"] [data-bar-link]`)].map((a) =>
      a.getAttribute('href'),
    );

  afterEach(() => TestBed.resetTestingModule());

  it('shows the seven rankings in page order, asking the full lists', () => {
    const { el } = setup();
    expect(
      [...el.querySelectorAll('[data-ranking]')].map((s) => s.getAttribute('data-ranking')),
    ).toEqual([
      'mostPlayed',
      'topRated',
      'mostReplayed',
      'longestRuns',
      'shortGems',
      'mostDaysPlayed',
      'longestPending',
    ]);
    expect(limits).toEqual([STATS_RANKING_LIMIT, STATS_RANKING_LIMIT, STATS_RANKING_LIMIT]);
  });

  it('switches the most played ranking between single player and online', () => {
    const { fixture, el } = setup();
    expect(rows(el, 'mostPlayed')).toEqual([
      expect.stringContaining('Elden Ring'),
      expect.stringContaining('Hades'),
    ]);
    el.querySelectorAll<HTMLButtonElement>('[data-play-mode] button')[1].click();
    fixture.detectChanges();
    expect(rows(el, 'mostPlayed')).toEqual([expect.stringContaining('Fortnite')]);
  });

  it('links runs to their run page and games to their game page', () => {
    const { el } = setup();
    expect(links(el, 'topRated')).toEqual(['/games/1/experiences/11', '/games/5']);
    expect(links(el, 'longestRuns')).toEqual([
      '/games/1/experiences/11',
      '/games/2/experiences/21',
    ]);
    expect(links(el, 'mostReplayed')).toEqual(['/games/1']);
    expect(rows(el, 'mostReplayed')[0]).toContain('stats.runs');
  });

  it('explains the short gems rule and dates the pending games', () => {
    const { el } = setup();
    expect(
      el.querySelector('[data-ranking="shortGems"] [data-ranking-hint]')!.textContent,
    ).toContain('stats.games.shortGemsHint');
    expect(rows(el, 'shortGems')).toEqual([expect.stringContaining('Inside')]);
    expect(rows(el, 'longestPending')).toEqual([expect.stringContaining('stats.games.since')]);
    expect(links(el, 'longestPending')).toEqual(['/games/4']);
  });

  it('shows an empty note on a ranking without rows', () => {
    const { el } = setup();
    expect(
      el.querySelector('[data-ranking="mostDaysPlayed"] [data-ranking-empty]')!.textContent,
    ).toContain('stats.games.noDiary');
  });

  it('offers a retry when a ranking fails to load', () => {
    const { el } = setup({ getGameRankings: () => throwError(() => new Error('down')) });
    expect(el.querySelector('[data-ranking]')).toBeNull();
    expect(el.querySelector('app-stats-load-error')).not.toBeNull();
  });
});

describe('waitingDays', () => {
  it('counts whole days since the pending date, never negative nor for a bad date', () => {
    const now = new Date('2024-03-15T09:00:00');
    expect(waitingDays('2024-03-05T08:00:00', now)).toBe(10);
    expect(waitingDays('2024-03-20T08:00:00', now)).toBe(0);
    expect(waitingDays('nope', now)).toBe(0);
  });
});
