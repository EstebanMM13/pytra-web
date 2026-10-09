import { Component, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { UserService } from '../../core/services/user.service';
import { usernameValidators } from '../../core/validators/username';
import { Navbar } from '../../shared/navbar/navbar';

@Component({
  selector: 'app-profile',
  imports: [Navbar, ReactiveFormsModule, TranslatePipe],
  templateUrl: './profile.html',
})
export class Profile {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly userService = inject(UserService);

  protected readonly user = this.userService.currentUser;

  readonly form = this.fb.group({
    username: this.fb.control('', usernameValidators),
  });

  readonly submitting = signal(false);
  readonly saved = signal(false);
  readonly errorKey = signal<string | null>(null);

  constructor() {
    // Prefill once the profile is available (it loads asynchronously after the token is read).
    effect(() => {
      const user = this.user();
      const control = this.form.controls.username;
      if (user && !control.dirty) {
        control.setValue(user.usernameDisplay || user.username);
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.saved.set(false);
    this.errorKey.set(null);

    this.userService.updateUsername(this.form.getRawValue()).subscribe({
      next: (user) => {
        this.submitting.set(false);
        this.saved.set(true);
        this.form.reset({ username: user.usernameDisplay || user.username });
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorKey.set(err.status === 409 ? 'profile.usernameTaken' : 'auth.errors.generic');
      },
    });
  }
}
