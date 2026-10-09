import { Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';

/** Matches the backend throttle between two verification emails for the same account. */
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * "Didn't get the email?" block: asks the API for a new verification link and enforces a cooldown.
 * The email field is prefilled when the parent knows it (register) and editable otherwise (login by username).
 */
@Component({
  selector: 'app-resend-verification',
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './resend-verification.html',
})
export class ResendVerification implements OnInit {
  private readonly authService = inject(AuthService);

  /** Email to prefill. */
  readonly email = input('');
  /** Start with the cooldown running (an email was just sent, e.g. right after registering). */
  readonly startCooldown = input(false);

  readonly emailControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email],
  });

  readonly sending = signal(false);
  readonly cooldown = signal(0);
  readonly feedbackKey = signal<string | null>(null);
  readonly errorKey = signal<string | null>(null);

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopTimer());
  }

  ngOnInit(): void {
    this.emailControl.setValue(this.email());
    if (this.startCooldown()) {
      this.runCooldown();
    }
  }

  resend(): void {
    if (this.emailControl.invalid) {
      this.emailControl.markAsTouched();
      return;
    }

    this.sending.set(true);
    this.feedbackKey.set(null);
    this.errorKey.set(null);

    this.authService.resendVerification({ email: this.emailControl.value }).subscribe({
      next: () => {
        this.sending.set(false);
        this.feedbackKey.set('auth.resendVerification.sent');
        this.runCooldown();
      },
      error: (err) => {
        this.sending.set(false);
        this.errorKey.set(err.status === 429 ? 'auth.errors.tooManyRequests' : 'auth.errors.generic');
      },
    });
  }

  private runCooldown(): void {
    this.stopTimer();
    this.cooldown.set(RESEND_COOLDOWN_SECONDS);
    this.timer = setInterval(() => {
      const next = this.cooldown() - 1;
      this.cooldown.set(Math.max(next, 0));
      if (next <= 0) {
        this.stopTimer();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
