import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthShell } from '../auth-shell';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { ResendVerification } from '../../../shared/resend-verification/resend-verification';

@Component({
  selector: 'app-verify-email',
  imports: [AuthShell, RouterLink, TranslatePipe, ResendVerification],
  templateUrl: './verify-email.html',
})
export class VerifyEmail {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly status = signal<'verifying' | 'success' | 'expired' | 'invalid'>('verifying');

  constructor() {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.status.set('invalid');
      return;
    }

    this.authService.verifyEmail(token).subscribe({
      next: () => this.status.set('success'),
      // 410 Gone = the link existed but expired; anything else = unknown or already used.
      error: (err) => this.status.set(err.status === 410 ? 'expired' : 'invalid'),
    });
  }
}
