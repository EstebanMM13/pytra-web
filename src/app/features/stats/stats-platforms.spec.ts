import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { PlatformStats } from '../../core/models/stats.model';
import { PlatformService } from '../../core/services/platform.service';
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
  function setup(query: Record<string, string> = {}, stats: PlatformStats = data) {
    const getByPlatform = vi.fn(() => of(stats));
    const queryParamMap = new BehaviorSubject(convertToParamMap(query));
    TestBed.configureTestingModule({
      imports: [StatsPlatforms],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: ActivatedRoute, useValue: { queryParamMap, snapshot: { queryParamMap: queryParamMap.value } } },
        { provide: RunFormLauncher, useValue: { saved$: new Subject() } },
        { provide: StatsService, useValue: { getByPlatform, getYears: () => of([2026, 2024]) } },
        // PS5 and PS4 share the family colour in the catalog: the page shades them apart.
        {
          provide: PlatformService,
          useValue: {
            platforms: () => null,
            load: () =>
              of([
                { id: 1, name: 'PS5', color: '#6b93f5', family: 'PLAYSTATION', legacyCode: 'PS5', sortOrder: 20 },
                { id: 4, name: 'PS4', color: '#6b93f5', family: 'PLAYSTATION', legacyCode: 'PS4', sortOrder: 30 },
              ]),
          },
        },
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

  it('stacks every year with hours, newest first, linking to its summary (all time only)', () => {
    const { el } = setup();
    const links = [...el.querySelectorAll('[data-platform-years] a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/years/2026', '/years/2024']);
    expect(el.querySelectorAll('[data-platform-legend] li')).toHaveLength(2);
  });

  it('hides the yearly stack when a year is picked', () => {
    const { el } = setup({ year: '2026' });
    expect(el.querySelector('[data-platform-years-card]')).toBeNull();
    expect(el.querySelectorAll('[data-platform-list] [data-bar-row]')).toHaveLength(2);
  });

  it('links each platform to the library filtered by it and by the picked year', () => {
    const { el } = setup({ year: '2026' });
    const hrefs = [...el.querySelectorAll('[data-platform-list] a[data-bar-link]')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/games?platform=1&year=2026&sort=hours', '/games?platform=2&year=2026&sort=hours']);
  });

  it('keeps each platform row to its games, finished runs and average rating', () => {
    const { el } = setup();
    const sub = el.querySelector('[data-platform-list] [data-bar-row] [data-bar-sub]')!.textContent!;
    expect(sub).toContain('stats.platforms.completed');
    expect(sub).toContain('stats.platforms.average');
    expect(sub).not.toContain('stats.runs');
    expect(sub).not.toContain('stats.platforms.online');
  });

  it('colours a platform sharing its family colour with a shade of it', () => {
    const { el } = setup();
    const dot = el.querySelector<HTMLElement>('[data-platform-list] [data-bar-row] span[aria-hidden="true"].rounded-full')!;
    // PS5 is first of its family in the catalog: it keeps a shade close to the family colour, not the neutral one.
    expect(dot.style.backgroundColor).not.toBe('');
    expect(dot.style.backgroundColor).not.toContain('platform-neutral');
  });

  it('heads the page with a share ring of the platforms with hours, the top one in its hole', () => {
    const { el } = setup();
    const hero = el.querySelector('[data-platform-hero]')!;
    expect(hero.querySelectorAll('[data-donut-arc]')).toHaveLength(2);
    expect(hero.querySelector('[data-platform-top-share]')!.textContent).toContain('67');
    expect(el.querySelectorAll('[data-platform-share-legend] li')).toHaveLength(2);
  });

  it('leaves the ring out when no platform has hours', () => {
    const { el } = setup({}, { ...data, platforms: data.platforms.map((p) => ({ ...p, hours: 0 })) });
    expect(el.querySelector('[data-platform-hero]')).toBeNull();
  });

  it('groups the platforms past the fifth into one "others" slice', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ ...data.platforms[0], platformId: i + 1, name: `P${i}`, hours: 70 - i * 5 }));
    const { el } = setup({}, { ...data, platforms: many });
    const legend = [...el.querySelectorAll('[data-platform-share-legend] li')].map((li) => li.textContent!);
    expect(legend).toHaveLength(6);
    expect(legend[5]).toContain('stats.platforms.others');
    // Its own colour, never the grey of a colourless platform.
    const dot = el.querySelectorAll<HTMLElement>('[data-platform-share-legend] li > span:first-child')[5];
    expect(dot.style.backgroundColor).toContain('border-strong');
  });

  it('ranks the platform list, the first in the gold chip', () => {
    const { el } = setup();
    expect(el.querySelector('[data-platform-list] [data-rank-first]')).not.toBeNull();
    expect(el.querySelector('[data-platform-list] [data-rank]')!.textContent!.trim()).toBe('2');
  });
});
