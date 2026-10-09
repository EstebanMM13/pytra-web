import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';

/** Error value the API sends when a Google sign-up is blocked by the invite allowlist. */
const REGISTRATION_CLOSED_ERROR = 'registration_closed';

/**
 * Where to land after the callback, keyed by the `next` value the API sets server-side.
 * Only whitelisted values are honoured, so a crafted `next` can never redirect elsewhere.
 */
const NEXT_ROUTES = new Map<string, string>([['steam', '/steam']]);

@Component({
  selector: 'app-oauth-callback',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './oauth-callback.html',
})
export class OauthCallback {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly failed = signal(false);
  readonly errorKey = signal('auth.oauthCallback.error');

  constructor() {
    const code = this.route.snapshot.queryParamMap.get('code');
    const error = this.route.snapshot.queryParamMap.get('error');
    const nextRoute = NEXT_ROUTES.get(this.route.snapshot.queryParamMap.get('next') ?? '') ?? null;

    // Steam link flow: the user already has a session, so errors are shown on the Steam page.
    if (nextRoute === '/steam' && (!code || error)) {
      this.router.navigate([nextRoute], {
        queryParams: { linkError: error ?? 'steam_link_failed' },
        replaceUrl: true,
      });
      return;
    }

    if (!code || error) {
      if (error === REGISTRATION_CLOSED_ERROR) {
        this.errorKey.set('auth.errors.registrationClosed');
      }
      this.failed.set(true);
      return;
    }

    this.authService.exchangeCode({ code }).subscribe({
      next: () =>
        this.router.navigate([nextRoute ?? '/dashboard'], {
          queryParams: nextRoute === '/steam' ? { linked: '1' } : {},
          replaceUrl: true,
        }),
      error: () => this.failed.set(true),
    });
  }
}
