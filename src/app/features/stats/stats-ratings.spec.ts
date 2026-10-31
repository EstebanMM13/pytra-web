import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { RatingStats } from '../../core/models/stats.model';
import { PlatformService } from '../../core/services/platform.service';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';
import { StatsService } from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { StatsRatings } from './stats-ratings';

@Component({ selector: 'app-navbar', template: '' })
class NavbarStub {}

function ratings(partial: Partial<RatingStats> = {}): RatingStats {
  return {
    year: null,
    bucketSize: 0.5,
    ratedCount: 6,
    mean: 8.1,
    median: 8,
    standardDeviation: 0.7,
    histogram: Array.from({ length: 21 }, (_, i) => ({ from: i / 2, to: i === 20 ? 10 : (i + 1) / 2, count: i === 16 ? 4 : i === 17 ? 2 : 0 })),
    byGenre: [
      { genreId: 1, genreName: 'RPG', ratedCount: 4, averageRating: 8.5 },
      { genreId: 2, genreName: 'PUZZLE', ratedCount: 1, averageRating: 9.5 },
    ],
    byPlatform: [{ platformId: 1, name: 'PS5', color: '#6b93f5', ratedCount: 6, averageRating: 8.1 }],
    ...partial,
  };
}

describe('Stats ratings page', () => {
  function setup(data: RatingStats) {
    const queryParamMap = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      imports: [StatsRatings],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: ActivatedRoute, useValue: { queryParamMap, snapshot: { queryParamMap: queryParamMap.value } } },
        { provide: RunFormLauncher, useValue: { saved$: new Subject() } },
        { provide: StatsService, useValue: { getRatings: () => of(data), getYears: () => of([]) } },
        { provide: PlatformService, useValue: { platforms: () => null, load: () => of([]) } },
      ],
    });
    TestBed.overrideComponent(StatsRatings, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    const fixture = TestBed.createComponent(StatsRatings);
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('reads the mean in plain language and draws all 21 buckets (wide) with a label each', () => {
    const el = setup(ratings());
    expect(el.querySelector('[data-mean]')!.textContent).toContain('stats.ratings.temperament.generous');
    const [narrow, wide] = [...el.querySelectorAll<HTMLElement>('[data-histogram]')];
    const bars = wide.querySelectorAll<HTMLElement>('[role="listitem"] > div');
    expect(bars).toHaveLength(21);
    expect(bars[16].style.height).toBe('100%');
    expect(bars[0].style.height).toBe('0%');
    const [narrowAxis, wideAxis] = [...el.querySelectorAll<HTMLElement>('[data-histogram-axis]')];
    expect(wideAxis.querySelectorAll('span')).toHaveLength(21);
    // Phones: whole points, 0..10, every column labelled; 8 and 8.5 merge into the "8" column.
    const narrowBars = narrow.querySelectorAll<HTMLElement>('[role="listitem"] > div');
    expect(narrowBars).toHaveLength(11);
    expect(narrowBars[8].style.height).toBe('100%');
    expect([...narrowAxis.querySelectorAll('span')].map((s) => s.textContent!.trim())).toEqual(
      ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    );
  });

  it('links genres and platforms to the library', () => {
    const el = setup(ratings({ byGenre: [{ genreId: 1, genreName: 'RPG', ratedCount: 4, averageRating: 8.5 }] }));
    expect(el.querySelector('[data-genres] a')!.getAttribute('href')).toBe('/games?genre=1&sort=rating');
    expect(el.querySelector('[data-platforms] a')!.getAttribute('href')).toBe('/games?platform=1&sort=rating');
  });

  it('hides genres with too few ratings', () => {
    const el = setup(ratings());
    expect(el.querySelectorAll('[data-genres] [data-bar-row]')).toHaveLength(1);
    expect(el.querySelector('[data-hidden-genres]')).not.toBeNull();
  });

  it('shows an empty state without ratings', () => {
    const el = setup(ratings({ ratedCount: 0, mean: null, median: null, standardDeviation: null, byGenre: [], byPlatform: [] }));
    expect(el.querySelector('[data-ratings-empty]')).not.toBeNull();
    expect(el.querySelector('[data-histogram]')).toBeNull();
  });

  it('draws the histogram as the gold hero and ranks genres and platforms', () => {
    const el = setup(ratings());
    const hero = el.querySelector('[data-ratings-hero]')!;
    expect(hero.classList).toContain('gold-border');
    expect(hero.querySelector('[data-histogram]')).not.toBeNull();
    expect(el.querySelector('[data-genres] [data-rank-first]')).not.toBeNull();
    expect(el.querySelector('[data-platforms] [data-rank-first]')).not.toBeNull();
  });
});
