import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { isNativePlatform } from '../native-platform';

interface LaunchSplashPlugin {
  hide(): Promise<void>;
}

export interface LaunchSplashDeps {
  native: boolean;
  /** Asks the native shell to remove the system splash (MainActivity / LaunchSplashPlugin). */
  hideNative: () => Promise<void>;
}

export const LAUNCH_SPLASH_DEPS = new InjectionToken<LaunchSplashDeps>('LAUNCH_SPLASH_DEPS', {
  factory: () => ({
    native: isNativePlatform(),
    hideNative: () =>
      import('@capacitor/core').then(({ Capacitor, registerPlugin }) =>
        Capacitor.isPluginAvailable('LaunchSplash')
          ? registerPlugin<LaunchSplashPlugin>('LaunchSplash').hide()
          : undefined,
      ),
  }),
});

/**
 * Handoff between the native system splash and the web app. The native shell keeps its splash
 * up until `release()` (called by App after its first render); `released` then turns true, and
 * the in-app intro starts animating from the exact frame the system splash showed. On the web
 * there is no system splash, so it is released from the start. A failed native call still
 * releases (the shell also lets go after a timeout).
 */
@Injectable({ providedIn: 'root' })
export class LaunchSplash {
  private readonly deps = inject(LAUNCH_SPLASH_DEPS);
  private readonly releasedState = signal(!this.deps.native);
  private requested = false;

  readonly released = this.releasedState.asReadonly();

  async release(): Promise<void> {
    if (this.requested || this.releasedState()) {
      return;
    }
    this.requested = true;
    try {
      await this.deps.hideNative();
    } catch {
      // The native side times out on its own; the intro must not wait for it.
    }
    this.releasedState.set(true);
  }
}
