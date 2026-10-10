import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthShell } from '../auth-shell';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  imports: [AuthShell, ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './forgot-password.html',
})
export class ForgotPassword {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  /** Opened from the profile ("Cambiar contraseña"): link back there instead of to /login. */
  readonly signedIn = this.authService.isAuthenticated;

  readonly form = this.fb.group({
    // Prefilled when coming from the profile (?email=...).
    email: this.fb.control(this.route.snapshot.queryParamMap.get('email') ?? '', [
      Validators.required,
      Validators.email,
    ]),
  });

  readonly submitting = signal(false);
  readonly sent = signal(false);
  readonly errorKey = signal<string | null>(null);

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorKey.set(null);

    this.authService.forgotPassword(this.form.getRawValue()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.sent.set(true);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorKey.set(err.status === 429 ? 'auth.errors.tooManyRequests' : 'auth.errors.generic');
      },
    });
  }
}
