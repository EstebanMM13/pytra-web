import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { DemoModeService } from '../../core/services/demo-mode.service';
import { ExperienceService } from '../../core/services/experience.service';
import { NativeOAuthService } from '../../core/services/native-oauth.service';
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
    const blockWrite = vi.fn(() => demo);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'sync', component: Sync }]),
        provideTranslateService(),
        { provide: SteamService, useValue: steam },
        { provide: DemoModeService, useValue: { isDemo: signal(demo), blockWrite } },
        { provide: ExperienceService, useValue: { findAllByGame: () => of([]) } },
        { provide: NativeOAuthService, useValue: { isNative: false, openExternalFlow: vi.fn(() => Promise.resolve()) } },
        { provide: RunFormLauncher, useValue: { openNewRun: vi.fn(), openEditRun: vi.fn() } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(Sync, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    return { steam, blockWrite };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('shows the Steam platform and PlayStation as coming soon (disabled)', async () => {
    setup();
    const harness = await RouterTestingHarness.create('/sync');
    const el = harness.routeNativeElement as HTMLElement;

    expect(el.querySelector('h1')?.textContent).toContain('sync.title');
    expect(el.querySelector('[data-platform="steam"] app-steam-panel')).not.toBeNull();
    const psn = el.querySelector('[data-platform="playstation"]');
    expect(psn?.getAttribute('aria-disabled')).toBe('true');
    expect(psn?.textContent).toContain('sync.comingSoon');
    expect(psn?.querySelector('button, a')).toBeNull();
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
