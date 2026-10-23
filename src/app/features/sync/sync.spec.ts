import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { DemoModeService } from '../../core/services/demo-mode.service';
import { ExperienceService } from '../../core/services/experience.service';
import { NativeOAuthService } from '../../core/services/native-oauth.service';
import { PsnService } from '../../core/services/psn.service';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';
import { SteamService } from '../../core/services/steam.service';
import { Navbar } from '../../shared/navbar/navbar';
import { ToastService } from '../../shared/toast/toast.service';
import { Sync } from './sync';

@Component({ selector: 'app-navbar', template: '' })
class NavbarStub {}

describe('Sync', () => {
  function setup({ demo = false } = {}) {
    const steam = {
      getStatus: vi.fn(() => of({ configured: true, linked: false })),
      getPending: vi.fn(() => of([])),
      getIgnored: vi.fn(() => of([])),
      requestConnectToken: vi.fn(() => of({ token: 't' })),
      buildLoginUrl: vi.fn((token: string) => `/login?state=${token}`),
    };
    const psn = {
      getStatus: vi.fn(() => of({ configured: true, linked: false })),
      getPending: vi.fn(() => of([])),
      getIgnored: vi.fn(() => of([])),
      link: vi.fn(),
    };
    const blockWrite = vi.fn(() => demo);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'sync', component: Sync }]),
        provideTranslateService(),
        { provide: SteamService, useValue: steam },
        { provide: PsnService, useValue: psn },
        { provide: DemoModeService, useValue: { isDemo: signal(demo), blockWrite } },
        { provide: ExperienceService, useValue: { findAllByGame: () => of([]) } },
        { provide: NativeOAuthService, useValue: { isNative: false, openExternalFlow: vi.fn(() => Promise.resolve()) } },
        { provide: RunFormLauncher, useValue: { openNewRun: vi.fn(), openEditRun: vi.fn(), openEditRuns: vi.fn() } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(Sync, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    return { steam, psn, blockWrite };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('shows the Steam and PlayStation platforms', async () => {
    setup();
    const harness = await RouterTestingHarness.create('/sync');
    const el = harness.routeNativeElement as HTMLElement;

    expect(el.querySelector('h1')?.textContent).toContain('sync.title');
    const steamCard = el.querySelector('app-steam-panel [data-platform="steam"]');
    expect(steamCard?.querySelector('h2')?.textContent).toContain('steam.title');
    expect(steamCard?.textContent).toContain('steam.notLinkedPill');
    expect(steamCard?.textContent).toContain('steam.connect');
    const psnCard = el.querySelector('app-psn-panel [data-platform="playstation"]');
    expect(psnCard?.getAttribute('aria-disabled')).toBeNull();
    expect(psnCard?.querySelector('h2')?.textContent).toContain('sync.playstation');
    expect(psnCard?.textContent).toContain('psn.notLinkedPill');
    expect(psnCard?.querySelector('#psn-online-id')).not.toBeNull();
  });

  it('reads the Steam link callback params and drops them from the URL', async () => {
    setup();
    const harness = await RouterTestingHarness.create('/sync?linked=1');
    await harness.fixture.whenStable();
    const el = harness.routeNativeElement as HTMLElement;

    expect(el.querySelector('[role="status"]')?.textContent).toContain('steam.linked');
    expect(TestBed.inject(Router).url).toBe('/sync');
  });

  it('keeps demo gating: connecting stops at the demo guard', async () => {
    const { steam, blockWrite } = setup({ demo: true });
    const harness = await RouterTestingHarness.create('/sync');
    const el = harness.routeNativeElement as HTMLElement;
    const connect = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('steam.connect'));

    connect?.click();

    expect(blockWrite).toHaveBeenCalled();
    expect(steam.requestConnectToken).not.toHaveBeenCalled();
  });
});
