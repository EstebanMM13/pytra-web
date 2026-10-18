import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { PytraMark } from '../../shared/ui/pytra-mark';
import { PytraWordmark } from '../../shared/ui/pytra-wordmark';

/**
 * Layout for the signed-out screens. Web (md+): 50/50 split with the brand panel on the left
 * (nav background, mark + wordmark, the "Play / Track / Remember" slogan as the hero with a one-line
 * pitch below) and the projected form centred in a 380px column. Mobile: the lockup and a compact
 * hero above the form over a fixed backdrop with the panel's glows and watermark mark. The page
 * background stays transparent so the app's grid + aura layers show through.
 */
@Component({
  selector: 'app-auth-shell',
  imports: [NgTemplateOutlet, TranslatePipe, PytraMark, PytraWordmark],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <!-- Mobile: the brand panel's glows + watermark become a fixed backdrop behind the form -->
    <div class="pointer-events-none fixed inset-0 overflow-hidden md:hidden" aria-hidden="true">
      <div
        class="absolute inset-0 bg-[radial-gradient(420px_360px_at_0%_0%,color-mix(in_srgb,var(--pt-brand)_30%,transparent),transparent_70%),radial-gradient(380px_320px_at_100%_100%,color-mix(in_srgb,var(--pt-gold)_14%,transparent),transparent_70%)] light:opacity-70"
      ></div>
      <app-pytra-mark class="absolute -right-28 -bottom-20 size-[360px] rotate-[-12deg] opacity-[0.06] light:opacity-[0.05]" />
    </div>

    <div class="relative grid min-h-dvh grid-cols-1 md:grid-cols-2">
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

        <div class="relative flex items-center gap-4 self-start">
          <app-pytra-mark class="size-16 drop-shadow-[0_8px_24px_rgba(114,77,206,0.45)]" />
          <app-pytra-wordmark class="text-[52px] font-bold tracking-[-0.04em]" />
        </div>

        <div class="relative">
          <ng-container *ngTemplateOutlet="slogan; context: { $implicit: 'hero--panel' }" />
          <p class="tagline tagline--panel max-w-[480px] text-text-2">{{ 'auth.panel.tagline' | translate }}</p>
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
        class="relative flex justify-center px-6 pt-[calc(env(safe-area-inset-top)+48px)] pb-[calc(env(safe-area-inset-bottom)+32px)] md:items-center md:px-10 md:py-12"
      >
        <div class="flex w-full max-w-[380px] flex-col gap-4 md:gap-[18px]">
          <!-- Mobile brand header: the side panel is hidden below md -->
          <div class="mb-5 flex flex-col gap-3 md:hidden">
            <div class="flex items-center gap-3 self-start">
              <app-pytra-mark class="size-12 drop-shadow-[0_6px_18px_rgba(114,77,206,0.4)]" />
              <app-pytra-wordmark class="text-[36px] font-bold tracking-[-0.04em]" />
            </div>
            <ng-container *ngTemplateOutlet="slogan; context: { $implicit: 'hero--compact' }" />
            <p class="tagline text-text-2">{{ 'auth.panel.tagline' | translate }}</p>
          </div>
          <ng-content />
        </div>
      </main>
    </div>

    <!-- The slogan, one word per line; "Remember" takes the brand accent (gradient in dark mode). -->
    <ng-template #slogan let-size>
      <p class="hero" [class]="size">
        <span class="hero-word">Play</span>
        <span class="hero-word">Track</span>
        <span class="hero-word text-figure text-brand-light">Remember</span>
      </p>
    </ng-template>
  `,
  // Scoped here (not in the global stylesheet) so the hero only ships with the lazy auth pages.
  styles: `
    .hero {
      margin: 0;
      font-family: var(--font-display);
      font-optical-sizing: auto;
      font-weight: 700;
      letter-spacing: -0.04em;
      line-height: 0.92;
    }
    .hero--compact {
      margin-top: 0.75rem;
      font-size: 2.25rem;
    }
    .hero--panel {
      font-size: clamp(3.75rem, 6.4vw, 6rem);
    }
    .hero-word {
      display: block;
      /* Room for descenders and the gradient clip at the tight line height. */
      padding-bottom: 0.04em;
      animation: hero-word-in 560ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
    }
    .hero-word:nth-child(2) {
      animation-delay: 90ms;
    }
    .hero-word:nth-child(3) {
      animation-delay: 180ms;
    }
    .tagline {
      margin-top: 0.75rem;
      font-size: 0.875rem;
      line-height: 1.45;
    }
    .tagline--panel {
      margin-top: 1.5rem;
      font-size: 1.125rem;
    }
    /* Disabled with every other entrance by the global motion gate (data-motion="reduce"). */
    @keyframes hero-word-in {
      from {
        opacity: 0;
        transform: translateY(0.25em);
      }
    }
  `,
})
export class AuthShell {
  protected readonly panelPoints = ['auth.panel.point1', 'auth.panel.point2', 'auth.panel.point3'];
}
