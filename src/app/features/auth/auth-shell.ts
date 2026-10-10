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
      <aside
        class="relative hidden flex-col justify-between overflow-hidden border-r border-card-border bg-nav p-10 md:flex lg:p-14"
      >
        <!-- Brand glow + oversized mark watermark give the panel its own identity -->
        <div
          class="pointer-events-none absolute inset-0 bg-[radial-gradient(620px_420px_at_0%_0%,color-mix(in_srgb,var(--pt-brand)_38%,transparent),transparent_70%),radial-gradient(520px_380px_at_100%_100%,color-mix(in_srgb,var(--pt-gold)_16%,transparent),transparent_70%)]"
          aria-hidden="true"
        ></div>
        <app-pytra-mark
          class="pointer-events-none absolute -right-24 -bottom-24 size-[460px] rotate-[-12deg] opacity-[0.07]"
          aria-hidden="true"
        />

        <div class="relative flex items-center gap-4 self-start" role="img" aria-label="Pytra">
          <app-pytra-mark class="size-16 drop-shadow-[0_8px_24px_rgba(114,77,206,0.45)]" />
          <span class="text-[52px] leading-none font-bold tracking-[-0.04em] text-text" aria-hidden="true">Pytra</span>
        </div>

        <div class="relative">
          <div class="mb-6 flex items-center gap-3">
            <span class="text-[15px] font-semibold tracking-[0.04em] text-gold">
              {{ 'auth.panel.eyebrow' | translate }}
            </span>
            <span class="h-px w-[140px] bg-linear-to-r from-gold-line to-transparent" aria-hidden="true"></span>
          </div>
          <p class="max-w-[480px] text-[44px] leading-[1.03] font-semibold tracking-[-0.03em] lg:text-[54px]">
            {{ 'auth.panel.headline' | translate }}
          </p>
        </div>

        <ul class="relative flex flex-wrap gap-2.5 text-[13px] text-text-2">
          @for (key of panelPoints; track key) {
            <li class="rounded-full border border-card-border bg-surface/60 px-3.5 py-1.5 backdrop-blur-sm">
              {{ key | translate }}
            </li>
          }
        </ul>
      </aside>

      <main
        class="flex justify-center px-6 pt-[calc(env(safe-area-inset-top)+48px)] pb-[calc(env(safe-area-inset-bottom)+32px)] md:items-center md:px-10 md:py-12"
      >
        <div class="flex w-full max-w-[380px] flex-col gap-4 md:gap-[18px]">
          <!-- Mobile brand header: the side panel is hidden below md -->
          <div class="mb-4 flex flex-col gap-3 md:hidden">
            <div class="flex items-center gap-2.5 self-start" role="img" aria-label="Pytra">
              <app-pytra-mark class="size-9" />
              <span class="text-[26px] leading-none font-semibold tracking-[-0.035em] text-text" aria-hidden="true">Pytra</span>
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
export class AuthShell {
  protected readonly panelPoints = ['auth.panel.point1', 'auth.panel.point2', 'auth.panel.point3'];
}
