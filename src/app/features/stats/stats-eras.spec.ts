import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { ReleaseEraStats } from '../../core/models/stats.model';
import { GameService } from '../../core/services/game.service';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';
import { StatsService } from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { StatsEras } from './stats-eras';

@Component({ selector: 'app-navbar', template: '' })
class NavbarStub {}

const eras: ReleaseEraStats = {
  byDecade: [
    { decade: 1980, gameCount: 0, hours: 0, ratedGameCount: 0, averageRating: null },
    { decade: 1990, gameCount: 2, hours: 40, ratedGameCount: 1, averageRating: 9 },
    { decade: 2000, gameCount: 0, hours: 0, ratedGameCount: 0, averageRating: null },
    { decade: 2010, gameCount: 5, hours: 200, ratedGameCount: 4, averageRating: 8 },
  ],
  byYear: [
    { year: 1998, gameCount: 2, hours: 40, ratedGameCount: 1, averageRating: 9 },
    { year: 2015, gameCount: 5, hours: 200, ratedGameCount: 4, averageRating: 8 },
  ],
  undatedGameCount: 3,
};

const library = [
  { id: 1, name: 'Witcher 3', releaseDate: '2015-05-19', coverImageUrl: 'w3.jpg', totalHours: 150, experienceCount: 1 },
  { id: 2, name: 'Half-Life', releaseDate: '1998-11-19', coverImageUrl: 'hl.jpg', totalHours: 20, experienceCount: 1 },
];

describe('Stats eras page', () => {
  function setup() {
    const queryParamMap = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      imports: [StatsEras],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: ActivatedRoute, useValue: { queryParamMap, snapshot: { queryParamMap: queryParamMap.value } } },
        { provide: RunFormLauncher, useValue: { saved$: new Subject() } },
        { provide: GameService, useValue: { findAll: () => of(library) } },
        { provide: StatsService, useValue: { getByReleaseEra: () => of(eras), getYears: () => of([]) } },
      ],
    });
    TestBed.overrideComponent(StatsEras, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    const fixture = TestBed.createComponent(StatsEras);
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('heads the page with the decade played most, opening the library on it', () => {
    const el = setup();
    const hero = el.querySelector('[data-top-decade]')!;
    expect(hero.querySelector('[data-spotlight-link]')!.getAttribute('href')).toBe('/games?decade=2010');
    expect(hero.querySelector('app-stats-cover-stack app-game-cover')).not.toBeNull();
  });

  it('charts the decades from the first to the last with games, with their figures under the chart', () => {
    const el = setup();
    expect(el.querySelectorAll('[data-decades] [data-column]')).toHaveLength(3);
    expect(el.querySelector('[data-decades] a')!.getAttribute('href')).toBe('/games?decade=1990');
    // Empty decades get no table row.
    expect(el.querySelectorAll('[data-decade-table] tbody tr')).toHaveLength(2);
  });

  it('ranks the release years by hours and calls out the best decade and the oldest and newest releases', () => {
    const el = setup();
    expect(el.querySelector('[data-release-years] [data-rank-first]')).not.toBeNull();
    expect(el.querySelectorAll('[data-release-years] [data-bar-row]')).toHaveLength(2);
    // A release year opens the library on that year alone, not its whole decade.
    expect(el.querySelector('[data-release-years] [data-bar-row] a')!.getAttribute('href')).toBe(
      '/games?released=2015',
    );
    expect(el.querySelector('[data-era-callout="bestRated"] a')!.getAttribute('href')).toBe('/games?decade=2010');
    expect(el.querySelector('[data-era-callout="oldest"] a')!.getAttribute('href')).toBe('/games/2');
    expect(el.querySelector('[data-era-callout="newest"] a')!.getAttribute('href')).toBe('/games/1');
  });
});
