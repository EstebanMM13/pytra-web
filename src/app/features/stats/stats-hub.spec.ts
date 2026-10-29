import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { Observable, Subject, of, throwError } from 'rxjs';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';
import { StatsService } from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { StatsHub } from './stats-hub';

@Component({ selector: 'app-navbar', template: '' })
class NavbarStub {}

describe('Stats hub', () => {
  function setup(overrides: Record<string, () => Observable<unknown>> = {}) {
    const saved$ = new Subject<void>();
    TestBed.configureTestingModule({
      imports: [StatsHub],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: RunFormLauncher, useValue: { saved$ } },
        {
          provide: StatsService,
          useValue: {
            getActivity: () =>
              of({ currentStreak: { length: 4 }, longestStreak: { length: 12 }, activeDays: 30 }),
            getByYear: () => of([{ year: 2024, totalHours: 80 }, { year: 2026, totalHours: 12.5 }]),
            getBySaga: () => of([{ sagaId: 1, sagaName: 'Zelda', gameCount: 3, totalHours: 90 }]),
            getByPlatform: () => of({ platforms: [{ name: 'PlayStation 5', hours: 300 }] }),
            getByDeveloper: () => of({ topByHours: [{ developer: 'FromSoftware', hours: 250 }] }),
            getCompletion: () => of({ timeToFinish: { medianDays: 22.6 } }),
            getRatings: () => of({ mean: 7.94, ratedCount: 40 }),
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
