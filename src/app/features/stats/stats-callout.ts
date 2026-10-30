import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Params, RouterLink } from '@angular/router';
import { StatsCoverStack } from './stats-cover-stack';
import { CoverRef } from './stats.logic';

/** Per variant: the link's frame, the name's and the figure's classes and the covers' size. */
const VARIANTS = {
  /** A glass card of its own (a row of callouts under a hero). */
  card: {
    frame: 'hover-lift rounded-[14px] border border-card-border card-glass p-3.5 md:p-4',
    name: 'line-clamp-2 text-[15px] wrap-break-word',
    cover: 'sm',
    figure: 'text-lg font-bold',
  },
  /** A row inside a card (the saga picks). */
  row: {
    frame: 'hover-lift -mx-2 rounded-lg px-2 py-2 hover:bg-hover',
    name: 'truncate text-sm',
    cover: 'xs',
    figure: 'text-sm text-text-2',
  },
} as const;

/**
 * One item standing out for a reason (best rated genre, oldest release, saga closest to
 * completion): its covers, the reason as a small label, the item's name and the projected figure
 * at the end, the whole callout linking to the item.
 */
@Component({
  selector: 'app-stats-callout',
  imports: [RouterLink, StatsCoverStack],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' },
  template: `
    @let look = variants[variant()];
    <a [routerLink]="link()" [queryParams]="queryParams()" class="flex min-w-0 items-center gap-3" [class]="look.frame" data-callout-link>
      @if (covers().length) {
        <app-stats-cover-stack [size]="look.cover" [covers]="covers()" />
      }
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="text-xs text-text-3">{{ label() }}</span>
        <span class="font-semibold" [class]="look.name" [attr.title]="name()">{{ name() }}</span>
      </span>
      <span class="shrink-0 font-mono" [class]="look.figure + ' ' + figureClass()">
        <ng-content />
      </span>
    </a>
  `,
})
export class StatsCallout {
  protected readonly variants = VARIANTS;
  readonly link = input.required<string | readonly (string | number)[]>();
  readonly queryParams = input<Params | null>(null);
  readonly label = input.required<string>();
  readonly name = input.required<string>();
  readonly covers = input<readonly CoverRef[]>([]);
  /** Extra classes of the figure (rating tone). */
  readonly figureClass = input('');
  readonly variant = input<keyof typeof VARIANTS>('card');
}
