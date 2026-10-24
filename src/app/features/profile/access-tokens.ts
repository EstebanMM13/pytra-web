import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AccessToken, CreatedAccessToken } from '../../core/models/access-token.model';
import { AccessTokenService } from '../../core/services/access-token.service';
import { DemoModeService } from '../../core/services/demo-mode.service';
import { ToastService } from '../../shared/toast/toast.service';
import {
  ACCESS_TOKEN_NAME_MAX,
  DEFAULT_ACCESS_TOKEN_NAME,
  MAX_ACCESS_TOKENS,
  accessTokenErrorKey,
  formatTokenDate,
  validTokenName,
} from './access-tokens.logic';

/**
 * "Obsidian sync" block of the profile's data section: create a personal access token (its plaintext is
 * shown once, with a copy button), list the existing ones and revoke them.
 */
@Component({
  selector: 'app-access-tokens',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3 border-t border-divider py-3 text-sm" data-access-tokens>
      <div class="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex min-w-0 flex-col gap-0.5">
          <span class="text-muted">{{ 'profile.tokens.label' | translate }}</span>
          <span class="text-xs text-faint">{{ 'profile.tokens.hint' | translate }}</span>
        </div>
        @if (!creating()) {
          <button
            type="button"
            data-token-new
            (click)="startCreate()"
            [disabled]="tokens() === null || atLimit()"
            class="shrink-0 rounded-lg border border-border px-3 py-[7px] text-[13px] text-text-2 hover:border-border-strong disabled:opacity-60"
          >
            {{ 'profile.tokens.new' | translate }}
          </button>
        }
      </div>

      @if (atLimit()) {
        <p class="text-xs text-muted">
          {{ 'profile.tokens.limitReached' | translate: { max: maxTokens } }}
        </p>
      }

      @if (creating()) {
        <form
          (submit)="$event.preventDefault(); create()"
          novalidate
          class="flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <label for="token-name" class="sr-only">{{
            'profile.tokens.nameLabel' | translate
          }}</label>
          <input
            id="token-name"
            data-token-name
            type="text"
            autocomplete="off"
            [attr.maxlength]="nameMax"
            [value]="name()"
            (input)="name.set($any($event.target).value)"
            [placeholder]="'profile.tokens.nameLabel' | translate"
            class="h-[42px] min-w-0 flex-1 rounded-[10px] border border-border bg-surface px-3 text-[16px] text-text md:bg-bg md:text-[14px]"
          />
          <div class="flex gap-2">
            <button
              type="submit"
              data-token-create
              [disabled]="saving() || !canCreate()"
              class="flex-1 rounded-lg bg-brand px-3 py-[7px] text-[13px] font-semibold text-white hover:bg-brand-dark disabled:opacity-60 sm:flex-none"
            >
              {{ (saving() ? 'profile.tokens.creating' : 'profile.tokens.create') | translate }}
            </button>
            <button
              type="button"
              (click)="creating.set(false)"
              [disabled]="saving()"
              class="flex-1 rounded-lg border border-border px-3 py-[7px] text-[13px] text-text-2 hover:border-border-strong disabled:opacity-60 sm:flex-none"
            >
              {{ 'common.cancel' | translate }}
            </button>
          </div>
        </form>
      }

      @if (created(); as c) {
        <div
          class="flex flex-col gap-2.5 rounded-[10px] border border-gold-line bg-gold-tint px-4 py-3"
          data-token-created
          role="status"
        >
          <p class="text-[13px] leading-relaxed text-gold-tint-fg">
            {{ 'profile.tokens.copyWarning' | translate }}
          </p>
          <div class="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              readonly
              data-token-value
              [attr.aria-label]="'profile.tokens.tokenLabel' | translate: { name: c.name }"
              [value]="c.token"
              (focus)="$any($event.target).select()"
              class="h-[40px] min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 font-mono text-[13px] text-text"
            />
            <div class="flex gap-2">
              <button
                type="button"
                data-token-copy
                (click)="copy(c.token)"
                class="flex-1 rounded-lg border border-border px-3 py-[7px] text-[13px] text-text-2 hover:border-border-strong sm:flex-none"
              >
                {{ (copied() ? 'profile.tokens.copied' : 'profile.tokens.copy') | translate }}
              </button>
              <button
                type="button"
                data-token-done
                (click)="created.set(null)"
                class="flex-1 rounded-lg border border-border px-3 py-[7px] text-[13px] text-text-2 hover:border-border-strong sm:flex-none"
              >
                {{ 'profile.tokens.done' | translate }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (tokens(); as list) {
        @if (list.length) {
          <ul
            class="flex flex-col divide-y divide-divider rounded-[10px] border border-border"
            data-token-list
          >
            @for (token of list; track token.id) {
              <li class="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <div class="flex min-w-0 flex-col gap-0.5">
                  <span class="truncate text-text-2">{{ token.name }}</span>
                  <span class="truncate text-xs text-faint">
                    <span class="font-mono">{{ token.prefix }}…</span>
                    ·
                    {{
                      'profile.tokens.createdOn' | translate: { date: formatDate(token.createdAt) }
                    }}
                    ·
                    @if (token.lastUsedAt) {
                      {{
                        'profile.tokens.lastUsed'
                          | translate: { date: formatDate(token.lastUsedAt) }
                      }}
                    } @else {
                      {{ 'profile.tokens.neverUsed' | translate }}
                    }
                  </span>
                </div>
                <button
                  type="button"
                  data-token-revoke
                  (click)="revoke(token)"
                  [disabled]="revoking() === token.id"
                  class="shrink-0 text-[13px] text-danger hover:underline disabled:opacity-50"
                >
                  {{ 'profile.tokens.revoke' | translate }}
                </button>
              </li>
            }
          </ul>
        } @else {
          <p class="text-xs text-muted" data-token-empty>
            {{ 'profile.tokens.empty' | translate }}
          </p>
        }
      } @else if (loadFailed()) {
        <p class="text-xs text-danger" role="alert">
          {{ 'profile.tokens.errors.load' | translate }}
        </p>
      }
    </div>
  `,
})
export class AccessTokens {
  private readonly tokenService = inject(AccessTokenService);
  private readonly demoMode = inject(DemoModeService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  protected readonly maxTokens = MAX_ACCESS_TOKENS;
  protected readonly nameMax = ACCESS_TOKEN_NAME_MAX;

  /** `null` while loading (or when the list could not load). */
  protected readonly tokens = signal<AccessToken[] | null>(null);
  protected readonly loadFailed = signal(false);
  protected readonly atLimit = computed(() => (this.tokens()?.length ?? 0) >= MAX_ACCESS_TOKENS);

  protected readonly creating = signal(false);
  protected readonly name = signal(DEFAULT_ACCESS_TOKEN_NAME);
  protected readonly canCreate = computed(() => validTokenName(this.name()) !== null);
  protected readonly saving = signal(false);
  /** The token just created: its plaintext stays on screen until dismissed, and is never shown again. */
  protected readonly created = signal<CreatedAccessToken | null>(null);
  protected readonly copied = signal(false);
  protected readonly revoking = signal<number | null>(null);

  constructor() {
    this.load();
  }

  private load(): void {
    this.tokenService.list().subscribe({
      next: (tokens) => {
        this.tokens.set(tokens);
        this.loadFailed.set(false);
      },
      error: () => this.loadFailed.set(true),
    });
  }

  protected formatDate(iso: string | null): string {
    return formatTokenDate(iso, this.translate.currentLang() === 'en' ? 'en' : 'es') ?? '';
  }

  protected startCreate(): void {
    if (this.demoMode.blockWrite()) {
      return;
    }
    this.name.set(DEFAULT_ACCESS_TOKEN_NAME);
    this.creating.set(true);
  }

  protected create(): void {
    const name = validTokenName(this.name());
    if (!name || this.saving() || this.demoMode.blockWrite()) {
      return;
    }
    this.saving.set(true);
    this.tokenService.create(name).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.creating.set(false);
        this.copied.set(false);
        this.created.set(created);
        this.tokens.update((list) => [
          {
            id: created.id,
            name: created.name,
            prefix: created.token.slice(0, 12),
            createdAt: created.createdAt,
            lastUsedAt: null,
          },
          ...(list ?? []),
        ]);
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(this.translate.instant(accessTokenErrorKey(err)));
      },
    });
  }

  protected async copy(token: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(token);
      this.copied.set(true);
      this.toast.success(this.translate.instant('profile.tokens.copiedToast'));
    } catch {
      this.toast.error(this.translate.instant('profile.tokens.errors.copy'));
    }
  }

  protected revoke(token: AccessToken): void {
    if (this.revoking() !== null || this.demoMode.blockWrite()) {
      return;
    }
    if (!confirm(this.translate.instant('profile.tokens.revokeConfirm', { name: token.name }))) {
      return;
    }
    this.revoking.set(token.id);
    this.tokenService.revoke(token.id).subscribe({
      next: () => {
        this.revoking.set(null);
        this.tokens.update((list) => (list ?? []).filter((t) => t.id !== token.id));
        if (this.created()?.id === token.id) {
          this.created.set(null);
        }
        this.toast.success(this.translate.instant('profile.tokens.revoked'));
      },
      error: (err) => {
        this.revoking.set(null);
        this.toast.error(this.translate.instant(accessTokenErrorKey(err)));
      },
    });
  }
}
