import { ChangeDetectionStrategy, booleanAttribute, Component, computed, input } from '@angular/core';

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
  /** Accessible description of the bar. */
  title?: string;
}

/** Smallest share of the plot a non-zero bar takes, so it stays visible. */
const MIN_BAR_RATIO = 0.02;

/** Each bar's height as a share (0..1) of the tallest one; non-zero values never drop below a sliver. */
export function barRatios(values: readonly number[]): number[] {
  const max = Math.max(0, ...values);
  return values.map((value) => (max > 0 && value > 0 ? Math.max(MIN_BAR_RATIO, value / max) : 0));
}

/**
 * Dependency-free vertical bar chart built with divs. Each column is a plot area (the label above the
 * bar plus the bar) over the labels; the plot takes the column's remaining height, so the chart needs
 * a definite height: `height` in px, or null to fill a parent that has one.
 */
@Component({
  selector: 'app-mini-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex items-stretch',
    role: 'list',
    '[style.height.px]': 'height()',
    '[class.h-full]': 'height() === null',
    '[class]': "dense() ? 'gap-[7px]' : large() ? 'gap-5' : 'gap-3.5'",
  },
  template: `
    @for (bar of normalized(); track bar.key; let i = $index) {
      <div
        class="flex min-w-0 flex-1 flex-col items-center"
        [class]="dense() ? 'gap-[5px]' : 'gap-1.5'"
        role="listitem"
        [attr.aria-label]="bar.title ?? bar.label"
      >
        <div class="flex min-h-0 w-full flex-1 flex-col items-center justify-end" [class]="dense() ? 'gap-[3px]' : 'gap-1'" data-plot>
          @if (bar.topLabel) {
            <span
              class="shrink-0 font-mono leading-none"
              [class]="(large() ? 'text-[13px] ' : 'text-[10px] md:text-[11px] ') + (topTone() === 'gold' ? 'text-gold' : 'text-muted')"
            >{{ bar.topLabel }}</span>
          }
          <!-- The bar fills its share of the plot left after the top labels' row. -->
          <div
            class="bar-grow w-full shrink-0 bg-brand"
            [class]="dense() ? 'rounded-t-[3px]' : 'rounded-t'"
            [style.height]="'calc((100% - ' + topReserve() + 'px) * ' + bar.ratio + ')'"
            [style.animation-delay.ms]="i * 40"
            [attr.data-ratio]="bar.ratio"
          ></div>
        </div>
        <span class="shrink-0 whitespace-nowrap text-muted" [class]="dense() ? 'text-[10px]' : large() ? 'text-sm' : 'text-xs'">
          {{ bar.label }}
        </span>
        @if (bar.subLabel) {
          <span class="-mt-1 shrink-0 font-mono text-faint" [class]="large() ? 'text-[13px]' : 'text-[10px] md:text-[11px]'">{{
            bar.subLabel
          }}</span>
        }
      </div>
    }
  `,
})
export class MiniBarChart {
  readonly bars = input.required<readonly MiniBar[]>();
  /** Chart height in px (labels included); null fills the parent's height (which must be definite). */
  readonly height = input<number | null>(170);
  readonly dense = input(false, { transform: booleanAttribute });
  /** Bigger labels, for charts with few bars and room to spare. */
  readonly large = input(false, { transform: booleanAttribute });
  /** Colour of the labels above the bars: gold (ratings) or muted (plain values). */
  readonly topTone = input<'gold' | 'muted'>('gold');

  /** Plot height kept free for the labels above the bars (line plus gap), when any bar has one. */
  protected readonly topReserve = computed(() =>
    this.bars().some((b) => b.topLabel) ? (this.large() ? 17 : this.dense() ? 14 : 15) : 0,
  );

  protected readonly normalized = computed(() => {
    const bars = this.bars();
    const ratios = barRatios(bars.map((b) => b.value));
    return bars.map((bar, i) => ({ ...bar, ratio: ratios[i] }));
  });
}
