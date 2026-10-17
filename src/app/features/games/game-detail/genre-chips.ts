import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CollapseStateService } from '../../../core/services/collapse-state.service';

/** Genre chips the phone hero shows before folding the rest into "+N". */
export const HERO_GENRE_LIMIT = 2;

/** The first `limit` genres, plus how many are left for the "+N" chip. */
export function splitGenres(genres: readonly string[], limit = HERO_GENRE_LIMIT): { shown: string[]; hidden: number } {
  const max = Math.max(0, Math.floor(limit));
  return { shown: genres.slice(0, max), hidden: Math.max(0, genres.length - max) };
}

/**
 * How many chips of the given widths fit on one line of `available` px (chips `gap` px apart).
 * All of them when they fit; otherwise as many as fit next to the "+N" chip (`moreWidth`), at least
 * one so the line never shows only "+N". Unknown sizes (nothing laid out yet, or no layout engine)
 * show them all.
 */
export function fitChipCount(widths: readonly number[], available: number, gap: number, moreWidth: number): number {
  if (!(available > 0) || widths.length === 0) {
    return widths.length;
  }
  const lineWidth = (count: number) =>
    widths.slice(0, count).reduce((sum, w) => sum + w, 0) + Math.max(0, count - 1) * gap;
  if (lineWidth(widths.length) <= available) {
    return widths.length;
  }
  let count = widths.length - 1;
  while (count > 1 && lineWidth(count) + gap + moreWidth > available) {
    count--;
  }
  return Math.max(1, count);
}

/**
 * Genre chips of the game hero, so a long genre list never makes the hero taller than its cover.
 * Phones: at most two, then a "+N" chip that reveals the rest in place (fading in) and turns into a
 * "Ver menos" chip folding them back.
 * Web (`fit`): one line with as many chips as fit its width (measured, and again on resize), the
 * rest folded into "+N", which opens a popover (upwards: the hero clips overflow and the genres sit
 * at its bottom).
 */
@Component({
  selector: 'app-genre-chips',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'relative flex items-center gap-1.5 md:gap-2 ' + (fit() ? 'flex-nowrap' : 'flex-wrap')",
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'popover.set(false)',
  },
  styles: `
    @media (prefers-reduced-motion: no-preference) {
      .genre-reveal {
        animation: genre-reveal 220ms cubic-bezier(0, 0, 0.58, 1) backwards;
        animation-delay: calc(min(var(--i, 0), 10) * 30ms);
      }
    }

    @keyframes genre-reveal {
      from {
        opacity: 0;
        transform: translateY(-4px) scale(0.96);
      }
    }
  `,
  template: `
    @for (genre of visible(); track genre; let i = $index) {
      <span
        class="shrink-0 rounded-full border border-brand/25 bg-brand-tint font-medium whitespace-nowrap text-brand-lighter"
        [class]="chipClass()"
        [class.genre-reveal]="i >= split().shown.length"
        [style.--i]="i - split().shown.length"
      >
        {{ genre }}
      </span>
    }
    @if (split().hidden) {
      <button
        type="button"
        (click)="openAll()"
        class="shrink-0 rounded-full border border-border bg-surface/60 font-medium whitespace-nowrap text-text-2 hover:border-border-strong hover:text-text"
        [class]="chipClass()"
        [class.genre-reveal]="expanded()"
        [style.--i]="split().hidden"
        [attr.aria-haspopup]="wide() ? 'dialog' : null"
        [attr.aria-expanded]="wide() ? popover() : expanded()"
        [attr.aria-label]="expanded() ? null : ('game.allGenres' | translate: { count: genres().length })"
        data-more-genres
      >
        {{ expanded() ? ('game.showLessGenres' | translate) : '+' + split().hidden }}
      </button>
    }
    @if (fit()) {
      <!-- Off-screen copies of every chip (and a "+N") to measure what fits the line. -->
      <div
        #measure
        class="pointer-events-none invisible absolute top-0 left-0 flex gap-1.5 whitespace-nowrap md:gap-2"
        aria-hidden="true"
      >
        @for (genre of genres(); track genre) {
          <span class="rounded-full border font-medium" [class]="chipClass()" data-measure-chip>{{ genre }}</span>
        }
        <span class="rounded-full border font-medium" [class]="chipClass()" data-measure-more>+{{ genres().length }}</span>
      </div>
    }
    @if (popover()) {
      <div
        role="dialog"
        [attr.aria-label]="'game.genre' | translate"
        class="absolute bottom-full left-0 z-30 mb-2 w-max max-w-[320px] animate-modal-in rounded-xl border border-border bg-surface p-3 shadow-[0_12px_32px_#0006]"
        data-genre-popover
      >
        <ul class="flex flex-wrap gap-1.5">
          @for (genre of genres(); track genre) {
            <li class="rounded-full border border-brand/25 bg-brand-tint px-2.5 py-0.5 text-xs font-medium text-brand-lighter">
              {{ genre }}
            </li>
          }
        </ul>
      </div>
    }
  `,
})
export class GenreChips {
  /** Display names, already sorted. */
  readonly genres = input.required<readonly string[]>();
  /** Chip size: compact beside the cover on phones, roomier in the web hero. */
  readonly size = input<'sm' | 'md'>('sm');
  /** One line fitted to the available width (web) instead of the fixed two chips (phones). */
  readonly fit = input(false, { transform: booleanAttribute });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly wide = inject(CollapseStateService).atLeast('md');
  private readonly measureBox = viewChild<ElementRef<HTMLElement>>('measure');

