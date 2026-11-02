import { TestBed } from '@angular/core/testing';
import {
  USAGE_STATS_ENV,
  USAGE_TIME_ZONE,
  UsageStatsEnv,
  UsageStatsPlugin,
  UsageStatsService,
} from './usage-stats.service';

describe('UsageStatsService', () => {
  function setup(env: Partial<UsageStatsEnv> = {}) {
    const plugin: UsageStatsPlugin = {
      hasPermission: vi.fn(() => Promise.resolve({ value: true })),
      openPermissionSettings: vi.fn(() => Promise.resolve()),
      listLaunchableApps: vi.fn(() =>
        Promise.resolve({ apps: [{ packageName: 'com.example.game', label: 'Game', isGame: true }] }),
      ),
      getDailyUsage: vi.fn(() =>
        Promise.resolve({ days: [{ date: '2026-11-01', packageName: 'com.example.game', minutes: 42 }] }),
      ),
    };
    const fullEnv: UsageStatsEnv = {
      maybeAndroid: true,
      load: vi.fn(() => Promise.resolve({ plugin })),
      ...env,
    };
    TestBed.configureTestingModule({ providers: [{ provide: USAGE_STATS_ENV, useValue: fullEnv }] });
    return { service: TestBed.inject(UsageStatsService), plugin, env: fullEnv };
  }

  it('forwards every call to the plugin on Android', async () => {
    const { service, plugin } = setup();

    expect(await service.isAvailable()).toBe(true);
    expect(await service.hasPermission()).toBe(true);
    await service.openPermissionSettings();
    expect(plugin.openPermissionSettings).toHaveBeenCalled();
    expect(await service.listLaunchableApps()).toEqual([
      { packageName: 'com.example.game', label: 'Game', isGame: true },
    ]);
    expect(await service.getDailyUsage('2026-10-27', '2026-11-02', ['com.example.game'])).toEqual([
      { date: '2026-11-01', packageName: 'com.example.game', minutes: 42 },
    ]);
    expect(plugin.getDailyUsage).toHaveBeenCalledWith({
      from: '2026-10-27',
      to: '2026-11-02',
      packages: ['com.example.game'],
      timeZone: USAGE_TIME_ZONE,
    });
  });

  it('does nothing and never loads the plugin off Android', async () => {
    const { service, env } = setup({ maybeAndroid: false });

    expect(await service.isAvailable()).toBe(false);
    expect(await service.hasPermission()).toBe(false);
    await service.openPermissionSettings();
    expect(await service.listLaunchableApps()).toEqual([]);
    expect(await service.getDailyUsage('2026-10-27', '2026-11-02', ['com.example.game'])).toEqual([]);
    expect(env.load).not.toHaveBeenCalled();
  });

  it('does nothing when Capacitor is not on Android or the APK lacks the plugin', async () => {
    const { service } = setup({ load: vi.fn(() => Promise.resolve(null)) });

    expect(await service.isAvailable()).toBe(false);
    expect(await service.hasPermission()).toBe(false);
    expect(await service.listLaunchableApps()).toEqual([]);
  });

  it('asks no usage without packages', async () => {
    const { service, plugin } = setup();

    expect(await service.getDailyUsage('2026-10-27', '2026-11-02', [])).toEqual([]);
    expect(plugin.getDailyUsage).not.toHaveBeenCalled();
  });
});
