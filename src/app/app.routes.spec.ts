import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, UrlSegment, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes, steamLegacyMatcher, yearsMatcher } from './app.routes';

@Component({ template: 'sync' })
class SyncStub {}

describe('legacy /steam route', () => {
  async function navigate(url: string): Promise<string> {
    const legacy = routes.find((route) => route.matcher === steamLegacyMatcher);
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'sync', component: SyncStub }, legacy!])],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    return TestBed.inject(Router).url;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('redirects /steam to /sync', async () => {
    expect(await navigate('/steam')).toBe('/sync');
  });

  it('keeps the link-flow query params and the fragment', async () => {
    expect(await navigate('/steam?linked=1#pending')).toBe('/sync?linked=1#pending');
    TestBed.resetTestingModule();
    expect(await navigate('/steam?linkError=steam_already_linked')).toBe('/sync?linkError=steam_already_linked');
  });

  it('also redirects any path below /steam', async () => {
    expect(await navigate('/steam/callback?linked=1')).toBe('/sync?linked=1');
  });
});

@Component({ template: 'years' })
class YearsStub {
  static instances = 0;
  readonly route = inject(ActivatedRoute);
  constructor() {
    YearsStub.instances++;
  }
}

describe('/years route', () => {
  beforeEach(() => {
    YearsStub.instances = 0;
    TestBed.configureTestingModule({
      providers: [provideRouter([{ matcher: yearsMatcher, component: YearsStub }])],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('keeps one page instance from /years to /years/:year and across years', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/years', YearsStub);
    expect(page.route.snapshot.paramMap.get('year')).toBeNull();

    expect(await harness.navigateByUrl('/years/2026', YearsStub)).toBe(page);
    expect(page.route.snapshot.paramMap.get('year')).toBe('2026');
    await harness.navigateByUrl('/years/2025');
    expect(page.route.snapshot.paramMap.get('year')).toBe('2025');
    expect(YearsStub.instances).toBe(1);
  });

  it('does not match other paths', () => {
    const match = (path: string) =>
      yearsMatcher(path.split('/').map((p) => new UrlSegment(p, {})));
    expect(match('years/2026/extra')).toBeNull();
    expect(match('yearsx')).toBeNull();
  });
});
