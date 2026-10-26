import { ChangeDetectionStrategy, booleanAttribute, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface MiniBar {
  key: string | number;
  /** Bar magnitude; heights are relative to the largest value. */
  value: number;
  /** Text under the bar, e.g. an abbreviated year. */
  label: string;
  /** Longer form of `label` (e.g. the full year) for charts with room for it; see RecentBarChart. */
  fullLabel?: string;
  /** Optional text above the bar, e.g. the year's average rating (gold mono). */
  topLabel?: string | null;
  /** Optional second line under the label, e.g. the bar's hours. */
  subLabel?: string | null;
  /** Accessible description of the bar (also the name of its link). */
  title?: string;
  /** Route the bar links to (e.g. `/years/2024`); the whole column (or row) becomes the link. */
  link?: string;
  /** Short value shown over the bar top while it is highlighted (hover, focus or press), e.g. "120,5 h". */
  hint?: string;
}

/** Smallest share of the plot a non-zero bar takes, so it stays visible. */
const MIN_BAR_RATIO = 0.02;

/** Each bar's height as a share (0..1) of the tallest one; non-zero values never drop below a sliver. */
export function barRatios(values: readonly number[]): number[] {
  const max = Math.max(0, ...values);
  return values.map((value) => (max > 0 && value > 0 ? Math.max(MIN_BAR_RATIO, value / max) : 0));
}

/** Vertical columns, or horizontal rows stacked top to bottom (long series on narrow screens). */
export type BarOrientation = 'vertical' | 'horizontal';

/**
 * Dependency-free bar chart built with divs.
 * Vertical: each column is a plot area (the label above the bar plus the bar) over the labels; the
 * plot takes the column's remaining height, so the chart needs a definite height: `height` in px, or
 * null to fill a parent that has one.
 * Horizontal: one row per bar (label, bar, then sub and top labels), as tall as its rows; `height`
 * does not apply.
 * Bars with a `link` get a stretched link over their column (or row). Vertical linked bars light up
 * (and the others dim) on mouse hover, keyboard focus and press, showing their `hint`.
 * `expressive` opts into the gradient look with a springier grow-in.
 */
@Component({
  selector: 'app-mini-bar-chart',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'list',
    '[style.height.px]': 'vertical() ? height() : null',
    '[class.h-full]': 'vertical() && height() === null',
    // Filling a parent whose height turns out indefinite would collapse the bars: keep a floor.
    '[style.min-height.px]': 'vertical() && height() === null ? minHeight() : null',
    '[class]': 'hostClass()',
    '[class.mbc-has-active]': 'activeKey() !== null',
  },
  template: `
    @if (!vertical()) {
      @for (bar of normalized(); track bar.key) {
        <div
          class="flex items-center gap-3 text-[13px]"
          [class.relative]="!!bar.link"
          role="listitem"
          [attr.aria-label]="bar.title ?? bar.label"
          data-row
        >
          <span class="w-10 shrink-0 text-muted tabular-nums">{{ bar.label }}</span>
          <div class="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-hover">
            <div
              class="bar-fill h-full rounded-full"
              [class]="bar.top ? 'bg-brand-light' : 'bg-brand'"
              [style.width.%]="bar.ratio * 100"
              [attr.data-ratio]="bar.ratio"
            ></div>
          </div>
          <span class="w-[92px] shrink-0 text-right font-mono text-xs whitespace-nowrap">
            @if (bar.subLabel) {
              <span class="text-faint">{{ bar.subLabel }}</span>
            }
            @if (bar.topLabel) {
              <span class="ml-2" [class]="topTone() === 'gold' ? 'text-gold' : 'text-muted'">{{ bar.topLabel }}</span>
            }
          </span>
          @if (bar.link) {
            <a class="mbc-link" [routerLink]="bar.link" [attr.aria-label]="bar.title ?? bar.label" data-bar-link></a>
          }
        </div>
      }
    } @else {
      @for (bar of normalized(); track bar.key; let i = $index) {
        <div
          class="flex min-w-0 flex-1 flex-col items-center"
          [class]="dense() ? 'gap-[5px]' : 'gap-1.5'"
          [class.relative]="!!bar.link"
          [class.mbc-col]="expressive()"
          [class.is-active]="activeKey() === bar.key"
          role="listitem"
          [attr.aria-label]="bar.title ?? bar.label"
        >
          <div class="relative flex min-h-0 w-full flex-1 flex-col items-center justify-end" [class]="dense() ? 'gap-[3px]' : 'gap-1'" data-plot>
            @if (bar.topLabel) {
              <span
                class="shrink-0 font-mono leading-none"
                [class]="(large() ? 'text-[13px] ' : 'text-[10px] md:text-[11px] ') + (topTone() === 'gold' ? 'text-gold' : 'text-muted')"
              >{{ bar.topLabel }}</span>
            }
            <!-- The bar fills its share of the plot left after the top labels' row. -->
            <div
              class="bar-grow w-full shrink-0"
              [class]="barClass(bar.top)"
              [style.height]="'calc((100% - ' + topReserve() + 'px) * ' + bar.ratio + ')'"
              [style.animation-delay.ms]="i * (expressive() ? 70 : 40)"
              [attr.data-ratio]="bar.ratio"
            ></div>
            @if (bar.link && bar.hint) {
              <!-- Floats over the bar top while highlighted; out of the flow, so nothing shifts.
                   Never above the plot (a tall bar takes it over its own top) nor past the chart's
                   sides (the end bars align it to their outer edge), so nothing clips or scrolls. -->
              <span
                class="mbc-hint inline-flex items-center rounded-md border border-card-border bg-surface px-1.5 font-mono leading-none whitespace-nowrap text-text"
                [class]="large() ? 'h-[18px] text-xs' : 'h-[17px] text-[11px]'"
                [class.mbc-hint-start]="$first && !$last"
                [class.mbc-hint-end]="$last && !$first"
                [style.bottom]="
                  'min(calc((100% - ' + topReserve() + 'px) * ' + bar.ratio + ' + 4px), calc(100% - ' + (large() ? 18 : 17) + 'px))'
                "
                aria-hidden="true"
                data-hint
              >{{ bar.hint }}</span>
            }
          </div>
          <span
            class="shrink-0 whitespace-nowrap"
            [class]="(bar.top ? 'text-text ' : 'text-muted ') +(dense() ? 'text-[10px]' : large() ? 'text-sm' : 'text-xs')"
          >
            {{ bar.label }}
          </span>
          @if (bar.subLabel) {
            <span class="-mt-1 shrink-0 font-mono text-faint" [class]="large() ? 'text-[13px]' : 'text-[10px] md:text-[11px]'">{{
              bar.subLabel
            }}</span>
          }
          @if (bar.link) {
            <!-- Stretched over the column: one keyboard stop per bar, the whole column is the target. -->
            <a
              class="mbc-link"
              [routerLink]="bar.link"
              [attr.aria-label]="bar.title ?? bar.label"
              (focus)="activeKey.set(bar.key)"
              (blur)="release(bar.key)"
              (pointerenter)="hover($event, bar.key)"
              (pointerdown)="activeKey.set(bar.key)"
              (pointerleave)="release(bar.key)"
              (pointercancel)="release(bar.key)"
              data-bar-link
            ></a>
          }
        </div>
      }
    }
  `,
  styles: `
    /*
     * Stretched link over its row / column, with the focus ring around it. Within its box: one
     * reaching past the chart would make a scrolling parent (the "Ver todos" sheet) scroll sideways.
     */
    .mbc-link {
      position: absolute;
      inset: 0;
      z-index: 1;
      border-radius: 8px;
      -webkit-tap-highlight-color: transparent;
    }
    .mbc-link:focus-visible {
      outline: 2px solid var(--pt-brand);
      outline-offset: 2px;
    }

    /* Expressive bars: the same brand gradient on every bar, deeper at the base. */
    .mbc-col {
      --mbc-base: var(--pt-brand-dark);
      --mbc-tip: var(--pt-brand-light);
      transition: opacity calc(180ms * var(--pt-motion, 1)) ease-out;
    }
    :host-context([data-theme='light']) .mbc-col {
      --mbc-tip: color-mix(in oklab, var(--pt-brand) 68%, white);
    }
    .mbc-bar {
      background-image: linear-gradient(to top, var(--mbc-base), var(--mbc-tip));
      animation-duration: 600ms;
      animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
      transition-property: filter, box-shadow;
      transition-duration: calc(180ms * var(--pt-motion, 1));
      transition-timing-function: ease-out;
    }

    /* Highlight: the active bar brightens and glows, the others step back. */
    :host(.mbc-has-active) [role='listitem']:not(.is-active) {
      opacity: 0.5;
    }
    .mbc-col.is-active .mbc-bar {
      filter: brightness(1.15) saturate(1.1);
      box-shadow:
        0 0 0 1px color-mix(in srgb, var(--pt-brand-vivid) 45%, transparent),
        0 0 18px -2px color-mix(in srgb, var(--pt-brand-vivid) 60%, transparent);
    }

    .mbc-hint {
      position: absolute;
      left: 50%;
      z-index: 2;
      pointer-events: none;
      opacity: 0;
      translate: -50% 3px;
      transition-property: opacity, translate;
      transition-duration: calc(150ms * var(--pt-motion, 1));
      transition-timing-function: ease-out;
    }
    .is-active .mbc-hint {
      opacity: 1;
      translate: -50% 0;
    }
    /* End bars: the hint hugs the chart's outer edge instead of centring past it. */
    .mbc-hint-start {
      left: 0;
      translate: 0 3px;
    }
    .is-active .mbc-hint-start {
      translate: 0 0;
    }
    .mbc-hint-end {
      left: auto;
      right: 0;
      translate: 0 3px;
    }
    .is-active .mbc-hint-end {
      translate: 0 0;
    }
  `,
})
export class MiniBarChart {
  readonly bars = input.required<readonly MiniBar[]>();
  /** Chart height in px (labels included); null fills the parent's height (which must be definite). */
  readonly height = input<number | null>(170);
  /** Least height in px when `height` is null, so the bars keep room if the parent's height is not definite. */
  readonly minHeight = input(140);
  readonly dense = input(false, { transform: booleanAttribute });
  /** Bigger labels, for charts with few bars and room to spare. */
  readonly large = input(false, { transform: booleanAttribute });
  /** Colour of the labels above the bars: gold (ratings) or muted (plain values). */
  readonly topTone = input<'gold' | 'muted'>('gold');
  readonly orientation = input<BarOrientation>('vertical');
  /** Gradient bars (all alike) and a springier grow-in. */
  readonly expressive = input(false, { transform: booleanAttribute });

