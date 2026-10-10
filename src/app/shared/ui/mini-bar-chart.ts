import { ChangeDetectionStrategy, booleanAttribute, Component, computed, input } from '@angular/core';

export interface MiniBar {
  key: string | number;
  /** Bar magnitude; heights are relative to the largest value. */
  value: number;
  /** Text under the bar, e.g. an abbreviated year. */
  label: string;
  /** Optional text above the bar, e.g. the year's average rating (gold mono). */
  topLabel?: string | null;
  /** Accessible description of the bar. */
  title?: string;
}

/** Dependency-free vertical bar chart built with divs. */
@Component({
  selector: 'app-mini-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex items-end',
    role: 'list',
    '[style.height.px]': 'height()',
    '[class]': "dense() ? 'gap-[7px]' : 'gap-3.5'",
  },
  template: `
    @for (bar of normalized(); track bar.key) {
      <div
        class="flex min-w-0 flex-1 flex-col items-center justify-end self-stretch"
        [class]="dense() ? 'gap-[5px]' : 'gap-1.5'"
        role="listitem"
        [attr.aria-label]="bar.title ?? bar.label"
      >
        @if (bar.topLabel) {
          <span
            class="font-mono text-[10px] md:text-[11px]"
            [class]="topTone() === 'gold' ? 'text-gold' : 'text-muted'"
          >{{ bar.topLabel }}</span>
        }
        <div
          class="w-full bg-brand"
          [class]="dense() ? 'rounded-t-[3px]' : 'rounded-t'"
          [style.height.%]="bar.percent"
        ></div>
        <span class="text-muted" [class]="dense() ? 'text-[10px]' : 'text-xs'">
          {{ bar.label }}
        </span>
      </div>
    }
  `,
})
export class MiniBarChart {
  readonly bars = input.required<readonly MiniBar[]>();
  /** Chart height in px (labels included). */
  readonly height = input(170);
  readonly dense = input(false, { transform: booleanAttribute });
  /** Colour of the labels above the bars: gold (ratings) or muted (plain values). */
  readonly topTone = input<'gold' | 'muted'>('gold');

  protected readonly normalized = computed(() => {
    const bars = this.bars();
    const max = Math.max(0, ...bars.map((b) => b.value));
    return bars.map((bar) => ({
      ...bar,
      // Labels share the column with the bar, so the tallest bar takes ~72% of it;
      // keep a sliver visible for non-zero values.
      percent: max > 0 ? Math.max(bar.value > 0 ? 2 : 0, (bar.value / max) * 72) : 0,
    }));
  });
}
