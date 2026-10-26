import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { GameService } from '../../core/services/game.service';
import { TokenStorageService } from '../../core/services/token-storage.service';
import { backdropCoverChain, backdropGames } from './playing-backdrop.logic';

/** One strip of the background: a game's cover, or the aura colours when it has none that loads. */
export interface BackdropStrip {
  id: number;
  /** Image being tried; null once the game has no cover left to try (aura-coloured fallback). */
  src: string | null;
  /** Ready to fade in: its image loaded, or it is a fallback strip. */
  shown: boolean;
}

/**
 * Background made of the covers of the games in progress (see `backdropGames`): one strip per game,
 * columns side by side from md up, stacked rows on phones, very blurred under a theme veil and
 * blended into each other through soft mask gradients. Fixed to the viewport behind everything,
 * over the app's aura, which shows again when no game is in progress. Reads the cached library
 * (no request when a screen already loaded it) and follows its updates, so a saved run changes the
 * strips without a reload.
 */
@Component({
  selector: 'app-playing-backdrop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[style.--n]': 'strips().length' },
  template: `
    @for (strip of strips(); track strip.id; let i = $index) {
      <div
        class="strip"
        [class.shown]="strip.shown"
        [class.cover]="strip.src !== null"
        [style.--i]="i"
        data-backdrop-strip
      >
        @if (strip.src; as src) {
          <img
            [src]="src"
            alt=""
            decoding="async"
            fetchpriority="low"
            (load)="onLoad(src)"
            (error)="onError(src)"
          />
        }
      </div>
    }
  `,
  styles: `
    /*
     * A fixed, composited layer: the blur is rasterised once and scrolling only moves the content
     * above it. Sized to the large viewport so a mobile toolbar showing / hiding on scroll never
     * resizes (and re-blurs) it.
     */
    :host {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100vh;
      height: 100lvh;
      z-index: -1;
      overflow: hidden;
      pointer-events: none;
      contain: strict;
      transform: translateZ(0);
      --o: 3lvh;
      --blur: 14px;
    }

    /* Phones: rows. Each strip after the first fades in over the previous one's overlap. */
    .strip {
      position: absolute;
      left: 0;
      right: 0;
      top: calc(var(--i) * 100% / var(--n) - var(--o));
      height: calc(100% / var(--n) + 2 * var(--o));
      overflow: hidden;
      opacity: 0;
      -webkit-mask-image: linear-gradient(to bottom, transparent, #000 calc(2 * var(--o)));
      mask-image: linear-gradient(to bottom, transparent, #000 calc(2 * var(--o)));
      background:
        radial-gradient(
          90% 70% at 30% 40%,
          color-mix(in srgb, var(--pt-brand-vivid) var(--pt-blob), transparent),
          transparent 70%
        ),
        var(--pt-bg);
    }

    .strip:first-child {
      top: 0;
      height: calc(100% / var(--n) + var(--o));
      -webkit-mask-image: none;
      mask-image: none;
    }

    .strip:last-child {
      bottom: 0;
      height: auto;
    }

    @media (width >= 48rem) {
      :host {
        --o: 3vw;
        --blur: 22px;
      }

      .strip,
      .strip:first-child,
      .strip:last-child {
        top: 0;
        bottom: 0;
        height: auto;
        right: auto;
        left: calc(var(--i) * 100% / var(--n) - var(--o));
        width: calc(100% / var(--n) + 2 * var(--o));
        -webkit-mask-image: linear-gradient(to right, transparent, #000 calc(2 * var(--o)));
        mask-image: linear-gradient(to right, transparent, #000 calc(2 * var(--o)));
      }

      .strip:first-child {
        left: 0;
        width: calc(100% / var(--n) + var(--o));
        -webkit-mask-image: none;
      mask-image: none;
      }

      .strip:last-child {
        right: 0;
        width: auto;
      }
    }

    .strip.shown {
      opacity: 1;
      animation: pt-backdrop-in 900ms ease-out both;
    }

    /* Bleeds past the strip so the blur's soft edge is clipped away. */
    img {
      position: absolute;
      top: calc(-3 * var(--blur));
      left: calc(-3 * var(--blur));
      width: calc(100% + 6 * var(--blur));
      height: calc(100% + 6 * var(--blur));
      object-fit: cover;
      object-position: center;
      filter: blur(var(--blur));
    }

    /* Theme veil: keeps the covers a faint tint, as subtle as the aura. */
    .strip.cover::after {
      content: '';
      position: absolute;
      inset: 0;
      background: color-mix(in srgb, var(--pt-bg) var(--pt-backdrop-veil), transparent);
    }

    @keyframes pt-backdrop-in {
      from {
        opacity: 0;
      }
    }
  `,
})
export class PlayingBackdrop {
  private readonly games = inject(GameService);
  private readonly token = inject(TokenStorageService).token;
  private readonly loaded = signal<ReadonlySet<string>>(new Set());
  private readonly failed = signal<ReadonlySet<string>>(new Set());

  protected readonly strips = computed<BackdropStrip[]>(() => {
    const loaded = this.loaded();
    const failed = this.failed();
    return backdropGames(this.games.latestAll() ?? []).map((game) => {
      const src = backdropCoverChain(game.coverImageUrl).find((url) => !failed.has(url)) ?? null;
      return { id: game.id, src, shown: src === null || loaded.has(src) };
    });
  });

  constructor() {
    let request: Subscription | null = null;
    let firstRun = true;
    // Loads the library when no screen has yet (nothing is requested when it is already cached),
    // then again after every write, so the strips follow a saved run. A screen reloading the list
    // at the same time shares the request.
    effect(() => {
      this.games.invalidationCount();
      const signedIn = this.token() !== null;
      untracked(() => {
        const needed = signedIn && (!firstRun || this.games.latestAll() === null);
        firstRun = false;
        if (needed) {
          request?.unsubscribe();
          request = this.games.findAll().subscribe({ error: () => {} });
        }
      });
    });
    inject(DestroyRef).onDestroy(() => request?.unsubscribe());
  }

  protected onLoad(src: string): void {
    this.loaded.update((set) => new Set(set).add(src));
  }

  protected onError(src: string): void {
    this.failed.update((set) => new Set(set).add(src));
  }
}
