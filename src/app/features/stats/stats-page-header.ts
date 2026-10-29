import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { StatsBackLink } from './stats-back-link';

/**
 * Title block of a stats hub section: a link back to the hub (or to `backLink`), the title and
 * subtitle, and a projected slot (the period picker) beside them on wide screens, below them on phones.
 */
@Component({
  selector: 'app-stats-page-header',
  imports: [StatsBackLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between' },
  template: `
    <div class="min-w-0">
      <app-stats-back-link [link]="backLink()" [label]="backLabel()" [aria]="backAria()" />
      <h1 class="mt-1 font-display text-[28px] leading-tight font-bold tracking-[-0.035em] wrap-break-word md:text-[36px]">
        {{ title() }}
      </h1>
      @if (subtitle(); as text) {
        <p class="mt-1 text-sm text-text-3">{{ text }}</p>
      }
    </div>
    <ng-content />
  `,
})
export class StatsPageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  /** Where the back link goes (the hub by default; a section from its detail pages). */
  readonly backLink = input<string>('/stats');
  /** Translation keys of the back link's text and accessible name. */
  readonly backLabel = input('stats.back');
  readonly backAria = input('stats.backAria');
}
