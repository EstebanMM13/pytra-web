import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { PlatformStats } from '../../core/models/stats.model';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';
import { StatsService } from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { StatsPlatforms } from './stats-platforms';

@Component({ selector: 'app-navbar', template: '' })
class NavbarStub {}

const data: PlatformStats = {
  year: null,
  unassignedOnlineHours: 5,
  platforms: [
    { platformId: 1, name: 'PS5', color: '#6b93f5', family: null, hours: 100, runHours: 90, onlineHours: 10, gameCount: 4, runCount: 5, completedRunCount: 3, ratedRunCount: 3, averageRating: 8 },
    { platformId: 2, name: 'Switch', color: null, family: null, hours: 50, runHours: 50, onlineHours: 0, gameCount: 2, runCount: 2, completedRunCount: 0, ratedRunCount: 0, averageRating: null },
    { platformId: 3, name: 'Wii', color: null, family: null, hours: 0, runHours: 0, onlineHours: 0, gameCount: 1, runCount: 1, completedRunCount: 0, ratedRunCount: 0, averageRating: null },
  ],
  byYear: [
    { year: 2024, totalHours: 40, unassignedOnlineHours: 0, platforms: [{ platformId: 2, name: 'Switch', color: null, hours: 40 }] },
    { year: 2025, totalHours: 0, unassignedOnlineHours: 0, platforms: [] },
    { year: 2026, totalHours: 115, unassignedOnlineHours: 5, platforms: [{ platformId: 1, name: 'PS5', color: '#6b93f5', hours: 100 }, { platformId: 2, name: 'Switch', color: null, hours: 10 }] },
  ],
};

describe('Stats platforms page', () => {
  function setup(query: Record<string, string> = {}) {
    const getByPlatform = vi.fn(() => of(data));
    const queryParamMap = new BehaviorSubject(convertToParamMap(query));
    TestBed.configureTestingModule({
      imports: [StatsPlatforms],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: ActivatedRoute, useValue: { queryParamMap, snapshot: { queryParamMap: queryParamMap.value } } },
        { provide: RunFormLauncher, useValue: { saved$: new Subject() } },
        { provide: StatsService, useValue: { getByPlatform, getYears: () => of([2026, 2024]) } },
      ],
    });
    TestBed.overrideComponent(StatsPlatforms, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    const fixture = TestBed.createComponent(StatsPlatforms);
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
    return { el: fixture.nativeElement as HTMLElement, getByPlatform };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('lists the platforms with hours, all time by default', () => {
    const { el, getByPlatform } = setup();
    expect(getByPlatform).toHaveBeenLastCalledWith(null);
    expect(el.querySelectorAll('[data-platform-list] [data-bar-row]')).toHaveLength(2);
  });

  it('stacks every year with hours, newest first, linking to its summary', () => {
    const { el } = setup({ year: '2026' });
    const links = [...el.querySelectorAll('[data-platform-years] a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/years/2026', '/years/2024']);
    expect(el.querySelectorAll('[data-platform-legend] li')).toHaveLength(2);
  });
});
