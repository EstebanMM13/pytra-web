import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, numberAttribute, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { MiniBar, MiniBarChart } from './mini-bar-chart';
import { ModalSheet } from './modal-sheet';

/** Bars a per-year chart shows before "Ver todos". */
export const RECENT_BARS_LIMIT = 5;

/** Width each bar gets in the full chart, so long series scroll sideways instead of squeezing. */
const FULL_BAR_WIDTH_PX = 44;

/** A bar with something to show: hours or a label above it (e.g. a rating with no hours logged). */
function hasData(bar: MiniBar): boolean {
  return bar.value > 0 || !!bar.topLabel;
}

/**
 * The last `limit` bars with data of a chronological (oldest first) series, still oldest first.
 * Empty bars are skipped so a quiet year does not take one of the slots.
 */
export function recentBars(bars: readonly MiniBar[], limit = RECENT_BARS_LIMIT): MiniBar[] {
  return bars.filter(hasData).slice(-Math.max(0, limit));
}

/** True when the full series has bars the recent view leaves out (the "Ver todos" button shows). */
export function hasHiddenBars(bars: readonly MiniBar[], limit = RECENT_BARS_LIMIT): boolean {
  return bars.length > recentBars(bars, limit).length;
}

/**
 * Per-year bar chart that shows only the most recent `limit` bars, with a "Ver todos" button
 * (when more exist) opening the whole series in a modal sheet; there it scrolls sideways on narrow
 * screens. `bars` is the full chronological series (oldest first).
 */
@Component({
  selector: 'app-recent-bar-chart',
  imports: [MiniBarChart, ModalSheet, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col' },
  template: `
    <app-mini-bar-chart
      class="flex-1"
      [bars]="visible()"
      [height]="height()"
      [dense]="dense()"
      [topTone]="topTone()"
    />
    @if (hasMore()) {
      <button
        type="button"
        (click)="expanded.set(true)"
        class="mt-2 self-end text-[13px] font-medium text-brand-light hover:underline"
        aria-haspopup="dialog"
        data-show-all
      >
        {{ 'common.showAll' | translate }}
      </button>
    }
    @if (expanded()) {
      <app-modal-sheet viewOnly [title]="title()" (closed)="expanded.set(false)">
        <div class="-mx-5 overflow-x-auto px-5 pb-2 md:mx-0 md:px-0">
          <app-mini-bar-chart
            class="min-w-full"
            [style.min-width.px]="bars().length * fullBarWidth"
            [bars]="bars()"
            [height]="240"
            [topTone]="topTone()"
          />
        </div>
      </app-modal-sheet>
    }
  `,
})
export class RecentBarChart {
  /** The whole series, oldest first. */
  readonly bars = input.required<readonly MiniBar[]>();
  /** Title of the "Ver todos" sheet (already translated). */
  readonly title = input.required<string>();
  readonly limit = input(RECENT_BARS_LIMIT, { transform: numberAttribute });
  /** Height of the recent chart in px; null fills the parent's height. */
  readonly height = input<number | null>(170);
  readonly dense = input(false, { transform: booleanAttribute });
  readonly topTone = input<'gold' | 'muted'>('gold');

  protected readonly fullBarWidth = FULL_BAR_WIDTH_PX;
  protected readonly expanded = signal(false);
  protected readonly visible = computed(() => recentBars(this.bars(), this.limit()));
  protected readonly hasMore = computed(() => hasHiddenBars(this.bars(), this.limit()));
}
