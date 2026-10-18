import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { CurrentUser } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { DemoModeService } from '../../core/services/demo-mode.service';
import { FileExportService } from '../../core/services/file-export.service';
import { GameService } from '../../core/services/game.service';
import { PlatformService } from '../../core/services/platform.service';
import { SagaService } from '../../core/services/saga.service';
import { StatsService } from '../../core/services/stats.service';
import { UserService } from '../../core/services/user.service';
import { Navbar } from '../../shared/navbar/navbar';
import { ToastService } from '../../shared/toast/toast.service';
import { Profile } from './profile';

@Component({ selector: 'app-navbar', template: '' })
class NavbarStub {}

const USER: CurrentUser = {
  username: 'ana',
  usernameDisplay: 'Ana',
  email: 'ana@example.com',
  hasPassword: true,
  googleLinked: false,
  createdAt: '2025-01-01T00:00:00',
  avatar: null,
};

describe('Profile', () => {
  function configure(demo = false) {
    const userService = {
      currentUser: signal(USER),
      displayName: signal('Ana'),
      updateProfile: vi.fn(() => of(USER)),
      exportData: vi.fn(),
    };
    const blockWrite = vi.fn(() => demo);
    TestBed.configureTestingModule({
      imports: [Profile],
      providers: [
        provideRouter([{ path: 'profile', component: Profile }]),
        provideTranslateService(),
        { provide: UserService, useValue: userService },
        { provide: AuthService, useValue: { isDemo: signal(demo), logout: vi.fn() } },
        { provide: DemoModeService, useValue: { isDemo: signal(demo), blockWrite } },
        { provide: GameService, useValue: { findAll: () => of([]) } },
        { provide: SagaService, useValue: { findAll: () => of([]) } },
        { provide: StatsService, useValue: { getSummary: () => of(null), getByYear: () => of([]) } },
        { provide: PlatformService, useValue: { platforms: signal([]), load: () => of([]) } },
        { provide: FileExportService, useValue: { save: vi.fn() } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(Profile, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    return { userService, blockWrite };
  }

  function setup(demo = false) {
    const mocks = configure(demo);
    const fixture = TestBed.createComponent(Profile);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const rows = () => [...el.querySelectorAll<HTMLElement>('[data-profile-rows] > a, [data-profile-rows] > button')];
    return { fixture, el, rows, ...mocks };
  }

  /** Opens the page through the router at `url`; returns the highlighted sidebar entry. */
  async function openAt(url: string) {
    configure();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, Profile);
    await new Promise((resolve) => setTimeout(resolve));
    harness.detectChanges();
    const active = () =>
      [...harness.routeNativeElement!.querySelectorAll<HTMLButtonElement>('nav button')]
        .find((b) => b.classList.contains('bg-brand-tint'))
        ?.textContent?.trim();
    return { harness, active };
  }

  const scrollIntoView = vi.fn();
  beforeEach(() => {
    scrollIntoView.mockClear();
    Element.prototype.scrollIntoView = scrollIntoView;
  });
  afterEach(() => TestBed.resetTestingModule());

  it('lists the same entries as the desktop sidebar, in the same order (Sync opens its page)', () => {
    const { el, rows } = setup();
    const labels = (nodes: HTMLElement[]) => nodes.map((n) => n.textContent!.replace(/\s+/g, ' ').trim());
    const sidebar = [...el.querySelectorAll<HTMLElement>('aside nav:not([data-profile-rows]) > *')];

    expect(labels(rows())).toEqual([
      'profile.sections.account',
      'profile.sections.achievements',
      'profile.sections.preferences',
      'profile.sections.data',
      'nav.sync',
      'nav.logout',
    ]);
    expect(labels(rows())).toEqual(labels(sidebar));
    expect(rows()[4].getAttribute('href')).toBe('/sync');

    for (const [index, anchor] of [
      [0, 'account'],
      [1, 'achievements'],
      [2, 'preferences'],
      [3, 'data'],
    ] as const) {
      const target = el.querySelector(`#profile-${anchor}`);
      expect(target).not.toBeNull();
      scrollIntoView.mockClear();
      rows()[index].click();
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.contexts[0]).toBe(target);
    }
  });

  it('logs out from the last mobile row', () => {
    const { rows } = setup();
    const auth = TestBed.inject(AuthService) as unknown as { logout: ReturnType<typeof vi.fn> };
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    rows()[5].click();
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('keeps "Borrar cuenta" inside the Datos section (no separate mobile row)', () => {
    const { el, rows } = setup();
    const open = el.querySelector<HTMLButtonElement>('#profile-data #profile-delete button')!;
    expect(open.textContent).toContain('profile.delete.open');
    expect(rows().some((r) => r.textContent!.includes('profile.delete'))).toBe(false);
  });

  it('opens at the top on "Cuenta" when no entry point targets a section', async () => {
    const { active } = await openAt('/profile');
    expect(active()).toBe('profile.sections.account');
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('opens on the section an entry point targets (dashboard "Ver todos" → achievements)', async () => {
    const { active } = await openAt('/profile?section=achievements');
    expect(active()).toBe('profile.sections.achievements');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById('profile-achievements'));
  });

  it('returns to "Cuenta" when the reused page is opened again without a target', async () => {
    const { harness, active } = await openAt('/profile?section=achievements');
    await harness.navigateByUrl('/profile');
    harness.detectChanges();
    expect(active()).toBe('profile.sections.account');
  });

  it('shows every section in the demo, but avatar, username and export never reach the API', () => {
    const { fixture, el, rows, userService, blockWrite } = setup(true);
    expect(rows()).toHaveLength(6);
    for (const id of ['account', 'achievements', 'preferences', 'data', 'delete']) {
      expect(el.querySelector(`#profile-${id}`)).not.toBeNull();
    }
    const profile = fixture.componentInstance as unknown as { setAvatar(a: string | null): void };
    profile.setAvatar('cat');
    fixture.componentInstance.submit();
    [...el.querySelectorAll('button')].find((b) => b.textContent!.trim() === 'profile.export.csv')!.click();
    expect(blockWrite).toHaveBeenCalledTimes(3);
    expect(userService.updateProfile).not.toHaveBeenCalled();
    expect(userService.exportData).not.toHaveBeenCalled();
  });

  it('opens the avatar picker from the account section, and closes it once the avatar is saved', () => {
    const { fixture, el, userService } = setup();
    expect(el.querySelector('#profile-avatar')).toBeNull();
    const row = el.querySelector<HTMLButtonElement>('#profile-account [data-avatar-row]')!;
    expect(row.textContent).toContain('profile.avatar.title');
    expect(row.querySelector('app-avatar')).not.toBeNull();
    expect(document.querySelector('app-avatar-picker')).toBeNull();

    row.click();
    fixture.detectChanges();
    expect(document.querySelector('app-modal-sheet app-avatar-picker')).not.toBeNull();

    (fixture.componentInstance as unknown as { setAvatar(a: string | null): void }).setAvatar('cat');
    fixture.detectChanges();
    expect(userService.updateProfile).toHaveBeenCalledWith({ avatar: 'cat' });
    expect(document.querySelector('app-avatar-picker')).toBeNull();
  });
});
