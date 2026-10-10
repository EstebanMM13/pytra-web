import { LucideEye, LucideEyeOff } from '@lucide/angular';
import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, Validators, NonNullableFormBuilder } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthShell } from '../auth-shell';
import { TranslatePipe } from '@ngx-translate/core';
import { API_ORIGIN } from '../../../core/api-base-url';
import { AuthService } from '../../../core/services/auth.service';
import { NativeOAuthService } from '../../../core/services/native-oauth.service';
import { ResendVerification } from '../../../shared/resend-verification/resend-verification';

@Component({
  selector: 'app-login',
  imports: [AuthShell, ReactiveFormsModule, RouterLink, TranslatePipe, ResendVerification, LucideEye, LucideEyeOff],
  templateUrl: './login.html',
})
export class Login {
  protected readonly showPassword = signal(false);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly nativeOAuth = inject(NativeOAuthService);

  readonly form = this.fb.group({
    identifier: this.fb.control('', Validators.required),
    password: this.fb.control('', Validators.required),
  });

  readonly submitting = signal(false);
  readonly errorKey = signal<string | null>(null);
  /** Set when the credentials are right but the email is not verified yet (API answers 403). */
  readonly unverifiedEmail = signal<string | null>(null);

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorKey.set(null);
    this.unverifiedEmail.set(null);

    this.authService.login(this.form.getRawValue()).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.submitting.set(false);
        if (err.status === 403) {
          // The user may have signed in with a username; only prefill when it is an email.
          const identifier = this.form.getRawValue().identifier;
          this.unverifiedEmail.set(identifier.includes('@') ? identifier : '');
          this.errorKey.set('auth.errors.emailNotVerified');
          return;
        }
        this.errorKey.set(
          err.status === 401 ? 'auth.errors.invalidCredentials' :
          err.status === 429 ? 'auth.errors.tooManyRequests' :
          'auth.errors.generic'
        );
      },
    });
  }

  loginWithGoogle(): void {
    void this.nativeOAuth.openExternalFlow(`${API_ORIGIN}/oauth2/authorization/google`);
  }
}
