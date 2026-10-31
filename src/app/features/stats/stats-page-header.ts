import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Params } from '@angular/router';
import { StatsBackLink } from './stats-back-link';
import { StatsEyebrow } from './stats-eyebrow';

/**
 * Title block of a stats hub section: a link back to the hub (or to `backLink`), an optional mono
 * eyebrow (the period), the title with its key word in the brand gradient (as the dashboard
 * greeting's name and the year page's year) and the subtitle, and a projected slot (the period
 * picker) beside them on wide screens, below them on phones.
 */
@Component({
  selector: 'app-stats-page-header',
  imports: [StatsBackLink, StatsEyebrow],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between' },
  template: `
    <div class="min-w-0">
      <app-stats-back-link [link]="backLink()" [queryParams]="backQueryParams()" [label]="backLabel()" [aria]="backAria()" />
      @if (eyebrow(); as text) {
        <app-stats-eyebrow class="mt-3 mb-1" data-stats-eyebrow>{{ text }}</app-stats-eyebrow>
      }
      <h1
        class="font-display text-[30px] leading-tight font-bold tracking-[-0.035em] wrap-break-word md:text-[40px]"
        [class.mt-1]="!eyebrow()"
      >
        {{ title() }}
        @if (highlight(); as word) {
          <span class="text-figure text-brand-light">{{ word }}</span>
        }
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
  /** Key word after the title, in the brand gradient ("Your" + "platforms", "Activity" + "2026"). */
  readonly highlight = input<string | number | null>(null);
  /** Small mono line above the title (the period on screen). */
  readonly eyebrow = input<string | null>(null);
  readonly subtitle = input<string | null>(null);
  /** Where the back link goes (the hub by default; a section from its detail pages). */
  readonly backLink = input<string>('/stats');
  readonly backQueryParams = input<Params | null>(null);
  /** Translation keys of the back link's text and accessible name. */
  readonly backLabel = input('stats.back');
  readonly backAria = input('stats.backAria');
}
