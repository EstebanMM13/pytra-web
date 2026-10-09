import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, Validators, NonNullableFormBuilder } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { API_ORIGIN } from '../../../core/api-base-url';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './login.html',
})
export class Login {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = this.fb.group({
    identifier: this.fb.control('', Validators.required),
    password: this.fb.control('', Validators.required),
  });

  readonly submitting = signal(false);
  readonly errorKey = signal<string | null>(null);

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorKey.set(null);

    this.authService.login(this.form.getRawValue()).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.submitting.set(false);
        this.errorKey.set(
          err.status === 401 ? 'auth.errors.invalidCredentials' :
          err.status === 403 ? 'auth.errors.emailNotVerified' :
          'auth.errors.generic'
        );
      },
    });
  }

  loginWithGoogle(): void {
    window.location.href = `${API_ORIGIN}/oauth2/authorization/google`;
  }
}
