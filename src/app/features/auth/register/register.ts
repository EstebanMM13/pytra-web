import { LucideEye, LucideEyeOff } from '@lucide/angular';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthShell } from '../auth-shell';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { usernameValidators } from '../../../core/validators/username';
import { ResendVerification } from '../../../shared/resend-verification/resend-verification';

@Component({
  selector: 'app-register',
  imports: [AuthShell, ReactiveFormsModule, RouterLink, TranslatePipe, ResendVerification, LucideEye, LucideEyeOff],
  templateUrl: './register.html',
})
export class Register {
  protected readonly showPassword = signal(false);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);

  readonly form = this.fb.group({
    username: this.fb.control('', usernameValidators),
    email: this.fb.control('', [Validators.required, Validators.email]),
    password: this.fb.control('', [Validators.required, Validators.minLength(8)]),
  });

  readonly submitting = signal(false);
  /** Email the verification link was sent to; set once registration succeeds. */
  readonly registeredEmail = signal<string | null>(null);
  readonly errorKey = signal<string | null>(null);

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorKey.set(null);

    this.authService.register(this.form.getRawValue()).subscribe({
      next: (response) => {
        this.submitting.set(false);
        this.registeredEmail.set(response.email);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorKey.set(
          err.status === 409 ? 'auth.errors.duplicateUser' :
          err.status === 403 ? 'auth.errors.registrationClosed' :
          err.status === 429 ? 'auth.errors.tooManyRequests' :
          'auth.errors.generic'
        );
      },
    });
  }
}
