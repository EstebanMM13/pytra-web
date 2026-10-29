import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { ICONS } from '../../shared/ui/icons';

/**
 * "‹ Estadísticas" link above a stats page title: the hub by default, or a section (`link`) from
 * its detail pages. Shared by the stats sections and the pages the hub links to (years, sagas).
 */
@Component({
  selector: 'app-stats-back-link',
  imports: [RouterLink, TranslatePipe, LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <a
      [routerLink]="link()"
      class="tap-area -ml-1 inline-flex items-center gap-0.5 rounded-md text-[13px] text-text-3 hover:text-text"
      [attr.aria-label]="aria() | translate"
      data-stats-back
    >
      <svg [lucideIcon]="icons.chevronLeft" [size]="16" aria-hidden="true"></svg>
      {{ label() | translate }}
    </a>
  `,
})
export class StatsBackLink {
  protected readonly icons = ICONS;
  readonly link = input<string>('/stats');
  /** Translation keys of the text and the accessible name. */
  readonly label = input('stats.back');
  readonly aria = input('stats.backAria');
}
