import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes, steamLegacyMatcher } from './app.routes';

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
