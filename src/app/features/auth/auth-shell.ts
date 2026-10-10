import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { PytraMark } from '../../shared/ui/pytra-mark';

/**
 * Layout for the signed-out screens. Web (md+): 50/50 split with the brand panel on the left
 * (nav background, mark + wordmark, gold slogan header and headline) and the projected form
 * centred in a 380px column. Mobile: the same lockup above the form. The page background
 * stays transparent so the app's grid + aura layers show through.
 */
@Component({
  selector: 'app-auth-shell',
  imports: [TranslatePipe, PytraMark],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="grid min-h-dvh grid-cols-1 md:grid-cols-2">
      <aside class="hidden flex-col justify-between border-r border-border bg-nav p-10 md:flex lg:p-14">
        <div class="flex items-center gap-2.5 self-start" role="img" aria-label="Pytra">
          <app-pytra-mark class="size-[34px]" />
          <span class="text-[25px] leading-none font-semibold tracking-[-0.035em] text-text" aria-hidden="true">pytra</span>
        </div>
        <div>
          <div class="mb-[22px] flex items-center gap-3">
            <span class="text-[13px] font-semibold tracking-[0.04em] text-gold">
              {{ 'auth.panel.eyebrow' | translate }}
            </span>
            <span class="h-px w-[120px] bg-linear-to-r from-gold-line to-transparent" aria-hidden="true"></span>
          </div>
          <p class="max-w-[460px] text-[40px] leading-[1.05] font-semibold tracking-[-0.03em] lg:text-[48px]">
            {{ 'auth.panel.headline' | translate }}
          </p>
        </div>
        <span aria-hidden="true"></span>
      </aside>

      <main
        class="flex justify-center px-6 pt-[calc(env(safe-area-inset-top)+48px)] pb-[calc(env(safe-area-inset-bottom)+32px)] md:items-center md:px-10 md:py-12"
      >
        <div class="flex w-full max-w-[380px] flex-col gap-4 md:gap-[18px]">
          <!-- Mobile brand header: the side panel is hidden below md -->
          <div class="mb-4 flex flex-col gap-3 md:hidden">
            <div class="flex items-center gap-2.5 self-start" role="img" aria-label="Pytra">
              <app-pytra-mark class="size-9" />
              <span class="text-[26px] leading-none font-semibold tracking-[-0.035em] text-text" aria-hidden="true">pytra</span>
            </div>
            <div class="mt-3 flex items-center gap-3">
              <span class="text-xs font-semibold tracking-[0.04em] text-gold">
                {{ 'auth.panel.eyebrow' | translate }}
              </span>
              <span class="h-px flex-1 bg-linear-to-r from-gold-line to-transparent" aria-hidden="true"></span>
            </div>
            <p class="text-[26px] leading-[1.1] font-semibold tracking-[-0.02em]">
              {{ 'auth.panel.headline' | translate }}
            </p>
          </div>
          <ng-content />
        </div>
      </main>
    </div>
  `,
})
export class AuthShell {}
