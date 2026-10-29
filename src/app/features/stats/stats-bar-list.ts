import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Params, RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { ICONS } from '../../shared/ui/icons';

/** One row of a `StatsBarList`. */
export interface StatsBar {
  key: string | number;
  label: string;
  /** Bar length as a share (0..1) of the row with the most. */
  share: number;
  /** Figure at the end of the label line, e.g. "120 h" or a rating. */
  figure: string;
  /** Extra classes of the figure (rating tone). */
  figureClass?: string;
  /** Small line under the bar, e.g. "3 partidas · media 8,1". */
  sub?: string | null;
  /** Bar colour (a CSS colour); the list tone's colour when absent. */
  color?: string | null;
  /** Shows a dot in `color` before the label (platforms). */
  dot?: boolean;
  /** Router commands the whole row links to (a chevron marks it as tappable). */
  link?: readonly (string | number)[] | null;
  /** Query params of `link` (library filters). */
  queryParams?: Params | null;
}

const TONE_COLOR = {
  brand: 'var(--pt-brand-light)',
  gold: 'var(--pt-gold)',
  danger: 'var(--pt-danger)',
} as const;

/** Rows a long stats list shows before "Ver todos" (the length of the days-to-finish list). */
export const STATS_LIST_PREVIEW = 6;

/**
 * Ranked rows built to survive narrow screens and large system fonts: the label (up to two lines,
 * never cut to one) and its figure on the first line, a full-width bar under them and an optional
 * small line below. Plain divs, no chart library. With `limit`, longer lists show their first rows
 * and a "Ver todos (N)" toggle that expands them in place (as the profile achievements do).
 */
@Component({
  selector: 'app-stats-bar-list',
  imports: [NgTemplateOutlet, RouterLink, LucideDynamicIcon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ul class="flex flex-col">
      @for (bar of visible(); track bar.key) {
        <li class="border-t border-divider first:border-t-0" data-bar-row>
          @if (bar.link) {
            <a
              [routerLink]="bar.link"
              [queryParams]="bar.queryParams ?? null"
              class="hover-lift -mx-2 flex items-center gap-1.5 rounded-lg px-2 py-2.5 hover:bg-hover"
              data-bar-link
            >
              <span class="block min-w-0 flex-1">
                <ng-container *ngTemplateOutlet="row; context: { $implicit: bar }" />
              </span>
              <svg [lucideIcon]="icons.chevronRight" [size]="16" class="-mr-1 shrink-0 text-faint" aria-hidden="true"></svg>
            </a>
          } @else {
            <div class="py-2.5">
              <ng-container *ngTemplateOutlet="row; context: { $implicit: bar }" />
            </div>
          }
        </li>
      }
    </ul>
    @if (cut() !== null) {
      <button
        type="button"
        (click)="expanded.set(!expanded())"
        [attr.aria-expanded]="expanded()"
        class="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2.5 text-[13px] text-text-2 hover:border-border-strong"
        data-bar-toggle
      >
        {{ (expanded() ? 'stats.showLess' : 'stats.showAll') | translate: { total: bars().length } }}
        <svg [lucideIcon]="icons.chevronDown" [size]="16" class="transition-transform" [class.rotate-180]="expanded()" aria-hidden="true"></svg>
      </button>
    }

    <ng-template #row let-bar>
      <span class="flex items-start justify-between gap-3">
        <span class="flex min-w-0 flex-1 items-start gap-2 text-sm text-text-2">
          @if (bar.dot) {
            <span class="mt-1.5 size-2 shrink-0 rounded-full" [style.background-color]="bar.color" aria-hidden="true"></span>
          }
          <span class="line-clamp-2 min-w-0 wrap-break-word" [attr.title]="bar.label">{{ bar.label }}</span>
        </span>
        <span class="shrink-0 font-mono text-sm" [class]="bar.figureClass ?? ''">{{ bar.figure }}</span>
      </span>
      <span class="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-hover" aria-hidden="true">
        <span
          class="bar-fill block h-full rounded-full"
          [style.width.%]="bar.share * 100"
          [style.background-color]="bar.color ?? toneColor()"
        ></span>
      </span>
      @if (bar.sub) {
        <span class="mt-1 block text-xs text-faint">{{ bar.sub }}</span>
      }
    </ng-template>
  `,
})
export class StatsBarList {
  protected readonly icons = ICONS;
  readonly bars = input.required<readonly StatsBar[]>();
  /** Default bar colour: brand (activity), gold (ratings) or danger (abandonment). */
  readonly tone = input<keyof typeof TONE_COLOR>('brand');
  /** Rows shown before the "Ver todos" toggle; null shows every row. */
  readonly limit = input<number | null>(null);
  protected readonly toneColor = computed(() => TONE_COLOR[this.tone()]);
  protected readonly expanded = signal(false);

  /** A list that only exceeds the limit by one row shows it whole (a toggle for one row is noise). */
  protected readonly cut = computed(() => {
    const limit = this.limit();
    return limit !== null && this.bars().length > limit + 1 ? limit : null;
  });
  protected readonly visible = computed(() => {
    const cut = this.cut();
    return cut === null || this.expanded() ? this.bars() : this.bars().slice(0, cut);
  });
}
