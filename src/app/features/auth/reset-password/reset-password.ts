import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthShell } from '../auth-shell';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  imports: [AuthShell, ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './reset-password.html',
})
export class ResetPassword {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  private readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';

  readonly form = this.fb.group({
    newPassword: this.fb.control('', [Validators.required, Validators.minLength(8)]),
  });

  readonly submitting = signal(false);
  readonly success = signal(false);
  readonly errorKey = signal<string | null>(null);
  /** Link problems (missing, expired, used) cannot be fixed on this page: the user needs a new link. */
  readonly linkErrorKey = signal<string | null>(
    this.token ? null : 'auth.resetPassword.invalidLink',
  );

  submit(): void {
    if (this.form.invalid || !this.token) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorKey.set(null);

    this.authService
      .resetPassword({ token: this.token, newPassword: this.form.getRawValue().newPassword })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.success.set(true);
        },
        error: (err) => {
          this.submitting.set(false);
          if (err.status === 410) {
            this.linkErrorKey.set('auth.resetPassword.expiredLink');
          } else if (err.status === 400 && !err.error?.fieldErrors?.newPassword) {
            this.linkErrorKey.set('auth.resetPassword.invalidLink');
          } else {
            this.errorKey.set('auth.errors.generic');
          }
        },
      });
  }
}
