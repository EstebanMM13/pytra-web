import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { provideTranslateService } from '@ngx-translate/core';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { routes } from './app.routes';
import { NativeOAuthService } from './core/services/native-oauth.service';
import { ThemeService } from './core/services/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withViewTransitions({ skipInitialTransition: true })),
    provideAppInitializer(() => inject(NativeOAuthService).init()),
    provideAppInitializer(() => {
      inject(ThemeService);
    }),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideTranslateService({ lang: 'es', fallbackLang: 'es' }),
    ...provideTranslateHttpLoader({ prefix: '/i18n/', suffix: '.json' }),
  ],
};
