import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { ANDROID_APK_URL, AppPlatform, detectAppPlatform } from './android-app.service';
import { importWithRetry } from './native-oauth.service';
import {
  LATEST_RELEASE_API_URL,
  LatestRelease,
  UPDATE_SNOOZE_KEY,
  compareVersions,
  isSnoozed,
  parseLatestRelease,
  progressPercent,
  snoozeValue,
} from './apk-update.logic';

/** File name of the downloaded APK inside the app's cache directory. */
export const APK_DOWNLOAD_FILE = 'pytra-update.apk';

/** Local native plugin (android/.../ApkInstallerPlugin.java). */
export interface ApkInstallerPlugin {
  canInstall(): Promise<{ value: boolean }>;
  openInstallSettings(): Promise<void>;
  install(options: { path: string }): Promise<void>;
}

export type ApkUpdateState =
  | { step: 'idle' }
  | { step: 'available'; release: LatestRelease }
  | { step: 'downloading'; release: LatestRelease; percent: number }
  | { step: 'permission'; release: LatestRelease; path: string }
  | { step: 'installing'; release: LatestRelease; path: string }
  | { step: 'error'; release: LatestRelease };

/** What the service needs from the platform; a token so tests can swap it. */
export interface ApkUpdateEnv {
  platform: AppPlatform;
  /** Parsed JSON of the GitHub "latest release" endpoint. */
  fetchLatestRelease: () => Promise<unknown>;
  loadApp: () => Promise<typeof import('@capacitor/app')>;
  loadFilesystem: () => Promise<typeof import('@capacitor/filesystem')>;
  /**
   * The native installer plugin, or null when this APK does not ship it. Wrapped in an object on
   * purpose: a Capacitor plugin proxy answers any property, including `then`, so resolving a promise
   * with the bare plugin awaits a native `then` that never settles (the update would hang).
   */
  loadInstaller: () => Promise<InstallerRef | null>;
  readSnooze: () => string | null;
  writeSnooze: (value: string) => void;
  now: () => Date;
}

/** Holder for the installer plugin proxy, so it is never the resolved value of a promise. */
export interface InstallerRef {
  plugin: ApkInstallerPlugin;
}

let installer: Promise<InstallerRef | null> | undefined;

export const APK_UPDATE_ENV = new InjectionToken<ApkUpdateEnv>('APK_UPDATE_ENV', {
  providedIn: 'root',
  factory: () => ({
    platform: detectAppPlatform(),
    fetchLatestRelease: async () => {
      const response = await fetch(LATEST_RELEASE_API_URL, { headers: { Accept: 'application/vnd.github+json' } });
      if (!response.ok) {
        throw new Error(`GitHub releases: HTTP ${response.status}`);
      }
      return response.json();
    },
    loadApp: () => import('@capacitor/app'),
    loadFilesystem: () => import('@capacitor/filesystem'),
    // Registered once: registerPlugin returns a proxy even when the native side is missing.
    loadInstaller: () =>
      (installer ??= import('@capacitor/core').then(
        ({ Capacitor, registerPlugin }) =>
          Capacitor.isPluginAvailable('ApkInstaller')
            ? { plugin: registerPlugin<ApkInstallerPlugin>('ApkInstaller') }
            : null,
        (error: unknown) => {
          installer = undefined;
          throw error;
        },
      )),
    readSnooze: () => {
      try {
        return localStorage.getItem(UPDATE_SNOOZE_KEY);
      } catch {
        return null;
      }
    },
    writeSnooze: (value) => {
      try {
        localStorage.setItem(UPDATE_SNOOZE_KEY, value);
      } catch {
        // Storage blocked: the prompt simply shows again next launch.
      }
    },
    now: () => new Date(),
  }),
});

/**
 * In-app updater for the Android shell (never on the web or iOS). Once per launch it compares the
 * installed version with the latest GitHub release and offers the update; "Update" downloads the
 * APK into the cache directory (with progress) and hands it to the Android package installer
 * through the local ApkInstaller plugin. Loaded lazily, so none of it ships in the initial bundle.
 */
@Injectable({ providedIn: 'root' })
export class ApkUpdateService {
  private readonly env = inject(APK_UPDATE_ENV);
  private readonly current = signal<ApkUpdateState>({ step: 'idle' });
  private checked = false;

  readonly state = this.current.asReadonly();

