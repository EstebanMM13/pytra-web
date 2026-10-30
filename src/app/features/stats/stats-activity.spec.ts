import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { ActivityStats } from '../../core/models/stats.model';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';
import { StatsService } from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { StatsActivity } from './stats-activity';

@Component({ selector: 'app-navbar', template: '' })
class NavbarStub {}

function activity(partial: Partial<ActivityStats> = {}): ActivityStats {
  return {
    year: 2026,
    totalHours: 10,
    activeDays: 2,
    days: [
      { date: '2026-03-02', hours: 4, gameCount: 1 },
      { date: '2026-03-03', hours: 6, gameCount: 2 },
    ],
    currentStreak: { length: 0, startDate: null, endDate: null },
    longestStreak: { length: 2, startDate: '2026-03-02', endDate: '2026-03-03' },
    weekdays: Array.from({ length: 7 }, (_, i) => ({ dayOfWeek: i + 1, name: 'X', daysPlayed: i < 2 ? 1 : 0, hours: i === 0 ? 4 : i === 1 ? 6 : 0 })),
    ...partial,
  };
}

describe('Stats activity page', () => {
  function setup(data: ActivityStats, query: Record<string, string> = {}) {
    const getActivity = vi.fn(() => of(data));
    const queryParamMap = new BehaviorSubject(convertToParamMap(query));
    TestBed.configureTestingModule({
      imports: [StatsActivity],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: ActivatedRoute, useValue: { queryParamMap, snapshot: { queryParamMap: queryParamMap.value } } },
        { provide: RunFormLauncher, useValue: { saved$: new Subject() } },
        { provide: StatsService, useValue: { getActivity, getYears: () => of([2026, 2025]) } },
      ],
    });
    TestBed.overrideComponent(StatsActivity, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    const fixture = TestBed.createComponent(StatsActivity);
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, getActivity, queryParamMap };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('draws every day of the year twice (phone halves and the md+ strip), played days coloured', () => {
    const { el } = setup(activity());
    const cells = el.querySelectorAll('[data-heat-cell]');
    expect(cells).toHaveLength(365 * 2);
    // Two played days, in both layouts.
    expect([...cells].filter((c) => !c.className.includes('bg-hover/50'))).toHaveLength(4);
  });

  it('asks the API for the year in the URL', () => {
    const { getActivity } = setup(activity({ year: 2025 }), { year: '2025' });
    expect(getActivity).toHaveBeenLastCalledWith(2025);
  });

  it('points to the diary when the year has no play days', () => {
    const { el } = setup(activity({ activeDays: 0, days: [] }));
    const empty = el.querySelector('[data-activity-empty]')!;
    expect(empty.querySelector('a')!.getAttribute('href')).toBe('/diary');
    expect(el.querySelector('[data-heat-cell]')).toBeNull();
  });

  it('reads a tapped day out with a diary link, and opens it on a second tap', () => {
    const { fixture, el } = setup(activity());
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const cell = el.querySelector<HTMLElement>('[data-heat-cell]')!;
    cell.click();
    fixture.detectChanges();
    // Phones have no hover title: the readout and the link are the cue.
    expect(el.querySelector('[data-picked-day]')!.textContent).toContain('stats.activity.dayTitle');
    expect(el.querySelector('[data-picked-open]')!.getAttribute('href')).toMatch(/^\/diary\?date=\d{4}-01-01$/);
    expect(navigate).not.toHaveBeenCalled();

    cell.click();
    expect(navigate).toHaveBeenCalledWith(['/diary'], { queryParams: { date: expect.stringMatching(/^\d{4}-01-01$/) } });
  });

  it('changes the year through the query param', () => {
    const { el } = setup(activity());
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    el.querySelector<HTMLButtonElement>('[data-year-older]')!.click();
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { year: 2025 }, replaceUrl: true }));
  });

  it('sets the heatmap apart as the hero and draws the hours tile trend of a past year', () => {
    const { el } = setup(activity({ year: 2025, days: [{ date: '2025-03-02', hours: 4, gameCount: 1 }] }), { year: '2025' });
    expect(el.querySelector('[data-activity-hero] [data-heat-cell]')).not.toBeNull();
    expect(el.querySelector('[data-visual="trend"]')).not.toBeNull();
  });
});
