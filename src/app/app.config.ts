import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  Injector,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { routes } from './app.routes';
import { VIEW_TRANSITION_OPTIONS } from './core/view-transitions';
import { isNativePlatform } from './core/native-platform';
import { ThemeService } from './core/services/theme.service';
import { PreferencesService, applyLanguage } from './core/services/preferences.service';
import { AppUpdateService } from './core/services/app-update.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withViewTransitions(VIEW_TRANSITION_OPTIONS),
      // New pages open at the top; Back restores the previous scroll position.
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    // Native only, loaded on demand so the web's initial bundle skips it. Not awaited: the
    // deep-link listener registers in the background instead of delaying startup.
    provideAppInitializer(() => {
      if (!isNativePlatform()) return;
      const injector = inject(Injector);
      void import('./core/services/native-oauth.service')
        .then(({ NativeOAuthService }) => injector.get(NativeOAuthService).init())
        .catch((error: unknown) => console.error('Native deep links unavailable', error));
    }),
    // The install prompt is caught by a tiny listener in main.ts; its service loads with the screens using it.
    provideAppInitializer(() => {
      inject(ThemeService);
    }),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideTranslateService({ lang: 'es', fallbackLang: 'es' }),
    ...provideTranslateHttpLoader({ prefix: '/i18n/', suffix: '.json' }),
    provideAppInitializer(() => applyLanguage(inject(TranslateService), inject(PreferencesService).language())),
    // PWA: production web only, registered after load / idle (see AppUpdateService).
    provideAppInitializer(() => inject(AppUpdateService).init()),
  ],
};
