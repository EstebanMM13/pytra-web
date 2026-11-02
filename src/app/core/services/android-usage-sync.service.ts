import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AndroidUsageService, AndroidUsageSyncResult } from './android-usage.service';
import { AuthService } from './auth.service';
import { USAGE_TIME_ZONE, UsageStatsService } from './usage-stats.service';

/** Automatic syncs run at most this often (on launch and when the app comes back to the foreground). */
export const AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000;
/** Days sent on each sync, today included (Android keeps about 7-10 days of usage events). */
export const SYNC_DAYS = 7;
/** localStorage key of the last successful sync (epoch ms). */
export const LAST_SYNC_KEY = 'pytra.androidUsage.lastSyncAt';

/** `yyyy-MM-dd` of `now` in `timeZone`. */
export function localDay(now: Date, timeZone: string): string {
  // en-CA formats dates as yyyy-MM-dd.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    now,
  );
}

/** The `days` local days ending today in `timeZone`: `{from, to}` as `yyyy-MM-dd`, both included. */
export function syncWindow(now: Date, timeZone: string, days = SYNC_DAYS): { from: string; to: string } {
  const to = localDay(now, timeZone);
  const [year, month, day] = to.split('-').map(Number);
  const from = new Date(Date.UTC(year, month - 1, day - (days - 1))).toISOString().slice(0, 10);
  return { from, to };
}

/** True when no sync ran in the last AUTO_SYNC_INTERVAL_MS (or the stored time is from the future). */
export function isAutoSyncDue(lastAt: number | null, now: number): boolean {
  return lastAt === null || now - lastAt >= AUTO_SYNC_INTERVAL_MS || lastAt > now;
}

/** The app lifecycle event the auto sync listens to (a subset of @capacitor/app, so tests can fake it). */
export interface AppStatePort {
  addListener(event: 'appStateChange', listener: (state: { isActive: boolean }) => void): Promise<unknown>;
}

export interface AndroidUsageSyncEnv {
  /** Wrapped in an object: a Capacitor plugin proxy must never be the resolved value of a promise. */
  loadApp: () => Promise<{ app: AppStatePort }>;
  readLastSync: () => number | null;
  writeLastSync: (epochMs: number) => void;
  now: () => Date;
}

export const ANDROID_USAGE_SYNC_ENV = new InjectionToken<AndroidUsageSyncEnv>('ANDROID_USAGE_SYNC_ENV', {
  providedIn: 'root',
  factory: () => ({
    loadApp: () => import('@capacitor/app').then(({ App }) => ({ app: App as unknown as AppStatePort })),
    readLastSync: () => {
      try {
        const value = Number(localStorage.getItem(LAST_SYNC_KEY));
        return Number.isFinite(value) && value > 0 ? value : null;
      } catch {
        return null;
      }
    },
    writeLastSync: (epochMs) => {
      try {
        localStorage.setItem(LAST_SYNC_KEY, String(epochMs));
      } catch {
        // Storage blocked: the next launch simply syncs again.
      }
    },
    now: () => new Date(),
  }),
});

/**
 * Sends the Android usage of the linked apps (last SYNC_DAYS days, whole daily totals) to the API, which
 * adds only what is new. Automatic on launch and on every return to the foreground, at most once every
 * AUTO_SYNC_INTERVAL_MS; "Sync now" bypasses that limit. Skipped silently when signed out, without the
 * plugin or the usage permission, or with no linked app.
 */
@Injectable({ providedIn: 'root' })
export class AndroidUsageSyncService {
  private readonly env = inject(ANDROID_USAGE_SYNC_ENV);
  private readonly usageStats = inject(UsageStatsService);
  private readonly api = inject(AndroidUsageService);
  private readonly auth = inject(AuthService);

  /** Last successful sync. */
  readonly lastSyncAt = signal<Date | null>(this.storedLastSync());
  readonly syncing = signal(false);
  /** Bumped each time the app returns to the foreground (e.g. from the usage access settings). */
  readonly resumed = signal(0);

  private listening = false;
  /** Last automatic attempt, successful or not: a failing API is not retried on every resume. */
  private lastAttemptAt: number | null = null;
  private running: Promise<AndroidUsageSyncResult | null> | null = null;

  /** Starts the automatic sync (idempotent). */
  async init(): Promise<void> {
    if (!this.listening && (await this.usageStats.isAvailable())) {
      this.listening = true;
      const { app } = await this.env.loadApp();
      await app.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) return;
        this.resumed.update((count) => count + 1);
        void this.syncIfDue();
      });
    }
    await this.syncIfDue();
  }

  /** Automatic sync, throttled. Never throws. */
  async syncIfDue(): Promise<AndroidUsageSyncResult | null> {
    const now = this.env.now().getTime();
    const last = Math.max(this.lastSyncAt()?.getTime() ?? 0, this.lastAttemptAt ?? 0) || null;
    if (!isAutoSyncDue(last, now)) return null;
    this.lastAttemptAt = now;
    try {
      return await this.syncNow();
    } catch (error: unknown) {
      console.warn('Android usage sync failed', error);
      return null;
    }
  }

  /** Syncs now (no throttle). Null when there was nothing to do; rejects when the upload fails. */
  syncNow(): Promise<AndroidUsageSyncResult | null> {
    this.running ??= this.run().finally(() => {
      this.running = null;
      this.syncing.set(false);
    });
    return this.running;
  }

  private async run(): Promise<AndroidUsageSyncResult | null> {
    if (!this.auth.isAuthenticated()) return null;
    if (!(await this.usageStats.hasPermission())) return null;
    this.syncing.set(true);
    const links = await firstValueFrom(this.api.getLinks());
    if (links.length === 0) return null;
    const startedAt = this.env.now();
    const { from, to } = syncWindow(startedAt, USAGE_TIME_ZONE);
    const days = await this.usageStats.getDailyUsage(
      from,
      to,
      links.map((link) => link.packageName),
    );
    const result = await firstValueFrom(this.api.sync(days));
    this.env.writeLastSync(startedAt.getTime());
    this.lastSyncAt.set(startedAt);
    return result;
  }

  private storedLastSync(): Date | null {
    const stored = this.env.readLastSync();
    return stored === null ? null : new Date(stored);
  }
}
