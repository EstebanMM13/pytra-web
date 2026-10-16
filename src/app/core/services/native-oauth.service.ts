import { Injectable, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
import { isNativePlatform } from '../native-platform';

/** Custom-scheme callback the API redirects to when a login/link flow was started from the app. */
const NATIVE_CALLBACK_PROTOCOL = 'com.estebanmm13.pytra:';
const NATIVE_CALLBACK_HOST = 'oauth-callback';

/** Query param that tells the API the flow was started from the Android app. */
export const NATIVE_CLIENT_PARAM = 'client=android';

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

  readonly isNative = isNativePlatform();

  /** The one-time code must be exchanged once, even if the URL is delivered twice on cold start. */
  private lastHandledUrl: string | null = null;

  /** Registers the deep-link listener. Call once at app startup. */
  init(): void {
    if (!this.isNative) {
      return;
    }
    // Plugins load lazily (native only): they and @capacitor/core stay out of the initial bundle.
    import('@capacitor/app')
      .then(({ App }) => {
        void App.addListener('appUrlOpen', (event) => this.handleUrl(event.url));
        // Cold start: the app may have been killed while the Custom Tab was open.
        return App.getLaunchUrl().then((launch) => launch?.url && this.handleUrl(launch.url));
      })
      .catch(() => undefined);
  }

  /** Opens an external login flow: Custom Tab on native, full-page navigation on web. */
  async openExternalFlow(url: string): Promise<void> {
    if (!this.isNative) {
      window.location.href = url;
      return;
    }
    const separator = url.includes('?') ? '&' : '?';
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url: `${url}${separator}${NATIVE_CLIENT_PARAM}` });
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

    import('@capacitor/browser')
      .then(({ Browser }) => Browser.close())
      .catch(() => undefined);
    this.zone.run(() => this.router.navigate(['/oauth-callback'], { queryParams, replaceUrl: true }));
  }
}
