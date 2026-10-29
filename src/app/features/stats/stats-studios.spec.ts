import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { DeveloperStats, ReleaseEraStats } from '../../core/models/stats.model';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';
import { StatsService } from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { StatsStudios } from './stats-studios';

@Component({ selector: 'app-navbar', template: '' })
class NavbarStub {}

const developers: DeveloperStats = {
  minRatedGames: 2,
  topByHours: [
    { developer: 'FromSoftware', gameCount: 4, hours: 300, ratedGameCount: 4, averageRating: 9.2 },
    { developer: 'Nintendo EPD', gameCount: 3, hours: 120, ratedGameCount: 1, averageRating: 8 },
  ],
  topByRating: [{ developer: 'FromSoftware', gameCount: 4, hours: 300, ratedGameCount: 4, averageRating: 9.2 }],
};

const eras: ReleaseEraStats = {
  byDecade: [
    { decade: 1990, gameCount: 2, hours: 40, ratedGameCount: 1, averageRating: 9 },
    { decade: 2010, gameCount: 5, hours: 200, ratedGameCount: 4, averageRating: null },
  ],
  byYear: [],
  undatedGameCount: 3,
};

describe('Stats studios page', () => {
  function setup() {
    const queryParamMap = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      imports: [StatsStudios],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: ActivatedRoute, useValue: { queryParamMap, snapshot: { queryParamMap: queryParamMap.value } } },
        { provide: RunFormLauncher, useValue: { saved$: new Subject() } },
        {
          provide: StatsService,
          useValue: { getByDeveloper: () => of(developers), getByReleaseEra: () => of(eras), getYears: () => of([]) },
        },
      ],
    });
    TestBed.overrideComponent(StatsStudios, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    const fixture = TestBed.createComponent(StatsStudios);
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('ranks studios by hours, and by rating with the minimum-games note', () => {
    const { fixture, el } = setup();
    expect(el.querySelectorAll('[data-developers] [data-bar-row]')).toHaveLength(2);
    expect(el.querySelector('[data-threshold]')).toBeNull();

    el.querySelectorAll<HTMLButtonElement>('[data-ranking] button')[1].click();
    fixture.detectChanges();
    expect(el.querySelectorAll('[data-developers] [data-bar-row]')).toHaveLength(1);
    expect(el.querySelector('[data-threshold]')).not.toBeNull();
  });

  it('shows the release decades', () => {
    const { el } = setup();
    expect(el.querySelectorAll('[data-decades] [data-bar-row]')).toHaveLength(2);
  });

  it('opens a studio page from its row and the library from a decade', () => {
    const { el } = setup();
    expect(el.querySelector('[data-developers] a')!.getAttribute('href')).toBe('/stats/studio?name=FromSoftware');
    expect(el.querySelector('[data-decades] a')!.getAttribute('href')).toBe('/games?decade=1990');
  });
});
