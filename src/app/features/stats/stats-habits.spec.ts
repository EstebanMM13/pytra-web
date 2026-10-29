import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { CompletionStats } from '../../core/models/stats.model';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';
import { StatsService } from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { StatsHabits } from './stats-habits';

@Component({ selector: 'app-navbar', template: '' })
class NavbarStub {}

const data: CompletionStats = {
  year: 2025,
  completedCount: 12,
  abandonedCount: 3,
  replayCount: 1,
  timeToFinish: {
    sampleSize: 9,
    averageDays: 40.4,
    medianDays: 21.5,
    fastest: { experienceId: 7, gameId: 3, gameName: 'Celeste', runLabel: 'Run 1', days: 2 },
    slowest: { experienceId: 8, gameId: 4, gameName: 'Elden Ring', runLabel: 'NG+', days: 400 },
    buckets: ['0-7', '8-30', '31-90', '91-180', '181-365', '366+'].map((label, i) => ({
      label,
      minDays: i,
      maxDays: null,
      count: i,
    })),
  },
  abandonmentByGenre: [
    { genreId: 1, genreName: 'RPG', completedCount: 6, abandonedCount: 2, abandonmentRate: 0.25 },
    { genreId: 2, genreName: 'PUZZLE', completedCount: 1, abandonedCount: 1, abandonmentRate: 0.5 },
  ],
  hoursBuckets: ['<10', '10-30', '30-60', '60+'].map((label, i) => ({
    label,
    minHours: i,
    maxHours: null,
    runCount: 2,
    ratedCount: i === 3 ? 0 : 2,
    averageRating: i === 3 ? null : 7 + i,
  })),
};

describe('Stats habits page', () => {
  function setup() {
    const queryParamMap = new BehaviorSubject(convertToParamMap({ year: '2025' }));
    TestBed.configureTestingModule({
      imports: [StatsHabits],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: ActivatedRoute, useValue: { queryParamMap, snapshot: { queryParamMap: queryParamMap.value } } },
        { provide: RunFormLauncher, useValue: { saved$: new Subject() } },
        { provide: StatsService, useValue: { getCompletion: () => of(data), getYears: () => of([2025]) } },
      ],
    });
    TestBed.overrideComponent(StatsHabits, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    const fixture = TestBed.createComponent(StatsHabits);
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('links the fastest and slowest runs to their run page', () => {
    const el = setup();
    expect(el.querySelector('[data-run-extreme="fastest"]')!.getAttribute('href')).toBe('/games/3/experiences/7');
    expect(el.querySelector('[data-run-extreme="slowest"]')!.getAttribute('href')).toBe('/games/4/experiences/8');
  });

  it('hides genres with too few runs and says so', () => {
    const el = setup();
    expect(el.querySelectorAll('[data-abandonment] [data-bar-row]')).toHaveLength(1);
    expect(el.querySelector('[data-hidden-genres]')).not.toBeNull();
  });

  it('shows the six day buckets and the four length buckets', () => {
    const el = setup();
    expect(el.querySelectorAll('[data-day-buckets] [data-bar-row]')).toHaveLength(6);
    expect(el.querySelectorAll('[data-hours-buckets] [data-bar-row]')).toHaveLength(4);
  });

  it('links buckets and genres to the library, within the picked year', () => {
    const el = setup();
    // The empty first day bucket (0 runs) has no link.
    const days = [...el.querySelectorAll('[data-day-buckets] a')].map((a) => a.getAttribute('href'));
    expect(days).toHaveLength(5);
    expect(days[0]).toBe('/games?year=2025&days=1-');
    expect(el.querySelector('[data-hours-buckets] a')!.getAttribute('href')).toBe('/games?year=2025&hours=0-');
    expect(el.querySelector('[data-abandonment] a')!.getAttribute('href')).toBe('/games?genre=1&year=2025');
  });
});
