import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { DeveloperStats } from '../../core/models/stats.model';
import { GameService } from '../../core/services/game.service';
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
          provide: GameService,
          useValue: {
            findAll: () =>
              of([
                { id: 1, name: 'Elden Ring', developer: 'FromSoftware', coverImageUrl: 'er.jpg', totalHours: 200 },
                { id: 2, name: 'Sekiro', developer: 'FromSoftware', coverImageUrl: 'sk.jpg', totalHours: 100 },
              ]),
          },
        },
        {
          provide: StatsService,
          useValue: { getByDeveloper: () => of(developers), getYears: () => of([]) },
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

  it('heads the page with the first studio of the picked ranking', () => {
    const { fixture, el } = setup();
    const hero = el.querySelector('[data-top-studio]')!;
    expect(hero.querySelector('[data-spotlight-link]')!.getAttribute('href')).toBe('/stats/studio?name=FromSoftware');
    expect(hero.querySelector('[data-spotlight-name]')!.textContent!.trim()).toBe('FromSoftware');
    // Its most played games, listed beside the figure on wide screens.
    expect([...hero.querySelectorAll('[data-hero-games] li')].map((li) => li.textContent)).toEqual([
      expect.stringContaining('Elden Ring'),
      expect.stringContaining('Sekiro'),
    ]);
    // Its games' covers from the library, and the most played one blurred behind the card.
    expect(hero.querySelectorAll('app-stats-cover-stack')[0].querySelectorAll('app-game-cover')).toHaveLength(2);
    expect(el.querySelector('[data-stats-hero] img[src="er.jpg"]')).not.toBeNull();

    el.querySelectorAll<HTMLButtonElement>('[data-ranking] button')[1].click();
    fixture.detectChanges();
    expect(el.querySelector('[data-top-studio]')!.textContent).toContain('9,20');
  });

  it('opens a studio page from its row', () => {
    const { el } = setup();
    expect(el.querySelector('[data-developers] a')!.getAttribute('href')).toBe('/stats/studio?name=FromSoftware');
  });
});
