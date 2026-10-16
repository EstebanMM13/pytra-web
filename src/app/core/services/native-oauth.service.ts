import { Injectable, InjectionToken, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
import { isNativePlatform } from '../native-platform';

/** Custom-scheme callback the API redirects to when a login/link flow was started from the app. */
const NATIVE_CALLBACK_PROTOCOL = 'com.estebanmm13.pytra:';
const NATIVE_CALLBACK_HOST = 'oauth-callback';

/** Query param that tells the API the flow was started from the Android app. */
export const NATIVE_CLIENT_PARAM = 'client=android';

/**
 * What the service needs from the platform: whether it runs in the native shell, lazy loaders for
 * the Capacitor plugins (they and @capacitor/core stay out of the web's initial bundle) and a
 * full-page navigation. A token so tests can swap them.
 */
export interface NativePlatform {
  isNative: boolean;
  loadApp: () => Promise<typeof import('@capacitor/app')>;
  loadBrowser: () => Promise<typeof import('@capacitor/browser')>;
  navigate: (url: string) => void;
}

export const NATIVE_PLATFORM = new InjectionToken<NativePlatform>('NATIVE_PLATFORM', {
  providedIn: 'root',
  factory: () => ({
    isNative: isNativePlatform(),
    loadApp: () => import('@capacitor/app'),
    loadBrowser: () => import('@capacitor/browser'),
    navigate: (url) => {
      window.location.href = url;
    },
  }),
});

/** Runs a lazy plugin import, retrying once (a flaky chunk load); each failure is logged. */
export async function importWithRetry<T>(load: () => Promise<T>, name: string): Promise<T> {
  try {
    return await load();
  } catch (first) {
    console.error(`Loading ${name} failed, retrying once`, first);
    try {
      return await load();
    } catch (second) {
      console.error(`Loading ${name} failed`, second);
      throw second;
    }
  }
}

/**
 * Bridges external login flows (Google, Steam) on the native app.
 *
 * Google rejects OAuth inside embedded WebViews, so on native the flow runs in the
 * system browser (Custom Tab). The API then redirects to the app's custom scheme,
 * Android hands that URL back to the app, and we route it to the regular
 * /oauth-callback page so the existing code exchange runs unchanged.
 */
@Injectable({ providedIn: 'root' })
export class NativeOAuthService {
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly platform = inject(NATIVE_PLATFORM);

  readonly isNative = this.platform.isNative;

  /** The one-time code must be exchanged once, even if the URL is delivered twice on cold start. */
  private lastHandledUrl: string | null = null;

  /** Registers the deep-link listener. Call once at app startup. Resolves once registered (or given up). */
  init(): Promise<void> {
    if (!this.isNative) {
      return Promise.resolve();
    }
    return importWithRetry(this.platform.loadApp, '@capacitor/app')
      .then(async ({ App }) => {
        void App.addListener('appUrlOpen', (event) => this.handleUrl(event.url));
        // Cold start: the app may have been killed while the Custom Tab was open.
        const launch = await App.getLaunchUrl();
        if (launch?.url) this.handleUrl(launch.url);
      })
      .catch((error: unknown) => console.error('Native deep links unavailable', error));
  }

  /**
   * Opens an external login flow: Custom Tab on native, full-page navigation on web. Never
   * rejects: if the Custom Tab cannot open, it falls back to navigating the app's own page.
   */
  async openExternalFlow(url: string): Promise<void> {
    if (!this.isNative) {
      this.platform.navigate(url);
      return;
    }
    const separator = url.includes('?') ? '&' : '?';
    try {
      const { Browser } = await importWithRetry(this.platform.loadBrowser, '@capacitor/browser');
      await Browser.open({ url: `${url}${separator}${NATIVE_CLIENT_PARAM}` });
    } catch (error) {
      console.error('Custom Tab unavailable, opening the flow in the app', error);
      this.platform.navigate(url);
    }
  }

  private handleUrl(rawUrl: string): void {
    if (rawUrl === this.lastHandledUrl) {
      return;
    }

    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return;
    }
    // Exact scheme + host match (a prefix check would also accept e.g. "oauth-callback.evil").
    if (url.protocol !== NATIVE_CALLBACK_PROTOCOL || url.hostname !== NATIVE_CALLBACK_HOST) {
      return;
    }
    this.lastHandledUrl = rawUrl;

    const params = url.searchParams;

    const queryParams: Record<string, string> = {};
    const code = params.get('code');
    const error = params.get('error');
    if (code) queryParams['code'] = code;
    if (error) queryParams['error'] = error;
    // Forwarded as-is: /oauth-callback only honours whitelisted values.
    const next = params.get('next');
    if (next) queryParams['next'] = next;

    // Closing the Custom Tab is best effort: the user is already back in the app.
    this.platform
      .loadBrowser()
      .then(({ Browser }) => Browser.close())
      .catch((closeError: unknown) => console.error('Could not close the Custom Tab', closeError));
    this.zone.run(() => this.router.navigate(['/oauth-callback'], { queryParams, replaceUrl: true }));
  }
}
