import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { Game } from '../../core/models/game.model';
import { GameService } from '../../core/services/game.service';
import { Navbar } from '../../shared/navbar/navbar';
import { StatsStudio } from './stats-studio';

@Component({ selector: 'app-navbar', template: '' })
class NavbarStub {}

function game(id: number, developer: string | null, partial: Partial<Game> = {}): Game {
  return {
    id,
    name: `Game ${id}`,
    developer,
    publisher: null,
    releaseDate: `20${10 + id}-01-01`,
    category: 'SINGLEPLAYER',
    sagaId: null,
    sagaName: null,
    coverImageUrl: null,
    reviewStatus: 'CONFIRMED',
    genres: [],
    updatedAt: '2026-01-01T00:00:00',
    ...partial,
  };
}

const GAMES: Game[] = [
  game(1, 'FromSoftware', { experienceCount: 1, totalHours: 80, bestRating: 9 }),
  // Same studio for the API's developer stats: trimmed, any case.
  game(2, '  fromsoftware ', { experienceCount: 2, totalHours: 20, bestRating: 7, hasPlatinum: true }),
  game(3, 'FromSoftware'),
  game(4, 'Nintendo', { experienceCount: 1, totalHours: 10 }),
  game(5, 'FromSoftware', { reviewStatus: 'PENDING_REVIEW' }),
];

describe('Stats studio page', () => {
  function setup(name: string, findAll = () => of(GAMES)) {
    const queryParamMap = new BehaviorSubject(convertToParamMap({ name }));
    TestBed.configureTestingModule({
      imports: [StatsStudio],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: ActivatedRoute, useValue: { queryParamMap, snapshot: { queryParamMap: queryParamMap.value } } },
        { provide: GameService, useValue: { findAll } },
      ],
    });
    TestBed.overrideComponent(StatsStudio, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    const fixture = TestBed.createComponent(StatsStudio);
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => TestBed.resetTestingModule());

  it("lists the studio's library games in release order, grouped like the developer stats", () => {
    const el = setup('FROMSOFTWARE');
    const rows = [...el.querySelectorAll('[data-saga-timeline] a')].map((a) => a.getAttribute('href'));
    expect(rows).toEqual(['/games/1', '/games/2', '/games/3']);
    expect(el.querySelector('h1')!.textContent).toContain('FromSoftware');
    expect(el.querySelector('[data-studio-stats]')!.textContent).toContain('2 / 3');
  });

  it('links back to the studios section and to the library filtered by the studio', () => {
    const el = setup('FromSoftware');
    expect(el.querySelector('[data-stats-back]')!.getAttribute('href')).toBe('/stats/studios');
    expect(el.querySelector('[data-studio-library]')!.getAttribute('href')).toBe('/games?dev=FromSoftware');
  });

  it('says so when the library has no game of the studio', () => {
    const el = setup('Unknown Studio');
    expect(el.querySelector('[data-studio-empty]')).not.toBeNull();
  });

  it('offers a retry when the library fails to load', () => {
    const el = setup('FromSoftware', () => throwError(() => new Error('down')));
    expect(el.querySelector('app-stats-load-error')).not.toBeNull();
  });
});