  /** Launch check: silent on any failure (offline, rate limit) and run only once per app launch. */
  async checkOnLaunch(): Promise<void> {
    if (this.env.platform !== 'android' || this.checked) {
      return;
    }
    this.checked = true;
    try {
      const release = await this.newerRelease();
      if (release && !isSnoozed(this.env.readSnooze(), release.version, this.env.now()) && this.current().step === 'idle') {
        this.current.set({ step: 'available', release });
      }
    } catch {
      // Silent: the check runs again on the next launch.
    }
  }

  /** "Later": hide the prompt and keep it hidden for this version until tomorrow. */
  later(): void {
    const state = this.current();
    if (state.step !== 'idle') {
      this.env.writeSnooze(snoozeValue(state.release.version, this.env.now()));
    }
    this.current.set({ step: 'idle' });
  }

  dismiss(): void {
    this.current.set({ step: 'idle' });
  }

  /**
   * Downloads and installs the latest APK. Resolves false when the native installer is missing
   * (callers then fall back to the browser download); otherwise true, with progress in `state`.
   */
  async update(): Promise<boolean> {
    if (this.env.platform !== 'android' || !(await this.installer())) {
      return false;
    }
    const state = this.current();
    if (state.step === 'downloading') {
      return true;
    }
    const release = state.step === 'idle' ? await this.latestOrFallback() : state.release;
    void this.download(release);
    return true;
  }

  /** Retry button: download again after an error, or reopen the installer with the file at hand. */
  async retry(): Promise<void> {
    const state = this.current();
    if (state.step === 'permission' || state.step === 'installing') {
      await this.install(state.release, state.path);
    } else if (state.step === 'error') {
      await this.download(state.release);
    }
  }

  /** Opens Android's "Install unknown apps" screen for Pytra. */
  async openInstallSettings(): Promise<void> {
    try {
      await (await this.installer())?.plugin.openInstallSettings();
    } catch (error) {
      console.error('Opening the install settings failed', error);
    }
  }

  private async newerRelease(): Promise<LatestRelease | null> {
    const release = parseLatestRelease(await this.env.fetchLatestRelease());
    if (!release) {
      return null;
    }
    const { App } = await importWithRetry(this.env.loadApp, '@capacitor/app');
    const { version } = await App.getInfo();
    return compareVersions(release.version, version) > 0 ? release : null;
  }

  /** From the settings entry the version check may not have run (or failed): ask again. */
  private async latestOrFallback(): Promise<LatestRelease> {
    try {
      const release = parseLatestRelease(await this.env.fetchLatestRelease());
      if (release) {
        return release;
      }
    } catch {
      // Fall through: the stable "latest/download" URL works without the API.
    }
    return { version: '', apkUrl: ANDROID_APK_URL };
  }

  private async download(release: LatestRelease): Promise<void> {
    this.current.set({ step: 'downloading', release, percent: 0 });
    let listener: { remove: () => Promise<void> } | undefined;
    try {
      const { Filesystem, Directory } = await importWithRetry(this.env.loadFilesystem, '@capacitor/filesystem');
      listener = await Filesystem.addListener('progress', ({ bytes, contentLength }) => {
        if (this.current().step === 'downloading') {
          this.current.set({ step: 'downloading', release, percent: progressPercent(bytes, contentLength) });
        }
      });
      const { path } = await Filesystem.downloadFile({
        url: release.apkUrl,
        path: APK_DOWNLOAD_FILE,
        directory: Directory.Cache,
        progress: true,
      });
      if (!path) {
        throw new Error('Download finished without a file path');
      }
      await this.install(release, path);
    } catch (error) {
      console.error('APK update download failed', error);
      this.current.set({ step: 'error', release });
    } finally {
      void listener?.remove();
    }
  }

  /** Hands the APK to the system installer, or asks for the "unknown apps" permission first. */
  private async install(release: LatestRelease, path: string): Promise<void> {
    const plugin = (await this.installer())?.plugin;
    if (!plugin) {
      this.current.set({ step: 'error', release });
      return;
    }
    try {
      if (!(await plugin.canInstall()).value) {
        this.current.set({ step: 'permission', release, path });
        return;
      }
      await plugin.install({ path });
      this.current.set({ step: 'installing', release, path });
    } catch (error) {
      console.error('Starting the APK installer failed', error);
      this.current.set({ step: 'error', release });
    }
  }

  /** Resolves the wrapper, never the bare proxy (see `loadInstaller`). */
  private async installer(): Promise<InstallerRef | null> {
    try {
      return await this.env.loadInstaller();
    } catch {
      return null;
    }
  }
}
