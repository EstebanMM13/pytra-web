import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { YearExperience, YearSummary } from '../../core/models/stats.model';
import { StatsService } from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { Years } from './years';

@Component({ selector: 'app-navbar', template: '' })
class NavbarStub {}

function summary(partial: Partial<YearSummary>): YearSummary {
  return {
    year: 2025,
    totalHours: 50,
    experienceCount: 1,
    completedCount: 1,
    abandonedCount: 0,
    averageRating: 9,
    platinumCount: 0,
    fullCompletionCount: 0,
    hoursWithoutMonth: 0,
    months: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, hours: i === 2 ? 50 : 0 })),
    experiences: [],
    goty: null,
    topRated: [],
    mostPlayed: [],
    topSagas: [],
    topGenres: [],
    surprises: [],
    disappointments: [],
    note: { summary: null, highlights: null, updatedAt: null },
    ...partial,
  };
}

function run(gameId: number, gameName: string, coverImageUrl: string | null): YearExperience {
  return {
    experienceId: gameId * 10,
    gameId,
    gameName,
    coverImageUrl,
    runLabel: 'Run 1',
    status: 'COMPLETADO',
    hours: 20,
    rating: 9,
    platinum: false,
    fullCompletion: false,
  } as YearExperience;
}

describe('Years page', () => {
  function setup(data: YearSummary) {
    TestBed.configureTestingModule({
      imports: [Years],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ year: '2025' })),
            snapshot: { paramMap: convertToParamMap({ year: '2025' }) },
          },
        },
        {
          provide: StatsService,
          useValue: {
            getYears: () => of([2025]),
            getByYear: () => of([]),
            getYearSummary: () => of(data),
          },
        },
      ],
    });
    TestBed.overrideComponent(Years, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    const fixture = TestBed.createComponent(Years);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it("blurs the GOTY's cover behind the year hero", () => {
    const el = setup(
      summary({
        goty: { gameId: 1, gameName: 'Goty', avgRating: 10, experienceCount: 1, totalHours: 40, coverImageUrl: 'goty.jpg' },
      }),
    );
    expect(el.querySelector('[data-year-hero] [data-year-backdrop]')!.getAttribute('src')).toBe('goty.jpg');
    expect(el.querySelector('[data-goty-backdrop]')!.getAttribute('src')).toBe('goty.jpg');
  });

  it('falls back to the brand glow without a GOTY cover', () => {
    const el = setup(summary({}));
    expect(el.querySelector('[data-year-hero]')).not.toBeNull();
    expect(el.querySelector('[data-year-backdrop]')).toBeNull();
    expect(el.querySelector('[data-year-hero] app-pytra-mark')).not.toBeNull();
  });

  it('lists the runs as run rows with their cover behind them', () => {
    const el = setup(summary({ experiences: [run(1, 'Hades', 'hades.jpg')] }));
    const rows = el.querySelectorAll('[data-year-run] app-run-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].querySelector('img[src="hades.jpg"]')).not.toBeNull();
  });

  it('shows the cover of each most played game, looked up from the runs', () => {
    const el = setup(
      summary({
        experiences: [run(1, 'Hades', 'hades.jpg')],
        mostPlayed: [{ gameId: 1, gameName: 'Hades', totalHours: 20 }],
        topRated: [{ gameId: 1, gameName: 'Hades', avgRating: 9, experienceCount: 1, totalHours: 20 }],
      }),
    );
    const mostPlayed = [...el.querySelectorAll('a .played-bar')].map((bar) => bar.closest('a')!);
    expect(mostPlayed).toHaveLength(1);
    expect(mostPlayed[0].querySelector('app-game-cover img')?.getAttribute('src')).toContain('hades.jpg');
    expect(el.querySelector('[data-rank-first]')!.textContent!.trim()).toBe('1');
  });

  it('shows the empty-year card when the year has nothing', () => {
    const el = setup(summary({ experienceCount: 0, totalHours: 0, completedCount: 0 }));
    expect(el.querySelector('[data-empty-year]')).not.toBeNull();
  });
});
