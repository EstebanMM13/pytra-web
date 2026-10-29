import { inject } from '@angular/core';
import { Router, Routes, UrlMatchResult, UrlSegment } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export function sagasMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments[0]?.path !== 'sagas' || segments.length > 2) {
    return null;
  }
  return segments.length === 2
    ? { consumed: segments, posParams: { id: segments[1] } }
    : { consumed: segments };
}

/** Matches `/years` and `/years/:year` (an invalid year is handled by the page itself). */
export function yearsMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments[0]?.path !== 'years' || segments.length > 2) {
    return null;
  }
  return segments.length === 2
    ? { consumed: segments, posParams: { year: segments[1] } }
    : { consumed: segments };
}

/** Matches `/steam` and any path below it (redirected to /sync). */
export function steamLegacyMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  return segments[0]?.path === 'steam' ? { consumed: segments } : null;
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
    // `/years` and `/years/:year` share one route so the `/years` -> latest-year redirect (and
    // switching years) reuses the page instead of recreating it and refetching its data.
    matcher: yearsMatcher,
    canActivate: [authGuard],
    loadComponent: () => import('./features/years/years').then((m) => m.Years),
  },
  {
    // Stats hub. Years and sagas stay at `/years` and `/sagas` (deep links, dashboard bars) and are
    // linked from it; the bottom-nav Stats tab stays lit on them.
    path: 'stats',
    canActivate: [authGuard],
    loadComponent: () => import('./features/stats/stats-hub').then((m) => m.StatsHub),
  },
  {
    path: 'stats/activity',
    canActivate: [authGuard],
    loadComponent: () => import('./features/stats/stats-activity').then((m) => m.StatsActivity),
  },
  {
    // `/diary?date=yyyy-mm-dd` opens that day's editor (dashboard card, daily reminder).
    path: 'diary',
    canActivate: [authGuard],
    loadComponent: () => import('./features/diary/diary').then((m) => m.Diary),
  },
  {
    path: 'sync',
    canActivate: [authGuard],
    loadComponent: () => import('./features/sync/sync').then((m) => m.Sync),
  },
  {
    // Legacy Steam page (old links, bookmarks, an older API's link callback): `/steam` and anything
    // below it land on /sync with the same query params (linked / linkError) and fragment.
    matcher: steamLegacyMatcher,
    redirectTo: ({ queryParams, fragment }) =>
      inject(Router).createUrlTree(['/sync'], { queryParams, fragment: fragment ?? undefined }),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/profile').then((m) => m.Profile),
  },
  { path: '**', redirectTo: 'dashboard' },
];
