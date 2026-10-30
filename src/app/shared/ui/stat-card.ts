import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, type Params } from '@angular/router';
import { LucideDynamicIcon, LucideIconInput } from '@lucide/angular';
import { Sparkline } from './sparkline';
import { countUpValue, parseCountUp } from '../utils/count-up';
import { canAnimate } from '../utils/motion';
import { StatStrip } from './stat-strip';

/**
 * Label + big figure tile, one design for every screen size: label row on top (on phones it wraps to
 * two lines instead of truncating, so a large system font size keeps it readable), the figure on
 * its own line (never truncated: it shrinks with the card width instead) and, when there is a
 * trend, a full-width sparkline strip pinned to the bottom (or, with a `meter` and no trend, a thin
 * proportion bar of the same height). Cards stretched to a grid row keep
 * their label, figure and bottom edge aligned.
 */
@Component({
  selector: 'app-stat-card',
  imports: [LucideDynamicIcon, NgTemplateOutlet, RouterLink, Sparkline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-w-0',
    // Neutral glass tile by default; the rating tile (tone 'gold-tile') sits on a gold tint. Inside
    // an `app-stat-strip` the strip draws the frame: the card is a bare cell (gold-tile keeps its tint).
    '[class.rounded-xl]': '!inStrip',
    '[class.border]': '!inStrip',
    '[class.stat-cell]': 'inStrip',
    '[class.border-card-border]': "!inStrip && tone() !== 'gold-tile'",
    '[class.card-glass]': "!inStrip && tone() !== 'gold-tile'",
    '[class.border-gold-card-border]': "!inStrip && tone() === 'gold-tile'",
    '[class.bg-gold-tint]': "tone() === 'gold-tile'",
    // Linked cards lift on hover and shrink while pressed, like the other clickable cards.
    '[class.hover-lift]': 'link() !== null && !inStrip',
  },
  // Entrance: a short rise + fade, staggered across a row of cards (none with reduced motion).
  styles: `
    :host {
      animation: stat-card-in 320ms cubic-bezier(0, 0, 0.58, 1) backwards;
    }
    :host(:nth-child(2)) { animation-delay: 40ms; }
    :host(:nth-child(3)) { animation-delay: 80ms; }
    :host(:nth-child(4)) { animation-delay: 120ms; }
    :host(:nth-child(5)) { animation-delay: 160ms; }
    :host(:nth-child(n + 6)) { animation-delay: 200ms; }

    /* Strip cell: hairline dividers on the left and top edge; the strip clips its outer ones. */
    :host(.stat-cell) {
      box-shadow:
        -1px 0 0 var(--pt-card-border),
        0 -1px 0 var(--pt-card-border);
    }

    @keyframes stat-card-in {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
    }
  `,
  template: `
    @if (link(); as l) {
      <a [routerLink]="l" [queryParams]="queryParams()" class="block h-full rounded-xl" data-stat-link>
        <ng-container *ngTemplateOutlet="body" />
      </a>
    } @else {
      <ng-container *ngTemplateOutlet="body" />
    }
    <ng-template #body>
    <div class="@container flex h-full flex-col" [class]="layout().body">
      <p
        class="flex min-w-0 items-center gap-1.5 leading-4 text-text-3 md:gap-2 md:text-[13px] md:leading-5"
        [class]="layout().label"
        [class.justify-center]="centered()"
      >
        @if (icon(); as i) {
          <svg [lucideIcon]="i" [size]="15" class="size-3.5 shrink-0 md:size-[15px]" [style.color]="iconColor()"></svg>
        }
        @if (shortLabel(); as short) {
          <span class="line-clamp-2 wrap-break-word sm:hidden" [attr.title]="label()">{{ short }}</span>
          <span class="hidden truncate sm:inline">{{ label() }}</span>
        } @else {
          <span class="wrap-break-word max-sm:line-clamp-2 sm:truncate" [attr.title]="label()">{{ label() }}</span>
        }
      </p>
      <p
        class="font-bold tracking-[-0.03em] whitespace-nowrap"
        [class]="layout().figure"
        [class.text-center]="centered()"
        [style.font-size]="figureSize()"
      >
        <span data-figure [class]="valueClass()">{{ display() }}</span>
      </p>
      @if (hint()) {
        <p class="mt-1.5 line-clamp-2 text-[11px] leading-snug text-muted md:text-xs" [attr.title]="hint()">{{ hint() }}</p>
      }
      @switch (visual()) {
        @case ('trend') {
          <app-sparkline class="mt-auto h-5 w-full pt-2.5 md:h-7 md:pt-3" [values]="trend()!" [tone]="accent()" data-visual="trend" />
        }
        @case ('meter') {
          <!-- Same strip height as the sparkline, so cards with either visual line up. -->
          <div class="mt-auto flex h-5 w-full items-end pt-2.5 md:h-7 md:pt-3" aria-hidden="true" data-visual="meter">
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-hover">
              <div
                class="bar-fill h-full rounded-full"
                [class]="accent() === 'gold' ? 'bg-gold' : 'bg-brand-light'"
                [style.width.%]="meter()! * 100"
              ></div>
            </div>
          </div>
        }
      }
    </div>
    </ng-template>
  `,
})
export class StatCard {
  /** Drawn as a frameless cell of an `app-stat-strip` instead of a standalone tile. */
  protected readonly inStrip = inject(StatStrip, { optional: true }) !== null;