  /** Linked bar lit by hover, keyboard focus or press; the others dim while one is. */
  protected readonly activeKey = signal<string | number | null>(null);

  protected readonly vertical = computed(() => this.orientation() === 'vertical');
  protected readonly hostClass = computed(() =>
    !this.vertical()
      ? 'flex flex-col gap-2.5'
      : 'flex items-stretch ' + (this.dense() ? 'gap-[7px]' : this.large() ? 'gap-5' : 'gap-3.5'),
  );

  /** Plot height kept free for the labels above the bars (line plus gap), when any bar has one. */
  protected readonly topReserve = computed(() =>
    this.bars().some((b) => b.topLabel) ? (this.large() ? 17 : this.dense() ? 14 : 15) : 0,
  );

  protected readonly normalized = computed(() => {
    const bars = this.bars();
    const ratios = barRatios(bars.map((b) => b.value));
    // The highest bar (the best year / month) takes the lighter brand tone when there is a series.
    const highlight = bars.length > 1;
    return bars.map((bar, i) => ({ ...bar, ratio: ratios[i], top: highlight && ratios[i] === 1 }));
  });

  /** Classes of a vertical bar: the expressive gradient, or flat brand tones (lighter for the top bar). */
  protected barClass(top: boolean): string {
    if (this.expressive()) {
      return (this.dense() ? 'rounded-t-[4px] ' : 'rounded-t-md ') + 'mbc-bar';
    }
    return (this.dense() ? 'rounded-t-[3px] ' : 'rounded-t ') + (top ? 'bg-brand-light' : 'bg-brand');
  }

  /** Mouse hover lights the bar; touch lights it on press instead (pointerdown). */
  protected hover(event: PointerEvent, key: string | number): void {
    if (event.pointerType === 'mouse') {
      this.activeKey.set(key);
    }
  }

  /** Clears the highlight if this bar still holds it (another bar may have taken it already). */
  protected release(key: string | number): void {
    if (this.activeKey() === key) {
      this.activeKey.set(null);
    }
  }
}
