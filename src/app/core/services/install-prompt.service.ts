import { Injectable, computed, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';

/** Chromium's non-standard install prompt event. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
}

const DASHBOARD_DISMISS_KEY = 'pytra_install_banner_dismissed';

/**
 * PWA install flow. Must be instantiated at startup (see app.config) so the
 * `beforeinstallprompt` listener is attached before the browser fires it.
 * Inert inside the Capacitor native shell.
 */
@Injectable({ providedIn: 'root' })
export class InstallPromptService {
  private readonly deferred = signal<BeforeInstallPromptEvent | null>(null);
  private readonly native = Capacitor.isNativePlatform();

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

    this.installed.set(isStandalone());
    this.showIosHint.set(!this.installed() && isIosSafari());

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferred.set(event as BeforeInstallPromptEvent);
    });
    window.addEventListener('appinstalled', () => {
      this.deferred.set(null);
      this.installed.set(true);
      this.showIosHint.set(false);
    });
  }

  /** Shows the browser install prompt. Resolves true when the user accepted. */
  async install(): Promise<boolean> {
    const event = this.deferred();
    if (!event) return false;
    // The event can only be used once, whatever the outcome.
    this.deferred.set(null);
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
