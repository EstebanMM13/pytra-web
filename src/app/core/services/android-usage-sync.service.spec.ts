import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AndroidUsageService } from './android-usage.service';
import {
  ANDROID_USAGE_SYNC_ENV,
  AUTO_SYNC_INTERVAL_MS,
  AndroidUsageSyncEnv,
  AndroidUsageSyncService,
  isAutoSyncDue,
  localDay,
  syncWindow,
} from './android-usage-sync.service';
import { AuthService } from './auth.service';
import { UsageStatsService } from './usage-stats.service';

const PACKAGE = 'com.example.game';
/** 2026-11-02 09:00 UTC = 10:00 in Madrid. */
const NOW = new Date('2026-11-02T09:00:00Z');
const DAYS = [{ date: '2026-11-02', packageName: PACKAGE, minutes: 30 }];

describe('android usage sync helpers', () => {
  it('cuts days in the users zone', () => {
    // 23:30 UTC is already the next day in Madrid.
    expect(localDay(new Date('2026-11-02T23:30:00Z'), 'Europe/Madrid')).toBe('2026-11-03');
    expect(localDay(NOW, 'Europe/Madrid')).toBe('2026-11-02');
  });

  it('sends the last 7 days, today included, across a month change', () => {
    expect(syncWindow(NOW, 'Europe/Madrid')).toEqual({ from: '2026-10-27', to: '2026-11-02' });
  });

  it('is due without a previous sync, after 30 minutes, or with a clock gone back', () => {
    const now = NOW.getTime();
    expect(isAutoSyncDue(null, now)).toBe(true);
    expect(isAutoSyncDue(now - AUTO_SYNC_INTERVAL_MS + 1, now)).toBe(false);
    expect(isAutoSyncDue(now - AUTO_SYNC_INTERVAL_MS, now)).toBe(true);
    expect(isAutoSyncDue(now + 60_000, now)).toBe(true);
  });
});

describe('AndroidUsageSyncService', () => {
  function setup(options: { lastSync?: number | null; authenticated?: boolean; permission?: boolean } = {}) {
    let clock = NOW;
    let stored = options.lastSync ?? null;
    let resumeListener: ((state: { isActive: boolean }) => void) | undefined;
    const app = {
      addListener: vi.fn((_event: 'appStateChange', listener: (state: { isActive: boolean }) => void) => {
        resumeListener = listener;
        return Promise.resolve({});
      }),
    };
    const env: AndroidUsageSyncEnv = {
      loadApp: vi.fn(() => Promise.resolve({ app })),
      readLastSync: () => stored,
      writeLastSync: vi.fn((value: number) => {
        stored = value;
      }),
      now: () => clock,
    };
    const usageStats = {
      isAvailable: vi.fn(() => Promise.resolve(true)),
      hasPermission: vi.fn(() => Promise.resolve(options.permission ?? true)),
      getDailyUsage: vi.fn(() => Promise.resolve(DAYS)),
    };
    const api = {
      getLinks: vi.fn(() => of([{ packageName: PACKAGE, gameId: 7 }])),
      sync: vi.fn(() => of({ recorded: 1, ignored: 0 })),
    };
    const auth = { isAuthenticated: signal(options.authenticated ?? true) };
    TestBed.configureTestingModule({
      providers: [
        { provide: ANDROID_USAGE_SYNC_ENV, useValue: env },
        { provide: UsageStatsService, useValue: usageStats },
        { provide: AndroidUsageService, useValue: api },
        { provide: AuthService, useValue: auth },
      ],
    });
    return {
      service: TestBed.inject(AndroidUsageSyncService),
      env,
      api,
      usageStats,
      app,
      advance: (ms: number) => (clock = new Date(clock.getTime() + ms)),
      resume: () => resumeListener?.({ isActive: true }),
    };
  }

  /** Lets the fire-and-forget sync started by a resume settle. */
  const flush = () => new Promise((resolve) => setTimeout(resolve));

  it('syncs the linked packages of the last 7 days on launch and remembers when', async () => {
    const { service, env, api, usageStats } = setup();

    await service.init();

    expect(usageStats.getDailyUsage).toHaveBeenCalledWith('2026-10-27', '2026-11-02', [PACKAGE]);
    expect(api.sync).toHaveBeenCalledWith(DAYS);
    expect(env.writeLastSync).toHaveBeenCalledWith(NOW.getTime());
    expect(service.lastSyncAt()).toEqual(NOW);
  });

  it('syncs again on a return to the foreground only after 30 minutes', async () => {
    const { service, api, advance, resume } = setup();
    await service.init();

    advance(AUTO_SYNC_INTERVAL_MS - 1000);
    resume();
    await flush();
    expect(api.sync).toHaveBeenCalledTimes(1);
    expect(service.resumed()).toBe(1);

    advance(1000);
    resume();
    await flush();
    expect(api.sync).toHaveBeenCalledTimes(2);
  });

  it('skips the launch sync when the stored one is recent, but "sync now" ignores the limit', async () => {
    const { service, api } = setup({ lastSync: NOW.getTime() - 60_000 });

    await service.init();
    expect(api.sync).not.toHaveBeenCalled();

    expect(await service.syncNow()).toEqual({ recorded: 1, ignored: 0 });
    expect(api.sync).toHaveBeenCalledTimes(1);
  });

  it('does not retry a failed automatic sync on every resume', async () => {
    const { service, api, advance, resume } = setup();
    api.sync.mockReturnValue(throwError(() => new Error('offline')));

    expect(await service.syncIfDue()).toBeNull();
    advance(60_000);
    resume();
    await flush();

    expect(api.sync).toHaveBeenCalledTimes(1);
    expect(service.lastSyncAt()).toBeNull();
  });

  it('does nothing signed out, without permission or without linked apps', async () => {
    const signedOut = setup({ authenticated: false });
    expect(await signedOut.service.syncNow()).toBeNull();
    expect(signedOut.api.getLinks).not.toHaveBeenCalled();
    TestBed.resetTestingModule();

    const noPermission = setup({ permission: false });
    expect(await noPermission.service.syncNow()).toBeNull();
    expect(noPermission.api.sync).not.toHaveBeenCalled();
    TestBed.resetTestingModule();

    const noLinks = setup();
    noLinks.api.getLinks.mockReturnValue(of([]));
    expect(await noLinks.service.syncNow()).toBeNull();
    expect(noLinks.usageStats.getDailyUsage).not.toHaveBeenCalled();
    expect(noLinks.service.syncing()).toBe(false);
  });

  it('runs one sync at a time', async () => {
    const { service, api } = setup();

    const [first, second] = await Promise.all([service.syncNow(), service.syncNow()]);

    expect(first).toEqual(second);
    expect(api.sync).toHaveBeenCalledTimes(1);
  });

  it('registers the foreground listener once', async () => {
    const { service, app } = setup({ lastSync: NOW.getTime() });

    await service.init();
    await service.init();

    expect(app.addListener).toHaveBeenCalledTimes(1);
  });
});
