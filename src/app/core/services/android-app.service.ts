import { Injectable, InjectionToken, Injector, inject } from '@angular/core';
import { isNativePlatform } from '../native-platform';
import { importWithRetry } from './native-oauth.service';

/** Always the newest release asset: GitHub redirects `latest/download/<name>` to it. */
export const ANDROID_APK_URL = 'https://github.com/EstebanMM13/pytra-web/releases/latest/download/pytra.apk';

export type AppPlatform = 'android' | 'ios' | 'web';

/** Where the page runs: the native shell (Android / iOS bridge) or a browser. */
export function detectAppPlatform(win: unknown = globalThis): AppPlatform {
  if (isNativePlatform(win)) {
    const w = win as { androidBridge?: unknown; CapacitorCustomPlatform?: { name?: string } | null };
    if (w.CapacitorCustomPlatform?.name) {
      return w.CapacitorCustomPlatform.name === 'android' ? 'android' : 'ios';
    }
    return w.androidBridge ? 'android' : 'ios';
  }
  return 'web';
}

/** iPhone / iPad browsers (iPadOS 13+ reports as Mac; touch points tell it apart). */
export function isIosUserAgent(userAgent: string, maxTouchPoints = 0): boolean {
  return /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** What the service needs from the platform; a token so tests can swap it. */
export interface AndroidAppPlatform {
  platform: AppPlatform;
  iosBrowser: boolean;
  loadBrowser: () => Promise<typeof import('@capacitor/browser')>;
  openWindow: (url: string) => void;
  /** In-app download + install (lazy ApkUpdateService); false when the native installer is missing. */
  startInAppUpdate: () => Promise<boolean>;
}

export const ANDROID_APP_PLATFORM = new InjectionToken<AndroidAppPlatform>('ANDROID_APP_PLATFORM', {
  providedIn: 'root',
  factory: () => {
    const injector = inject(Injector);
    return {
      platform: detectAppPlatform(),
      iosBrowser:
        typeof navigator !== 'undefined' && isIosUserAgent(navigator.userAgent, navigator.maxTouchPoints ?? 0),
      loadBrowser: () => import('@capacitor/browser'),
      openWindow: (url) => {
        window.open(url, '_system');
      },
      startInAppUpdate: () =>
        importWithRetry(() => import('./apk-update.service'), 'apk-update').then(({ ApkUpdateService }) =>
          injector.get(ApkUpdateService).update(),
        ),
    };
  },
});

/**
 * "Download / Update Android app" entry in the settings: links to the latest signed APK on GitHub
 * Releases. Hidden on iOS (native shell or iPhone/iPad browsers), where an APK is useless.
 */
@Injectable({ providedIn: 'root' })
export class AndroidAppService {
  private readonly platform = inject(ANDROID_APP_PLATFORM);

  readonly url = ANDROID_APK_URL;
  readonly available = this.platform.platform !== 'ios' && !this.platform.iosBrowser;
  /** Inside the Android app the entry updates it; elsewhere it downloads it. */
  readonly labelKey = this.platform.platform === 'android' ? 'profile.updateAndroidApp' : 'profile.downloadAndroidApp';

  /**
   * Click handler for the APK link. On the web the anchor navigates by itself. In the Android shell
   * the APK is downloaded and installed in-app (ApkUpdateService); the system browser (Custom Tab)
   * is only the last resort, when this build lacks the native installer plugin.
   */
  async open(event?: Event): Promise<void> {
    if (this.platform.platform === 'web') {
      return;
    }
    event?.preventDefault();
    try {
      if (this.platform.platform === 'android' && (await this.platform.startInAppUpdate())) {
        return;
      }
    } catch (error) {
      console.error('In-app update unavailable', error);
    }
    try {
      const { Browser } = await importWithRetry(this.platform.loadBrowser, '@capacitor/browser');
      await Browser.open({ url: this.url });
    } catch {
      this.platform.openWindow(this.url);
    }
  }
}
