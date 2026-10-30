import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Params, RouterLink } from '@angular/router';
import { columnHeights } from './stats.logic';

/** One column of a `StatsColumnChart`. */
export interface StatsColumn {
  key: string | number;
  /** Axis label under the column (short: "8-30", "1990"). */
  label: string;
  /** What the column height is scaled from. */
  value: number;
  /** Figure on top of the column, e.g. the count; hidden on empty columns. */
  figure: string;
  /** Full description, for screen readers and the tooltip ("8-30 days: 4 runs"). */
  title: string;
  /** Router commands the column links to (none on empty columns). */
  link?: readonly (string | number)[] | null;
  /** Query params of `link` (library filters). */
  queryParams?: Params | null;
}

/** Height of the bar area (figure room included), in px. */
const CHART_HEIGHT_PX = 132;

/**
 * Vertical histogram of a few labelled buckets (plain divs, no chart library): every column has
 * its axis label and its figure on top, so it reads without a scale. Columns with a `link` are
 * tappable (the whole column, label included). Bars grow from the baseline on first render (none
 * with reduced motion).
 */
@Component({
  selector: 'app-stats-column-chart',
  imports: [NgTemplateOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex justify-center gap-1.5" role="list">
      @for (column of drawn(); track column.key) {
        <div class="max-w-20 min-w-0 flex-1" role="listitem" data-column>
          @if (column.link) {
            <a
              [routerLink]="column.link"
              [queryParams]="column.queryParams ?? null"
              class="group block rounded-lg hover:bg-hover"
              [attr.aria-label]="column.title"
              [attr.title]="column.title"
            >
              <ng-container *ngTemplateOutlet="body; context: { $implicit: column }" />
            </a>
          } @else {
            <div [attr.aria-label]="column.title" [attr.title]="column.title" role="img">
              <ng-container *ngTemplateOutlet="body; context: { $implicit: column }" />
            </div>
          }
        </div>
      }
    </div>

    <ng-template #body let-column>
      <!-- Top padding: room for the figure over the tallest column. -->
      <span class="block border-b border-divider px-1 pt-5" [style.height.px]="height" aria-hidden="true">
        <span class="relative block h-full">
          <span
            class="bar-grow absolute inset-x-0 bottom-0 rounded-t-md bg-brand-light"
            [style.height.%]="column.height"
          ></span>
          @if (column.value > 0) {
            <span
              class="absolute inset-x-0 text-center font-mono text-[11px] leading-4 text-text-2"
              [style.bottom]="'calc(' + column.height + '% + 2px)'"
              >{{ column.figure }}</span
            >
          }
        </span>
      </span>
      <span
        class="block truncate py-1.5 text-center font-mono text-[10px] leading-tight tracking-tighter text-faint group-hover:text-text-2"
        aria-hidden="true"
        >{{ column.label }}</span
      >
    </ng-template>
  `,
})
export class StatsColumnChart {
  readonly columns = input.required<readonly StatsColumn[]>();
  protected readonly height = CHART_HEIGHT_PX;
  protected readonly drawn = computed(() => {
    const heights = columnHeights(this.columns().map((c) => c.value));
    return this.columns().map((column, i) => ({ ...column, height: heights[i] }));
  });
}
