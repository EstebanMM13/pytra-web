import { Component, afterNextRender, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LaunchSplash } from './core/services/launch-splash.service';
import { RunFormLauncher } from './core/services/run-form-launcher.service';
import { RunForm } from './features/games/run-form/run-form';
import { SplashOverlay } from './shared/splash/splash-overlay';
import { SplashGate } from './shared/splash/splash-gate';
import { ToastHost } from './shared/toast/toast-host';

@Component({
  imports: [RouterOutlet, RunForm, SplashOverlay, ToastHost],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly runFormLauncher = inject(RunFormLauncher);

  /** Brand intro: native cold start, or once per web session on getting into the app (SplashGate). */
  protected readonly showSplash = inject(SplashGate).show;

  /** One-item list so each new open request gets a fresh form instance (tracked by identity). */
  protected readonly runFormRequests = computed(() => {
    const request = this.runFormLauncher.request();
    return request ? [request] : [];
  });

  constructor() {
    // No intro: the first frame is the app itself, so the native shell can drop its system
    // splash now. With an intro, SplashOverlay releases it once it has painted (see LaunchSplash).
    const launchSplash = inject(LaunchSplash);
    afterNextRender(() => {
      if (!this.showSplash()) {
        void launchSplash.release();
      }
    });
  }
}
