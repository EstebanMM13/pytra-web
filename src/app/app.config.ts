import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { provideServiceWorker } from '@angular/service-worker';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { routes } from './app.routes';
import { VIEW_TRANSITION_OPTIONS } from './core/view-transitions';
import { isNativePlatform } from './core/native-platform';
import { NativeOAuthService } from './core/services/native-oauth.service';
import { ThemeService } from './core/services/theme.service';
import { PreferencesService, applyLanguage } from './core/services/preferences.service';
import { AppUpdateService } from './core/services/app-update.service';
import { InstallPromptService } from './core/services/install-prompt.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withViewTransitions(VIEW_TRANSITION_OPTIONS),
      // New pages open at the top; Back restores the previous scroll position.
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    // Not awaited: the deep-link listener registers in the background instead of delaying startup.
    provideAppInitializer(() => {
      void inject(NativeOAuthService).init();
    }),
    provideAppInitializer(() => {
      inject(ThemeService);
      // Attach the beforeinstallprompt listener before the browser fires it.
      inject(InstallPromptService);
    }),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideTranslateService({ lang: 'es', fallbackLang: 'es' }),
    ...provideTranslateHttpLoader({ prefix: '/i18n/', suffix: '.json' }),
    provideAppInitializer(() => applyLanguage(inject(TranslateService), inject(PreferencesService).language())),
    // PWA: production web only. Inside the Capacitor shell assets are already local.
    // '?v=2' changes the worker URL so browsers that installed the first worker
    // (with the page CSP, which blocked cross-origin covers) pick up the fixed one.
    provideServiceWorker('ngsw-worker.js?v=2', {
      enabled: !isDevMode() && !isNativePlatform(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideAppInitializer(() => inject(AppUpdateService).init()),
  ],
};