  readonly label = input.required<string>();
  /** Shown instead of `label` on narrow screens (< sm), where three cards share a row. */
  readonly shortLabel = input<string | null>(null);
  readonly value = input.required<string | number>();
  readonly icon = input<LucideIconInput | null>(null);
  /** Extra classes for the figure, e.g. `font-mono text-gold` for ratings. */
  readonly valueClass = input('');
  /** Optional small line under the value, e.g. a breakdown. */
  readonly hint = input<string | null>(null);
  /** Optional series (oldest first) drawn as a sparkline strip at the bottom; hidden with < 2 points. */
  readonly trend = input<readonly number[] | null>(null);
  /** Optional share (0..1) drawn as a thin proportion bar when there is no trend to draw. */
  readonly meter = input<number | null>(null);
  /** Centres the label and figure (cards of a row that should read as one set). */
  readonly centered = input(false, { transform: booleanAttribute });
  /**
   * Colour role: 'brand' (activity figures: purple sparkline / bar), 'gold' (ratings: gold
   * sparkline / bar), 'gold-tile' (the headline rating: gold visuals on a gold-tint tile) or
   * 'platinum' (platinum icon, brand visuals), 'completion' (100% icon, brand visuals) or
   * 'abandoned' (the abandoned status red icon, brand visuals).
   */
  readonly tone = input<'brand' | 'gold' | 'gold-tile' | 'platinum' | 'completion' | 'abandoned'>('brand');
  /**
   * Inner scale: 'default' (compact tiles of the dashboard / years / profile rows) or 'large'
   * (roomier padding, a bigger figure and vertically centred content, as the run detail stat cards).
   */
  readonly size = input<'default' | 'large'>('default');
  /** Makes the whole card a link (router commands), e.g. to the list behind the figure. */
  readonly link = input<string | readonly (string | number)[] | null>(null);
  /** Query params of `link`. */
  readonly queryParams = input<Params | null>(null);

  protected readonly layout = computed(() => STAT_CARD_LAYOUT[this.size()]);
  protected readonly visual = computed(() => statVisual(this.trend(), this.meter()));
  protected readonly accent = computed(() => (this.tone() === 'gold' || this.tone() === 'gold-tile' ? 'gold' : 'brand'));
  /**
   * Header icon: brand-hi for activity figures, gold for ratings, platinum / teal for the platinum /
   * 100% tiles, the abandoned status red (danger) for abandoned counts.
   */
  protected readonly iconColor = computed(() => {
    const tone = this.tone();
    if (tone === 'platinum') return 'var(--pt-platinum)';
    if (tone === 'completion') return 'var(--pt-completion)';
    if (tone === 'abandoned') return 'var(--pt-danger)';
    return this.accent() === 'gold' ? 'var(--pt-gold)' : 'var(--pt-brand-vivid)';
  });
  /** Sized from the final value (not the count-up frame) so the figure never jumps while animating. */
  protected readonly figureSize = computed(() => figureFontSize(String(this.value())));

  /** Text on screen: the exact formatted value, or an intermediate count-up frame. */
  protected readonly display = signal('');
  private animated = false;
  private frame = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => cancelFrame(this.frame));
    effect(() => {
      const value = this.value();
      untracked(() => this.render(value));
    });
  }

  private render(value: string | number): void {
    const final = String(value);
    cancelFrame(this.frame);
    const parsed = this.animated ? null : parseCountUp(final);
    this.animated = true;
    if (!parsed || parsed.target === 0 || !canAnimate()) {
      this.display.set(final);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      if (elapsed >= COUNT_UP_MS) {
        this.display.set(final);
        return;
      }
      this.display.set(parsed.format(countUpValue(parsed.target, elapsed, COUNT_UP_MS)));
      this.frame = requestAnimationFrame(step);
    };
    this.display.set(parsed.format(0));
    this.frame = requestAnimationFrame(step);
  }
}

const COUNT_UP_MS = 600;

/** Size-dependent classes of the card body, label row and figure (`--fig-max` caps the figure). */
const STAT_CARD_LAYOUT = {
  default: {
    body: 'p-3 [--fig-max:22px] md:px-[18px] md:py-4 md:[--fig-max:26px] lg:[--fig-max:28px]',
    label: 'text-[11px]',
    figure: 'mt-1.5 text-[22px] leading-[28px] md:mt-2 md:leading-[34px]',
  },
  large: {
    body: 'justify-center p-4 [--fig-max:30px] md:px-5 md:[--fig-max:36px]',
    label: 'text-xs',
    figure: 'mt-2 leading-none',
  },
} as const;

/** The small visual at the bottom of a stat card: a per-year sparkline, else a proportion bar, else none. */
export type StatVisual = 'trend' | 'meter' | 'none';

export function statVisual(trend: readonly number[] | null | undefined, meter: number | null | undefined): StatVisual {
  if ((trend?.length ?? 0) >= 2) return 'trend';
  return meter != null && Number.isFinite(meter) && meter >= 0 && meter <= 1 ? 'meter' : 'none';
}

/** Average advance of a bold figure glyph, in em (digits ~0.6, separators narrower, "h" wider). */
const FIGURE_EM_PER_CHAR = 0.62;

/**
 * CSS font-size for a figure: the card's `--fig-max`, shrunk so the whole text fits the
 * card's content width (`cqi` of the `@container` wrapper) instead of being cut with "…".
 */
export function figureFontSize(text: string, reservePx = 0): string {
  const chars = Math.max(1, Array.from(text).length);
  const ems = Math.round(chars * FIGURE_EM_PER_CHAR * 100) / 100;
  const width = reservePx > 0 ? `(100cqi - ${reservePx}px)` : '100cqi';
  return `min(var(--fig-max), calc(${width} / ${ems}))`;
}

function cancelFrame(id: number): void {
  if (id && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
}
