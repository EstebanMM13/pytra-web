import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthShell } from '../auth-shell';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { consumePostLoginRedirect } from '../../../shared/utils/post-login-redirect';

/** Error value the API sends when a Google sign-up is blocked by the invite allowlist. */
const REGISTRATION_CLOSED_ERROR = 'registration_closed';

/** Page that hosts the Steam link flow (the API still sends `next=steam`). */
export const STEAM_LINK_ROUTE = '/sync';

/**
 * Where to land after the callback, keyed by the `next` value the API sets server-side.
 * Only whitelisted values are honoured, so a crafted `next` can never redirect elsewhere.
 */
const NEXT_ROUTES = new Map<string, string>([['steam', STEAM_LINK_ROUTE]]);

/**
 * One-time codes already sent to /exchange-code in this app session. The callback can be
 * reached twice for the same Google sign-in (re-navigation, deep link delivered again); the
 * second exchange fails because the code is consumed, and used to flash the error screen.
 */
const exchangedCodes = new Set<string>();

@Component({
  selector: 'app-oauth-callback',
  imports: [AuthShell, RouterLink, TranslatePipe],
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

    // Steam link flow: the user already has a session, so errors are shown on the Sync page.
    if (nextRoute === STEAM_LINK_ROUTE && (!code || error)) {
      this.router.navigate([nextRoute], {
        queryParams: { linkError: error ?? 'steam_link_failed' },
        replaceUrl: true,
      });
      return;
    }

    // Pending "resume after re-login" destination (e.g. account deletion); read once either way.
    const resume = nextRoute ? null : consumePostLoginRedirect();

    if (!code || error) {
      if (error === REGISTRATION_CLOSED_ERROR) {
        this.errorKey.set('auth.errors.registrationClosed');
      }
      this.failed.set(true);
      return;
    }

    // Duplicate visit for a code already in flight or exchanged: the first visit navigates.
    if (exchangedCodes.has(code)) {
      return;
    }
    exchangedCodes.add(code);

    const land = () => {
      if (resume) {
        this.router.navigateByUrl(resume, { replaceUrl: true });
        return;
      }
      this.router.navigate([nextRoute ?? '/dashboard'], {
        queryParams: nextRoute === STEAM_LINK_ROUTE ? { linked: '1' } : {},
        replaceUrl: true,
      });
    };

    this.authService.exchangeCode({ code }).subscribe({
      next: land,
      // A rejected exchange while a session already exists is a duplicate, not a failed sign-in.
      error: () => (this.authService.isAuthenticated() ? land() : this.failed.set(true)),
    });
  }
}
