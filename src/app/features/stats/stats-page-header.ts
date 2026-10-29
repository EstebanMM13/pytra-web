import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { ICONS } from '../../shared/ui/icons';

/**
 * Title block of a stats hub section: a link back to the hub, the title and subtitle, and a
 * projected slot (the period picker) beside them on wide screens, below them on phones.
 */
@Component({
  selector: 'app-stats-page-header',
  imports: [RouterLink, TranslatePipe, LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between' },
  template: `
    <div class="min-w-0">
      <a
        routerLink="/stats"
        class="tap-area -ml-1 inline-flex items-center gap-0.5 rounded-md text-[13px] text-text-3 hover:text-text"
        [attr.aria-label]="'stats.backAria' | translate"
        data-stats-back
      >
        <svg [lucideIcon]="icons.chevronLeft" [size]="16" aria-hidden="true"></svg>
        {{ 'stats.back' | translate }}
      </a>
      <h1 class="mt-1 font-display text-[28px] leading-tight font-bold tracking-[-0.035em] md:text-[36px]">
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
  protected readonly icons = ICONS;
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
}
