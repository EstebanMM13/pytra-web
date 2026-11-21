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
import {
  SETTLED_RISE_PX,
  SHINE_DELAY_MS,
  SHINE_MS,
  SPLASH_BACKGROUND,
  SPLASH_FADE_OUT_START_MS,
  SPLASH_TOTAL_MS,
  emblemBox,
  sloganTokens,
} from './splash.logic';

/**
 * Brand intro, mounted by App when SplashGate says so (native cold start, once per web session): the mark appears exactly where the native splash
 * drew it (same size and centre, fully visible, so the handoff does not jump), then settles up and
 * shrinks over a soft glow while the wordmark and the slogan rise in word by word, then everything
 * fades out to the app. A light sweep crosses the mark once it has settled. Held on its first frame (animations and timer paused) while the system
 * splash is still up, so it starts from the exact frame the system splash showed. On the web
 * there is no system splash in front, so the overlay and the mark fade in instead. Renders nothing
 * Always on the dark brand purple, whatever the theme, so it
 * continues the native splash. Transform / opacity only; a tap skips it.
 */
/** The mark's silhouette (PytraMark geometry, bars as holes) as a CSS mask for the shine. */
const MARK_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<path fill-rule="evenodd" d="M22 12 Q14 8 14 18 V82 Q14 92 22 88 L86 56 Q94 50 86 44 Z ' +
    'M28 58h5a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-16a2 2 0 0 1 2-2Z ' +
    'M41 48h5a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-20a2 2 0 0 1 2-2Z ' +
    'M54 40h5a2 2 0 0 1 2 2v21a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-21a2 2 0 0 1 2-2Z"/>' +
    '<rect x="65" y="42" width="9" height="16" rx="2"/></svg>',
)}")`;

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
        [class.pt-splash-web]="!native"
        [style.background-color]="background"
        [style.animation-delay]="animationDelay"
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
          <span
            class="pt-splash-shine"
            data-splash-shine
            [style]="shineStyle"
          ></span>
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
      /* Delay(s) bound from SPLASH_FADE_OUT_START_MS. */
      animation: pt-splash-out 300ms cubic-bezier(0.4, 0, 1, 1) forwards;
    }

    /* Web: fade in over the app (no system splash in front), then the usual fade-out. */
    .pt-splash.pt-splash-web {
      animation:
        pt-splash-in 200ms ease-out,
        pt-splash-out 300ms cubic-bezier(0.4, 0, 1, 1) forwards;
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

    .pt-splash-web .pt-splash-mark {
      animation: pt-splash-mark-in 420ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
    }

    /* Light sweep, clipped to the mark's silhouette by a mask; delay / duration bound from
       SHINE_DELAY_MS / SHINE_MS. */
    .pt-splash-shine {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: linear-gradient(
        110deg,
        transparent 42%,
        rgba(255, 255, 255, 0.15) 46%,
        rgba(255, 255, 255, 0.8) 50%,
        rgba(255, 255, 255, 0.15) 54%,
        transparent 58%
      );
      background-size: 300% 100%;
      background-position: 100% 0;
      mask-size: 100% 100%;
      -webkit-mask-size: 100% 100%;
      mask-repeat: no-repeat;
      -webkit-mask-repeat: no-repeat;
      animation-name: pt-splash-shine;
      animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
      animation-fill-mode: both;
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

    @keyframes pt-splash-mark-in {
      from {
        opacity: 0;
        transform: scale(0.85);
      }
    }

    @keyframes pt-splash-shine {
      from {
        background-position: 100% 0;
      }
      to {
        background-position: 0% 0;
      }
    }

    @keyframes pt-splash-in {
      from {
        opacity: 0;
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
  protected readonly visible = signal(true);
  protected readonly native = isNativePlatform();
  /** Web runs the fade-in first (no delay), native only the fade-out. */
  protected readonly animationDelay = this.native
    ? `${SPLASH_FADE_OUT_START_MS}ms`
    : `0ms, ${SPLASH_FADE_OUT_START_MS}ms`;
  protected readonly shineStyle = {
    'mask-image': MARK_MASK,
    '-webkit-mask-image': MARK_MASK,
    'animation-delay': `${SHINE_DELAY_MS}ms`,
    'animation-duration': `${SHINE_MS}ms`,
  };
  protected readonly tokens = sloganTokens();
  protected readonly background = SPLASH_BACKGROUND;
  protected readonly box = emblemBox();
  protected readonly settleTransform = `translateY(${-SETTLED_RISE_PX}px) scale(${this.box.settleScale})`;

  protected readonly released = inject(LaunchSplash).released;

  constructor() {
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
