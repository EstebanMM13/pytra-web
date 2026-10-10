import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { API_ORIGIN } from '../../core/api-base-url';
import { CurrentUser } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { NativeOAuthService } from '../../core/services/native-oauth.service';
import { UserService } from '../../core/services/user.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ModalSheet } from '../../shared/ui/modal-sheet';
import {
  RESUME_DELETE_ACCOUNT,
  clearPostLoginRedirect,
  rememberPostLoginRedirect,
} from '../../shared/utils/post-login-redirect';
import { REAUTH_REQUIRED_KEY, confirmsUsername, deleteAccountErrorKey } from './profile.logic';

/**
 * Account deletion confirmation: the user types their username (and password when the account
 * has one). A Google-only account with an old session is asked to log in again with Google;
 * the flow then comes back here (`/profile?delete=1`) to retry.
 */
@Component({
  selector: 'app-delete-account-dialog',
  imports: [TranslatePipe, ModalSheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-sheet
      danger
      [title]="'profile.delete.title' | translate"
      [saveLabel]="(deleting() ? 'profile.delete.deleting' : 'profile.delete.submit') | translate"
      [saving]="deleting()"
      [saveDisabled]="!canSubmit()"
      (save)="submit()"
      (closed)="close()"
    >
      <form (submit)="$event.preventDefault(); submit()" novalidate class="flex flex-col gap-4 md:gap-[18px]">
        <div class="rounded-[10px] border border-danger/40 bg-danger-bg px-4 py-3 text-sm leading-relaxed text-danger">
          {{ 'profile.delete.warning' | translate }}
        </div>
        <p class="text-[13px] leading-relaxed text-muted">{{ 'profile.delete.exportHint' | translate }}</p>

        <div class="flex flex-col gap-2">
          <label for="delete-confirm" class="text-[13px] wrap-break-word text-text-3">
            {{ 'profile.delete.confirmLabel' | translate: { username: user().username } }}
          </label>
          <input
            id="delete-confirm"
            data-autofocus
            type="text"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            [value]="confirm()"
            (input)="confirm.set($any($event.target).value)"
            [placeholder]="user().username"
            class="h-[50px] w-full rounded-xl border border-border bg-surface px-3.5 text-[16px] text-text md:h-[46px] md:rounded-[10px] md:bg-bg md:text-[15px]"
          />
        </div>

        @if (user().hasPassword) {
          <div class="flex flex-col gap-2">
            <label for="delete-password" class="text-[13px] text-text-3">{{ 'profile.delete.password' | translate }}</label>
            <input
              id="delete-password"
              type="password"
              autocomplete="current-password"
              [value]="password()"
              (input)="password.set($any($event.target).value)"
              class="h-[50px] w-full rounded-xl border border-border bg-surface px-3.5 text-[16px] text-text md:h-[46px] md:rounded-[10px] md:bg-bg md:text-[15px]"
            />
          </div>
        }

        @if (errorKey() === reauthKey) {
          <div class="flex flex-col gap-3 rounded-[10px] border border-border bg-bg px-4 py-3">
            <p class="text-sm leading-relaxed text-text-2">{{ reauthKey | translate }}</p>
            <button
              type="button"
              (click)="reauthenticate()"
              class="self-start rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-2 hover:border-border-strong"
            >
              {{ 'profile.delete.reauthButton' | translate }}
            </button>
          </div>
        } @else if (errorKey(); as key) {
          <p class="text-sm text-danger" role="alert">{{ key | translate }}</p>
        }
        <button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
      </form>
    </app-modal-sheet>
  `,
})
export class DeleteAccountDialog {
  readonly user = input.required<CurrentUser>();
  readonly closed = output<void>();

  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly nativeOAuth = inject(NativeOAuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  protected readonly reauthKey = REAUTH_REQUIRED_KEY;
  protected readonly confirm = signal('');
  protected readonly password = signal('');
  protected readonly deleting = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected readonly canSubmit = computed(
    () =>
      confirmsUsername(this.confirm(), this.user().username) &&
      (!this.user().hasPassword || this.password().length > 0),
  );

  protected submit(): void {
    if (!this.canSubmit() || this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.errorKey.set(null);
    const request = this.user().hasPassword
      ? { confirm: this.confirm().trim(), password: this.password() }
      : { confirm: this.confirm().trim() };
    this.userService.deleteAccount(request).subscribe({
      next: () => {
        this.authService.logout();
        this.toast.success(this.translate.instant('profile.delete.done'));
        this.router.navigate(['/login'], { replaceUrl: true });
      },
      error: (err) => {
        this.deleting.set(false);
        this.errorKey.set(deleteAccountErrorKey(err));
      },
    });
  }

  /** Closing the dialog also abandons a pending "resume after Google re-login". */
  protected close(): void {
    clearPostLoginRedirect();
    this.closed.emit();
  }

  /** Fresh Google login, then back to `/profile?delete=1` (see OauthCallback). */
  protected reauthenticate(): void {
    rememberPostLoginRedirect(RESUME_DELETE_ACCOUNT);
    void this.nativeOAuth.openExternalFlow(`${API_ORIGIN}/oauth2/authorization/google`);
  }
}
