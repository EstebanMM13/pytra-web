import { Injectable, InjectionToken, effect, inject, signal, untracked } from '@angular/core';
import { isNativePlatform } from '../../core/native-platform';
import { AuthService } from '../../core/services/auth.service';
import { prefersReducedMotion } from '../utils/motion';
import { shouldShowSplash, shouldShowWebSplash } from './splash.logic';

/** sessionStorage flag: the web intro already played in this browser session. */
export const WEB_SPLASH_SEEN_KEY = 'pytra_splash_seen';

export interface SplashGateDeps {
  native: boolean;
  reducedMotion: () => boolean;
  readSeen: () => boolean;
  writeSeen: () => void;
}

export const SPLASH_GATE_DEPS = new InjectionToken<SplashGateDeps>('SPLASH_GATE_DEPS', {
  factory: () => ({
    native: isNativePlatform(),
    reducedMotion: prefersReducedMotion,
    readSeen: () => {
      try {
        return sessionStorage.getItem(WEB_SPLASH_SEEN_KEY) === '1';
      } catch {
        return false;
      }
    },
    writeSeen: () => {
      try {
        sessionStorage.setItem(WEB_SPLASH_SEEN_KEY, '1');
      } catch {
        // Storage unavailable: the intro may play again on the next load, which is harmless.
      }
    },
  }),
});

/**
 * Decides when the brand intro (SplashOverlay) plays. Native: on every cold start. Web: once per
 * browser session, when the user gets into the app: on load when already signed in, otherwise
 * right after logging in (never over the login screen). The app underneath keeps loading its
 * data while the intro plays.
 */
@Injectable({ providedIn: 'root' })
export class SplashGate {
  private readonly deps = inject(SPLASH_GATE_DEPS);
  private readonly auth = inject(AuthService);
  private readonly showState = signal(this.deps.native && shouldShowSplash(true, this.deps.reducedMotion()));

  readonly show = this.showState.asReadonly();

  constructor() {
    if (this.deps.native) {
      return;
    }
    const watcher = effect(() => {
      if (!this.auth.isAuthenticated()) {
        return;
      }
      untracked(() => {
        if (shouldShowWebSplash(true, this.deps.reducedMotion(), this.deps.readSeen())) {
          this.showState.set(true);
        }
        // Signed in once in this session: the intro never plays again (even if skipped by motion).
        this.deps.writeSeen();
      });
      watcher.destroy();
    });
  }
}
