import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { isNativePlatform } from '../native-platform';
import {
  BeforeInstallPromptEvent,
  clearDeferredInstallPrompt,
  installPromptState,
  onInstallPromptChange,
  stashInstallPrompt,
} from '../install-prompt-stash';

export type { BeforeInstallPromptEvent } from '../install-prompt-stash';

const DASHBOARD_DISMISS_KEY = 'pytra_install_banner_dismissed';

/**
 * PWA install flow. Loaded lazily by the screens that offer it (dashboard, profile): the early
 * `beforeinstallprompt` is caught by the startup stash (main.ts, `install-prompt-stash.ts`) and
 * read from there. Inert inside the Capacitor native shell.
 */
@Injectable({ providedIn: 'root' })
export class InstallPromptService {
  private readonly deferred = signal<BeforeInstallPromptEvent | null>(null);
  private readonly native = isNativePlatform();

  /** True when running as an installed PWA (standalone display mode). */
  readonly installed = signal(false);
  /** A native install prompt is available. */
  readonly canInstall = computed(() => !this.native && !this.installed() && this.deferred() !== null);
  /** iOS Safari (no beforeinstallprompt): show the manual "Add to Home Screen" hint. */
  readonly showIosHint = signal(false);
  /** Dashboard banner dismissal (remembered per device). */
  readonly bannerDismissed = signal(readDismissed());
  readonly showBanner = computed(() => this.canInstall() && !this.bannerDismissed());

  constructor() {
    if (this.native || typeof window === 'undefined') return;

    // Normally attached by main.ts already; idempotent.
    stashInstallPrompt();
    this.installed.set(isStandalone());
    this.showIosHint.set(!this.installed() && isIosSafari());

    const sync = (): void => {
      const { deferred, installed } = installPromptState();
      this.deferred.set(deferred);
      if (installed) {
        this.installed.set(true);
        this.showIosHint.set(false);
      }
    };
    sync();
    inject(DestroyRef).onDestroy(onInstallPromptChange(sync));
  }

  /** Shows the browser install prompt. Resolves true when the user accepted. */
  async install(): Promise<boolean> {
    const event = this.deferred();
    if (!event) return false;
    // The event can only be used once, whatever the outcome.
    clearDeferredInstallPrompt();
    await event.prompt();
    const choice = await event.userChoice;
    return choice.outcome === 'accepted';
  }

  dismissBanner(): void {
    this.bannerDismissed.set(true);
    try {
      localStorage.setItem(DASHBOARD_DISMISS_KEY, '1');
    } catch {
      // Storage unavailable (private mode): dismissal lasts for this session only.
    }
  }
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DASHBOARD_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  const media = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  return media || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as Mac; touch points tell it apart.
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  // Other iOS browsers (Chrome, Firefox, Edge...) add their own token.
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua);
  return ios && safari;
}
