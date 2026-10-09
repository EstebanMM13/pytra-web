import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';

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

  constructor() {
    const code = this.route.snapshot.queryParamMap.get('code');
    const error = this.route.snapshot.queryParamMap.get('error');

    if (!code || error) {
      this.failed.set(true);
      return;
    }

    this.authService.exchangeCode({ code }).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: () => this.failed.set(true),
    });
  }
}
