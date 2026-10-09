import { Routes, UrlMatchResult, UrlSegment } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export function sagasMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments[0]?.path !== 'sagas' || segments.length > 2) {
    return null;
  }
  return segments.length === 2
    ? { consumed: segments, posParams: { id: segments[1] } }
    : { consumed: segments };
}

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register/register').then((m) => m.Register),
  },
  {
    path: 'verify-email',
    loadComponent: () =>
      import('./features/auth/verify-email/verify-email').then((m) => m.VerifyEmail),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password').then((m) => m.ResetPassword),
  },
  {
    path: 'oauth-callback',
    loadComponent: () =>
      import('./features/auth/oauth-callback/oauth-callback').then((m) => m.OauthCallback),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    // `/sagas` and `/sagas/:id` share one route so the master-detail view is reused
    // (not recreated) when the selection changes.
    matcher: sagasMatcher,
    canActivate: [authGuard],
    loadComponent: () => import('./features/sagas/sagas').then((m) => m.Sagas),
  },
  {
    path: 'games',
    canActivate: [authGuard],
    loadComponent: () => import('./features/games/games').then((m) => m.Games),
  },
  {
    path: 'games/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/games/game-detail/game-detail').then((m) => m.GameDetail),
  },
  {
    path: 'games/:gameId/experiences/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/games/experience-detail/experience-detail').then((m) => m.ExperienceDetail),
  },
  {
    path: 'years',
    canActivate: [authGuard],
    loadComponent: () => import('./features/years/years').then((m) => m.Years),
  },
  {
    path: 'years/:year',
    canActivate: [authGuard],
    loadComponent: () => import('./features/years/years').then((m) => m.Years),
  },
  {
    path: 'steam',
    canActivate: [authGuard],
    loadComponent: () => import('./features/steam/steam').then((m) => m.Steam),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/profile').then((m) => m.Profile),
  },
  { path: '**', redirectTo: 'dashboard' },
];
