import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { RunFormLauncher } from './core/services/run-form-launcher.service';
import { TokenStorageService } from './core/services/token-storage.service';
import { RunForm } from './features/games/run-form/run-form';
import { PlayingBackdrop } from './shared/backdrop/playing-backdrop';
import { isNativePlatform } from './core/native-platform';
import { SplashOverlay } from './shared/splash/splash-overlay';
import { shouldShowSplash } from './shared/splash/splash.logic';
import { prefersReducedMotion } from './shared/utils/motion';
import { ToastHost } from './shared/toast/toast-host';

@Component({
  imports: [RouterOutlet, PlayingBackdrop, RunForm, SplashOverlay, ToastHost],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly runFormLauncher = inject(RunFormLauncher);
  private readonly tokens = inject(TokenStorageService);

  /** Signed-in screens get the in-progress covers background; signed-out ones keep the aura. */
  protected readonly signedIn = computed(() => this.tokens.token() !== null);

  /** Cold start inside the native shell: play the brand intro (see SplashOverlay). */
  protected readonly showSplash = shouldShowSplash(isNativePlatform(), prefersReducedMotion());

  /** One-item list so each new open request gets a fresh form instance (tracked by identity). */
  protected readonly runFormRequests = computed(() => {
    const request = this.runFormLauncher.request();
    return request ? [request] : [];
  });
}
