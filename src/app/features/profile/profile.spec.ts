import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
import { SteamService } from '../../core/services/steam.service';
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
  function setup(demo = false) {
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
        provideRouter([]),
        provideTranslateService(),
        { provide: UserService, useValue: userService },
        { provide: AuthService, useValue: { isDemo: signal(demo), logout: vi.fn() } },
        { provide: DemoModeService, useValue: { isDemo: signal(demo), blockWrite } },
        { provide: SteamService, useValue: { getStatus: () => of({ linked: true }) } },
        { provide: GameService, useValue: { findAll: () => of([]) } },
        { provide: SagaService, useValue: { findAll: () => of([]) } },
        { provide: StatsService, useValue: { getSummary: () => of(null), getByYear: () => of([]) } },
        { provide: PlatformService, useValue: { platforms: signal([]), load: () => of([]) } },
        { provide: FileExportService, useValue: { save: vi.fn() } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(Profile, { remove: { imports: [Navbar] }, add: { imports: [NavbarStub] } });
    const fixture = TestBed.createComponent(Profile);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const rows = () => [...el.querySelectorAll<HTMLElement>('[data-profile-rows] > a, [data-profile-rows] > button')];
    return { fixture, el, rows, userService, blockWrite };
  }

  const scrollIntoView = vi.fn();
  beforeEach(() => {
    scrollIntoView.mockClear();
    Element.prototype.scrollIntoView = scrollIntoView;
  });
  afterEach(() => TestBed.resetTestingModule());

  it('lists every section as a tappable row, each scrolling to its section (Steam opens its page)', () => {
    const { el, rows } = setup();
    expect(rows().map((r) => r.textContent!.replace(/\s+/g, ' ').trim())).toEqual([
      'profile.sections.account',
      'profile.sections.avatar',
      'profile.sections.achievements',
      'profile.sections.preferences',
      'nav.steam profile.steamLinked',
      'profile.exportData',
      'profile.delete.label',
    ]);
    expect(rows()[4].getAttribute('href')).toBe('/steam');

    for (const [index, anchor] of [
      [0, 'account'],
      [1, 'avatar'],
      [2, 'achievements'],
      [3, 'preferences'],
      [5, 'data'],
      [6, 'delete'],
    ] as const) {
      const target = el.querySelector(`#profile-${anchor}`);
      expect(target).not.toBeNull();
      scrollIntoView.mockClear();
      rows()[index].click();
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.contexts[0]).toBe(target);
    }
  });

  it('shows every section in the demo, but avatar, username and export never reach the API', () => {
    const { fixture, el, rows, userService, blockWrite } = setup(true);
    expect(rows()).toHaveLength(7);
    for (const id of ['account', 'avatar', 'achievements', 'preferences', 'data', 'delete']) {
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
});
