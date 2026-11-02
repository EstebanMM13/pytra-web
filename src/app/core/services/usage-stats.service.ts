import { Injectable, InjectionToken, inject } from '@angular/core';
import { detectAppPlatform } from './android-app.service';

/** The users' zone: usage days are cut at its midnights, like the API (`app.time-zone`). */
export const USAGE_TIME_ZONE = 'Europe/Madrid';

/** An installed app with a launcher icon. */
export interface LaunchableApp {
  packageName: string;
  label: string;
  /** The app declares itself a game (Android category / flag): listed first. */
  isGame: boolean;
}

/** Foreground minutes of one package on one local day (`yyyy-MM-dd`). */
export interface DailyUsage {
  date: string;
  packageName: string;
  minutes: number;
}

/** Local native plugin (android/.../UsageStatsPlugin.java). */
export interface UsageStatsPlugin {
  hasPermission(): Promise<{ value: boolean }>;
  openPermissionSettings(): Promise<void>;
  listLaunchableApps(): Promise<{ apps: LaunchableApp[] }>;
  getDailyUsage(options: {
    from: string;
    to: string;
    packages: string[];
    timeZone?: string;
  }): Promise<{ days: DailyUsage[] }>;
}

/** Holder for the plugin proxy, so it is never the resolved value of a promise (see ApkUpdateEnv). */
export interface UsageStatsRef {
  plugin: UsageStatsPlugin;
}

/** What the wrapper needs from the platform; a token so tests can swap it. */
export interface UsageStatsEnv {
  /** Cheap pre-check (no `@capacitor/core` import) so the web never loads the plugin code. */
  maybeAndroid: boolean;
  /** The plugin, or null when not on Android (`Capacitor.getPlatform()`) or this APK does not ship it. */
  load: () => Promise<UsageStatsRef | null>;
}

let plugin: Promise<UsageStatsRef | null> | undefined;

export const USAGE_STATS_ENV = new InjectionToken<UsageStatsEnv>('USAGE_STATS_ENV', {
  providedIn: 'root',
  factory: () => ({
    maybeAndroid: detectAppPlatform() === 'android',
    // Registered once: registerPlugin returns a proxy even when the native side is missing.
    load: () =>
      (plugin ??= import('@capacitor/core').then(
        ({ Capacitor, registerPlugin }) =>
          Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('UsageStats')
            ? { plugin: registerPlugin<UsageStatsPlugin>('UsageStats') }
            : null,
        (error: unknown) => {
          plugin = undefined;
          throw error;
        },
      )),
  }),
});

/**
 * App usage of the Android shell (UsageStatsManager through the local UsageStats plugin). Does nothing
 * anywhere else: on the web, iOS or an older APK without the plugin every call answers "nothing"
 * (no permission, no apps, no usage) and never throws for that reason.
 */
@Injectable({ providedIn: 'root' })
export class UsageStatsService {
  private readonly env = inject(USAGE_STATS_ENV);

  /** True when the plugin is there (Android app with UsageStats). */
  async isAvailable(): Promise<boolean> {
    return (await this.plugin()) !== null;
  }

  async hasPermission(): Promise<boolean> {
    const ref = await this.plugin();
    return ref ? (await ref.plugin.hasPermission()).value : false;
  }

  async openPermissionSettings(): Promise<void> {
    const ref = await this.plugin();
    await ref?.plugin.openPermissionSettings();
  }

  async listLaunchableApps(): Promise<LaunchableApp[]> {
    const ref = await this.plugin();
    return ref ? (await ref.plugin.listLaunchableApps()).apps : [];
  }

  /** Daily minutes of `packages` from `from` to `to` (`yyyy-MM-dd`, inclusive), days in USAGE_TIME_ZONE. */
  async getDailyUsage(from: string, to: string, packages: string[]): Promise<DailyUsage[]> {
    if (packages.length === 0) return [];
    const ref = await this.plugin();
    if (!ref) return [];
    return (await ref.plugin.getDailyUsage({ from, to, packages, timeZone: USAGE_TIME_ZONE })).days;
  }

  private async plugin(): Promise<UsageStatsRef | null> {
    if (!this.env.maybeAndroid) return null;
    return this.env.load();
  }
}
