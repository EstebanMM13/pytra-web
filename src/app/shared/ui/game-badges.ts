import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { GameCategory } from '../../core/models/game.model';
import { ICONS } from './icons';

const CATEGORY_ICONS = {
  SINGLEPLAYER: ICONS.user,
  ONLINE: ICONS.globe,
  HYBRID: ICONS.combine,
} as const;

/** Compact pill with the game category's icon and short label (singleplayer / online / hybrid). */
@Component({
  selector: 'app-category-badge',
  imports: [LucideDynamicIcon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-1.5 py-px text-[11px] leading-4 font-medium whitespace-nowrap text-text-3',
  },
  template: `
    <svg [lucideIcon]="icon()" [size]="11" class="shrink-0" aria-hidden="true"></svg>
    <span>{{ 'category.short.' + category() | translate }}</span>
  `,
})
export class CategoryBadge {
  readonly category = input.required<GameCategory>();
  protected readonly icon = computed(() => CATEGORY_ICONS[this.category()]);
}

/** "Coming soon" pill for games whose release date is still ahead. */
@Component({
  selector: 'app-upcoming-badge',
  imports: [LucideDynamicIcon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'inline-flex shrink-0 items-center gap-1 rounded-full bg-gold-tint px-1.5 py-px text-[11px] leading-4 font-medium whitespace-nowrap text-gold-tint-fg',
  },
  template: `
    <svg [lucideIcon]="icons.calendarClock" [size]="11" class="shrink-0" aria-hidden="true"></svg>
    <span>{{ 'game.upcoming' | translate }}</span>
  `,
})
export class UpcomingBadge {
  protected readonly icons = ICONS;
}
