import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { Game } from '../../../core/models/game.model';
import { AndroidUsageService } from '../../../core/services/android-usage.service';
import { AndroidUsageSyncService } from '../../../core/services/android-usage-sync.service';
import { DemoModeService } from '../../../core/services/demo-mode.service';
import { GameService } from '../../../core/services/game.service';
import { LaunchableApp, UsageStatsService } from '../../../core/services/usage-stats.service';
import { ToastService } from '../../../shared/toast/toast.service';
import { AndroidPanel, visibleApps } from './android-panel';

const GAME_APP: LaunchableApp = { packageName: 'com.example.game', label: 'Zeta Game', isGame: true };
const CHAT_APP: LaunchableApp = { packageName: 'com.example.chat', label: 'Chat', isGame: false };
const OTHER_GAME: LaunchableApp = { packageName: 'com.example.alpha', label: 'Alpha', isGame: true };

describe('visibleApps', () => {
  it('lists games first by label and hides other apps unless linked or "show all"', () => {
    const apps = [GAME_APP, CHAT_APP, OTHER_GAME];

    expect(visibleApps(apps, new Map(), false).map((app) => app.packageName)).toEqual([
      'com.example.alpha',
      'com.example.game',
    ]);
    expect(visibleApps(apps, new Map([['com.example.chat', 3]]), false).map((app) => app.gameId)).toEqual([
      null,
      null,
      3,
    ]);
    expect(visibleApps(apps, new Map(), true)).toHaveLength(3);
  });
});

describe('AndroidPanel', () => {
  function setup(options: { available?: boolean; permission?: boolean } = {}) {
    const usageStats = {
      isAvailable: vi.fn(() => Promise.resolve(options.available ?? true)),
      hasPermission: vi.fn(() => Promise.resolve(options.permission ?? true)),
      openPermissionSettings: vi.fn(() => Promise.resolve()),
      listLaunchableApps: vi.fn(() => Promise.resolve([GAME_APP, CHAT_APP])),
      getDailyUsage: vi.fn(() =>
        Promise.resolve([
          { date: '2026-11-01', packageName: 'com.example.game', minutes: 90 },
          { date: '2026-11-02', packageName: 'com.example.game', minutes: 30 },
        ]),
      ),
    };
    const api = {
      getLinks: vi.fn(() => of([{ packageName: 'com.example.game', gameId: 1 }])),
      link: vi.fn((packageName: string, gameId: number) => of({ packageName, gameId })),
      unlink: vi.fn(() => of(undefined)),
      reset: vi.fn(() => of({ links: 1, minutesRemoved: 1440 })),
    };
    const syncService = {
      lastSyncAt: signal<Date | null>(null),
      syncing: signal(false),
      resumed: signal(0),
      syncNow: vi.fn(() => Promise.resolve({ recorded: 2, ignored: 1 })),
    };
    const games = [{ id: 1, name: 'Zeta' } as Game, { id: 2, name: 'Alpha' } as Game];
    const toast = { success: vi.fn(), show: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [AndroidPanel],
      providers: [
        provideTranslateService(),
        { provide: UsageStatsService, useValue: usageStats },
        { provide: AndroidUsageService, useValue: api },
        { provide: AndroidUsageSyncService, useValue: syncService },
        { provide: GameService, useValue: { findAll: () => of(games) } },
        { provide: DemoModeService, useValue: { blockWrite: () => false } },
        { provide: ToastService, useValue: toast },
      ],
    });
    const fixture = TestBed.createComponent(AndroidPanel);
    return { fixture, panel: fixture.componentInstance, usageStats, api, syncService, toast };
  }

  async function render(fixture: ReturnType<typeof setup>['fixture']) {
    await fixture.componentInstance.load();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('renders nothing off Android', async () => {
    const { fixture, usageStats } = setup({ available: false });
    await render(fixture);

    expect(fixture.nativeElement.textContent.trim()).toBe('');
    expect(usageStats.listLaunchableApps).not.toHaveBeenCalled();
  });

  it('asks for the usage permission and opens the settings', async () => {
    const { fixture, usageStats } = setup({ permission: false });
    await render(fixture);

    (fixture.nativeElement.querySelector('[data-grant-permission]') as HTMLButtonElement).click();

    expect(usageStats.openPermissionSettings).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-sync-now]')).toBeNull();
  });

  it('lists the apps with their linked game and syncs on demand', async () => {
    const { fixture, panel, syncService, toast } = setup();
    await render(fixture);

    const rows = fixture.nativeElement.querySelectorAll('[data-app]');
    expect(rows).toHaveLength(1);
    // The picker shows the linked game's name.
    expect((rows[0].querySelector('input') as HTMLInputElement).value).toBe('Zeta');

    await panel.syncNow();
    expect(syncService.syncNow).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows the minutes the phone reports for each linked app over the last 7 days', async () => {
    const { fixture, panel, usageStats } = setup();
    await render(fixture);
    await panel.loadUsage();
    fixture.detectChanges();

    expect(usageStats.getDailyUsage).toHaveBeenCalledWith(expect.any(String), expect.any(String), ['com.example.game']);
    expect(panel.weekMinutes().get('com.example.game')).toBe(120);
    expect(fixture.nativeElement.querySelector('[data-week-usage]')).not.toBeNull();
  });

  it('redoes the import after a confirmation: reset, then a fresh sync', async () => {
    const { fixture, panel, api, syncService, toast } = setup();
    await render(fixture);

    (fixture.nativeElement.querySelector('[data-reset]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(api.reset).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-reset-confirm]')).not.toBeNull();

    await panel.resetAndResync();

    expect(api.reset).toHaveBeenCalled();
    expect(syncService.syncNow).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
    expect(panel.resetting()).toBe(false);
  });

  it('moves a link to another game and unlinks with the empty choice', async () => {
    const { fixture, panel, api } = setup();
    await render(fixture);

    await panel.changeLink('com.example.game', 2);
    expect(api.unlink).toHaveBeenCalledWith('com.example.game');
    expect(api.link).toHaveBeenCalledWith('com.example.game', 2);
    expect(panel.links().get('com.example.game')).toBe(2);

    await panel.changeLink('com.example.game', null);
    expect(panel.links().has('com.example.game')).toBe(false);
  });

  it('explains a game already linked to another app and restores the server state', async () => {
    const { fixture, panel, api } = setup();
    await render(fixture);
    api.link.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));

    await panel.changeLink('com.example.chat', 1);

    expect(panel.errorKey()).toBe('androidUsage.errors.gameTaken');
    expect(panel.links()).toEqual(new Map([['com.example.game', 1]]));
  });

  it('re-checks the permission when the app comes back to the foreground', async () => {
    const { fixture, usageStats, syncService } = setup({ permission: false });
    await render(fixture);
    usageStats.hasPermission.mockResolvedValue(true);

    syncService.resumed.set(1);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.hasPermission()).toBe(true);
  });
});
