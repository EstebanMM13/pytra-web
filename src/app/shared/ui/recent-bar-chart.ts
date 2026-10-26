import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CollapseStateService } from '../../core/services/collapse-state.service';
import { BarOrientation, MiniBar, MiniBarChart } from './mini-bar-chart';
import { ModalSheet } from './modal-sheet';

/** Bars a per-year chart shows before "Ver todos". */
export const RECENT_BARS_LIMIT = 5;

/** Above this many bars, labels switch to their compact form ("'20" instead of "2020"). */
export const FULL_LABELS_MAX = 8;

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
 * How the "Ver todos" sheet lays out the whole series: horizontal rows on narrow screens when there
 * are more bars than the recent view shows (columns would be too thin), vertical columns otherwise.
 */
export function fullChartOrientation(wide: boolean, count: number, limit = RECENT_BARS_LIMIT): BarOrientation {
  return !wide && count > limit ? 'horizontal' : 'vertical';
}

/** Bars labelled with their full form (`fullLabel`) when few enough fit, else the compact `label`. */
export function fitLabels(bars: readonly MiniBar[], maxFull = FULL_LABELS_MAX): MiniBar[] {
  return bars.length > maxFull ? [...bars] : bars.map((bar) => ({ ...bar, label: bar.fullLabel ?? bar.label }));
}

/**
 * Per-year bar chart that shows only the most recent `limit` bars, with a "Ver todos" button
 * (when more exist) opening the whole series in a modal sheet; there it scrolls sideways on narrow
 * screens. `bars` is the full chronological series (oldest first). Few bars get full labels
 * ("2020"), many get compact ones ("'20").
 */
@Component({
  selector: 'app-recent-bar-chart',
  imports: [MiniBarChart, ModalSheet, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col' },
  template: `
    <!-- flex-1 only when filling the parent: a flex basis would override a fixed px height. -->
    <app-mini-bar-chart
      [class.flex-1]="height() === null"
      [bars]="visible()"
      [height]="height()"
      [dense]="dense()"
      [large]="large()"
      [topTone]="topTone()"
      [expressive]="expressive()"
      [accentKey]="accentKey()"
    />
    @if (hasMore()) {
      <button
        type="button"
        (click)="expanded.set(true)"
        class="tap-area mt-2 self-end text-[13px] font-medium text-brand-light hover:underline"
        aria-haspopup="dialog"
        data-show-all
      >
        {{ 'common.showAll' | translate }}
      </button>
    }
    @if (expanded()) {
      <app-modal-sheet viewOnly [title]="title()" (closed)="expanded.set(false)">
        @if (fullOrientation() === 'horizontal') {
          <!-- Phones: one row per year, scrolling with the sheet. -->
          <app-mini-bar-chart [bars]="allFull()" orientation="horizontal" [topTone]="topTone()" />
        } @else {
          <div class="overflow-x-auto pb-2">
            <!-- Definite plot height; at least 28px per bar (scrolls sideways), the sheet's width when that is enough. -->
            <div class="h-[260px] min-w-[calc(var(--bars)*28px)]" [style.--bars]="all().length" data-full-plot>
              <app-mini-bar-chart
                [bars]="all()"
                [height]="null"
                [dense]="all().length > fullLabelsMax"
                [topTone]="topTone()"
                [expressive]="expressive()"
                [accentKey]="accentKey()"
              />
            </div>
          </div>
        }
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
  /** Height of the recent chart in px; null fills the parent's height (which must be definite). */
  readonly height = input<number | null>(170);
  readonly dense = input(false, { transform: booleanAttribute });
  /** Bigger labels in the recent chart (wide layouts with room to spare). */
  readonly large = input(false, { transform: booleanAttribute });
  readonly topTone = input<'gold' | 'muted'>('gold');
  /** Gradient columns with a gold accent bar; see MiniBarChart. */
  readonly expressive = input(false, { transform: booleanAttribute });
  /** Key of the bar drawn in gold (e.g. the current year) when `expressive`. */
  readonly accentKey = input<string | number | null>(null);

  protected readonly fullLabelsMax = FULL_LABELS_MAX;
  protected readonly expanded = signal(false);
  protected readonly visible = computed(() => fitLabels(recentBars(this.bars(), this.limit())));
  protected readonly all = computed(() => fitLabels(this.bars()));
  protected readonly hasMore = computed(() => hasHiddenBars(this.bars(), this.limit()));
  private readonly wide = inject(CollapseStateService).atLeast('md');
  protected readonly fullOrientation = computed(() => fullChartOrientation(this.wide(), this.bars().length, this.limit()));
  /** Rows have room for full labels whatever the count. */
  protected readonly allFull = computed(() => fitLabels(this.bars(), Infinity));
}