  /** Chips that fit the line in `fit` mode; all until measured. */
  private readonly fitCount = signal(Number.POSITIVE_INFINITY);

  protected readonly split = computed(() =>
    splitGenres(this.genres(), this.fit() ? this.fitCount() : HERO_GENRE_LIMIT),
  );
  protected readonly chipClass = computed(() =>
    this.size() === 'md' ? 'px-3 py-1 text-[13px]' : 'px-2.5 py-0.5 text-xs',
  );
  protected readonly popover = signal(false);
  /** Phones: the folded genres shown in place. */
  protected readonly expanded = signal(false);
  /** Chips on screen: the split's, or every genre once expanded. */
  protected readonly visible = computed(() => (this.expanded() ? this.genres() : this.split().shown));

  constructor() {
    // Crossing md swaps popover and inline expansion: reset both rather than show the wrong one.
    let wasWide = this.wide();
    effect(() => {
      const wide = this.wide();
      if (wide !== wasWide) {
        wasWide = wide;
        this.popover.set(false);
        this.expanded.set(false);
      }
    });

    // Re-measure when the genres change and whenever the line's width changes.
    effect(() => {
      this.genres();
      if (this.fit()) afterNextRender(() => this.measure(), { injector: this.injector });
    });
    afterNextRender(() => {
      if (typeof ResizeObserver !== 'function') return;
      const observer = new ResizeObserver(() => this.measure());
      observer.observe(this.host);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private measure(): void {
    const box = this.measureBox()?.nativeElement;
    if (!this.fit() || !box) return;
    const width = (el: Element | null) => el?.getBoundingClientRect?.().width ?? 0;
    const chips = Array.from(box.querySelectorAll('[data-measure-chip]'), (el) => width(el));
    const gap = Number.parseFloat(getComputedStyle(this.host).columnGap) || 8;
    this.fitCount.set(fitChipCount(chips, this.host.clientWidth, gap, width(box.querySelector('[data-measure-more]'))));
  }

  protected openAll(): void {
    if (this.wide()) {
      this.popover.update((open) => !open);
    } else {
      this.expanded.update((open) => !open);
    }
  }

  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (this.popover() && target?.isConnected && !this.host.contains(target)) {
      this.popover.set(false);
    }
  }
}
