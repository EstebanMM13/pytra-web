import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { provideServiceWorker } from '@angular/service-worker';
import { Capacitor } from '@capacitor/core';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { routes } from './app.routes';
import { NativeOAuthService } from './core/services/native-oauth.service';
import { ThemeService } from './core/services/theme.service';
import { PreferencesService, applyLanguage } from './core/services/preferences.service';
import { AppUpdateService } from './core/services/app-update.service';
import { InstallPromptService } from './core/services/install-prompt.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withViewTransitions({ skipInitialTransition: true })),
    provideAppInitializer(() => inject(NativeOAuthService).init()),
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
      enabled: !isDevMode() && !Capacitor.isNativePlatform(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideAppInitializer(() => inject(AppUpdateService).init()),
  ],
};
