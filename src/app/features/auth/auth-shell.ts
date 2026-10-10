import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Layout for the signed-out screens. Web (md+): 50/50 split with the brand panel on the left
 * (nav background, lockup, gold slogan header and headline) and the projected form
 * centred in a 380px column. Mobile: purple mark (56px) above the form.
 */
@Component({
  selector: 'app-auth-shell',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="grid min-h-dvh grid-cols-1 bg-bg md:grid-cols-2">
      <aside class="hidden flex-col justify-between border-r border-border bg-nav p-10 md:flex lg:p-14">
        <img src="brand/lockup-horizontal-dark-bg.png" alt="Pytra" class="h-[34px] w-auto self-start light:hidden" />
        <img
          src="brand/lockup-horizontal-light-bg.png"
          alt="Pytra"
          class="hidden h-[34px] w-auto self-start light:block"
        />
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
          <img
            src="brand/mark-monochrome-purple-512.png"
            alt="Pytra"
            class="mb-[18px] size-14 self-start md:hidden"
          />
          <ng-content />
        </div>
      </main>
    </div>
  `,
})
export class AuthShell {}
