import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ViewEncapsulation,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { LaunchSplash } from '../../core/services/launch-splash.service';
import { isNativePlatform } from '../../core/native-platform';
import { PytraMark } from '../ui/pytra-mark';
import { PytraWordmark } from '../ui/pytra-wordmark';
import { prefersReducedMotion } from '../utils/motion';
import {
  SETTLED_RISE_PX,
  SPLASH_BACKGROUND,
  SPLASH_FADE_OUT_START_MS,
  SPLASH_TOTAL_MS,
  emblemBox,
  shouldShowSplash,
  sloganTokens,
} from './splash.logic';

/**
 * Native cold-start intro (see splash.logic.ts): the mark appears exactly where the native splash
 * drew it (same size and centre, fully visible, so the handoff does not jump), then settles up and
 * shrinks over a soft glow while the wordmark and the slogan rise in word by word, then everything
 * fades out to the app. Held on its first frame (animations and timer paused) while the system
 * splash is still up, so it starts from the exact frame the system splash showed. Renders nothing
 * on the web or with reduced motion. Always on the dark brand purple, whatever the theme, so it
 * continues the native splash. Transform / opacity only; a tap skips it.
 */
@Component({
  selector: 'app-splash-overlay',
  imports: [PytraMark, PytraWordmark],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Unscoped (prefixed `pt-splash`) so it can pin the brand colours of the mark / wordmark.
  encapsulation: ViewEncapsulation.None,
  template: `
    @if (visible()) {
      <div
        class="pt-splash"
        aria-hidden="true"
        data-splash
        [class.pt-splash-held]="!released()"
        [style.background-color]="background"
        [style.animation-delay.ms]="fadeOutStart"
        (pointerdown)="dismiss()"
      >
        <div
          class="pt-splash-emblem"
          data-splash-emblem
          [style.width.px]="box.size"
          [style.height.px]="box.size"
          [style.left]="'calc(50% + ' + box.left + 'px)'"
          [style.top]="'calc(50% + ' + box.top + 'px)'"
          [style.transform-origin]="box.origin"
          [style.--pt-splash-settle]="settleTransform"
        >
          <span class="pt-splash-glow"></span>
          <app-pytra-mark class="pt-splash-mark" />
        </div>
        <div class="pt-splash-text" [style.top]="'calc(50% + ' + box.textTop + 'px)'">
          <app-pytra-wordmark class="pt-splash-word" />
          <p class="pt-splash-slogan">
            @for (token of tokens; track $index) {
              <span [class.pt-splash-sep]="token.separator" [style.animation-delay.ms]="token.delayMs">{{ token.text }}</span>
            }
          </p>
        </div>
      </div>
    }
  `,
  styles: `
    .pt-splash {
      position: fixed;
      inset: 0;
      z-index: 1000;
      color: #f7f3ea;
      /* Delay bound from SPLASH_FADE_OUT_START_MS. */
      animation: pt-splash-out 300ms cubic-bezier(0.4, 0, 1, 1) forwards;
    }

    /* System splash still up: hold the first frame. */
    .pt-splash-held,
    .pt-splash-held * {
      animation-play-state: paused !important;
    }

    /* Size, position and origin bound from emblemBox(): starts at the native splash icon. */
    .pt-splash-emblem {
      position: absolute;
      animation: pt-splash-settle 560ms cubic-bezier(0.22, 1, 0.36, 1) 120ms forwards;
    }

    .pt-splash-glow {
      position: absolute;
      /* ~70px around the settled 88px mark (the box shrinks to ~0.77). */
      inset: -92px;
      border-radius: 50%;
      background: radial-gradient(closest-side, #9d7cff73, #724dce26 55%, transparent);
      opacity: 0;
      animation: pt-splash-glow 900ms cubic-bezier(0.22, 1, 0.36, 1) 80ms forwards;
    }

    .pt-splash-mark {
      position: relative;
      width: 100%;
      height: 100%;
      color: #9d7cff;
    }

    .pt-splash-mark rect {
      fill: #e2ae5f;
    }

    .pt-splash-text {
      position: absolute;
      left: 0;
      right: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
    }

    .pt-splash-word {
      color: #f7f3ea;
      font-family: var(--font-display);
      font-size: 40px;
      font-weight: 700;
      letter-spacing: -0.02em;
      animation: pt-splash-rise 360ms cubic-bezier(0.22, 1, 0.36, 1) 340ms backwards;
    }

    .pt-splash-word span span {
      color: #9d7cff;
    }

    .pt-splash-slogan {
      display: flex;
      gap: 7px;
      margin: 0;
      color: #b0aba1;
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .pt-splash-slogan span {
      animation: pt-splash-rise 240ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
    }

    .pt-splash-slogan .pt-splash-sep {
      color: #e2ae5f;
    }

    @keyframes pt-splash-settle {
      to {
        transform: var(--pt-splash-settle);
      }
    }

    @keyframes pt-splash-glow {
      from {
        opacity: 0;
        transform: scale(0.6);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes pt-splash-rise {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
    }

    @keyframes pt-splash-out {
      to {
        opacity: 0;
        transform: scale(1.02);
      }
    }
  `,
})
export class SplashOverlay {
  protected readonly visible = signal(shouldShowSplash(isNativePlatform(), prefersReducedMotion()));
  protected readonly tokens = sloganTokens();
  protected readonly background = SPLASH_BACKGROUND;
  protected readonly fadeOutStart = SPLASH_FADE_OUT_START_MS;
  protected readonly box = emblemBox();
  protected readonly settleTransform = `translateY(${-SETTLED_RISE_PX}px) scale(${this.box.settleScale})`;

  protected readonly released = inject(LaunchSplash).released;

  constructor() {
    if (!this.visible()) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    // The intro clock starts when the system splash leaves, like the CSS animations.
    effect(() => {
      if (this.released() && timer === undefined) {
        timer = untracked(() => setTimeout(() => this.dismiss(), SPLASH_TOTAL_MS));
      }
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }

  protected dismiss(): void {
    this.visible.set(false);
  }
}
