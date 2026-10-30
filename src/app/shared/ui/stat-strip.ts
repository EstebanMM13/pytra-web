import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * One glass card holding a row of `app-stat-card`s as cells split by hairline dividers, so a row
 * of single figures reads as one panel instead of several near-empty tiles. The grid columns come
 * from the host `class` (e.g. `grid-cols-2 sm:grid-cols-4`); the cards drop their own frame inside.
 *
 * Dividers: every cell draws a 1px shadow on its left and top edge (see `StatCard`); the strip
 * clips the ones that fall on its outer edge, so they show only between cells, for any column count.
 */
@Component({
  selector: 'app-stat-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'grid overflow-hidden rounded-xl border border-card-border card-glass',
    'data-stat-strip': '',
  },
  template: `<ng-content />`,
})
export class StatStrip {}
