import { Injectable, NgZone, inject, isDevMode } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ToastService } from '../../shared/toast/toast.service';
import { isNativePlatform } from '../native-platform';

/**
 * Worker URL. Must stay identical to the one earlier builds registered: browsers keep updating an
 * installed worker under the same URL. '?v=2' replaced the first worker, whose page CSP blocked
 * cross-origin covers.
 */
export const SERVICE_WORKER_URL = 'ngsw-worker.js?v=2';

/** Longest wait for an idle moment after `load` before registering anyway. */
const REGISTER_IDLE_TIMEOUT_MS = 5000;

/** What the service needs from the browser; a parameter so tests can fake it. */
export interface AppUpdateEnv {
  serviceWorker: ServiceWorkerContainer | undefined;
  /** Runs `task` once the page has loaded and the main thread is idle. */
  whenIdle: (task: () => void) => void;
  reload: () => void;
}

function browserEnv(): AppUpdateEnv {
  return {
    serviceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
    whenIdle: (task) => {
      const idle = (): void => {
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(() => task(), { timeout: REGISTER_IDLE_TIMEOUT_MS });
        } else {
          setTimeout(task, 0);
        }
      };
      if (document.readyState === 'complete') idle();
      else window.addEventListener('load', idle, { once: true });
    },
    reload: () => document.location.reload(),
  };
}

/**
 * PWA service worker (production web only; inside the Capacitor shell the assets are already
 * local). Registers Angular's ngsw-worker with the plain Service Worker API after load / idle,
 * instead of `provideServiceWorker` + `SwUpdate`, which kept @angular/service-worker in the initial
 * bundle. The worker still checks for updates by itself (on navigation and start-up); when it has
 * downloaded a new version it posts VERSION_READY, which offers a reload.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly zone = inject(NgZone);

  init(env: AppUpdateEnv = browserEnv(), enabled = !isDevMode() && !isNativePlatform()): void {
    const sw = env.serviceWorker;
    if (!enabled || !sw) {
      return;
    }
    sw.addEventListener('message', (event: MessageEvent) => {
      if ((event.data as { type?: unknown } | null)?.type === 'VERSION_READY') {
        this.zone.run(() => this.offerReload(env));
      }
    });
    // Like Angular's registration: a newly controlling worker is told to initialise right away.
    sw.addEventListener('controllerchange', () => sw.controller?.postMessage({ action: 'INITIALIZE' }));
    sw.startMessages?.();
    env.whenIdle(() => {
      sw.register(SERVICE_WORKER_URL).catch((error: unknown) =>
        console.error('Service worker registration failed', error),
      );
    });
  }

  private offerReload(env: AppUpdateEnv): void {
    this.toast.action(this.translate.instant('update.available') as string, {
      label: 'update.reload',
      run: () => env.reload(),
    });
  }
}
