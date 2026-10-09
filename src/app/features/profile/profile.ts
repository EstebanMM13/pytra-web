import { Component, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { ThemePreference, ThemeService } from '../../core/services/theme.service';
import { UserService } from '../../core/services/user.service';
import { usernameValidators } from '../../core/validators/username';
import { Navbar } from '../../shared/navbar/navbar';
import { SectionHeader } from '../../shared/ui/section-header';
import { Segmented, SegmentedOption } from '../../shared/ui/segmented';

@Component({
  selector: 'app-profile',
  imports: [Navbar, ReactiveFormsModule, TranslatePipe, SectionHeader, Segmented],
  templateUrl: './profile.html',
})
export class Profile {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly theme = inject(ThemeService);

  protected readonly themeOptions: SegmentedOption<ThemePreference>[] = [
    { value: 'dark', label: 'theme.dark' },
    { value: 'light', label: 'theme.light' },
    { value: 'system', label: 'theme.system' },
  ];

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

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
