import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { GameCategory } from '../../core/models/game.model';
import { ICONS } from './icons';

const CATEGORY_ICONS = {
  SINGLEPLAYER: ICONS.user,
  ONLINE: ICONS.globe,
  HYBRID: ICONS.combine,
} as const;

/**
 * Compact pill with the game category's icon and short label (singleplayer / online / hybrid).
 * `compact` drops the visible label on very narrow screens (360px wide or less); it stays as the title and for
 * screen readers.
 */
@Component({
  selector: 'app-category-badge',
  imports: [LucideDynamicIcon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'inline-flex shrink-0 items-center rounded-full border border-border px-1.5 py-px text-[11px] leading-4 font-medium whitespace-nowrap text-text-3',
  },
  template: `
    <span class="inline-flex items-center gap-1" [title]="'category.' + category() | translate">
      <svg [lucideIcon]="icon()" [size]="11" class="shrink-0" aria-hidden="true"></svg>
      <span [class]="compact() ? 'max-[361px]:sr-only' : ''">{{ 'category.short.' + category() | translate }}</span>
    </span>
  `,
})
export class CategoryBadge {
  readonly category = input.required<GameCategory>();
  readonly compact = input(false, { transform: booleanAttribute });
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
    <svg [lucideIcon]="icons.calendar" [size]="11" class="shrink-0" aria-hidden="true"></svg>
    <span>{{ 'game.upcoming' | translate }}</span>
  `,
})
export class UpcomingBadge {
  protected readonly icons = ICONS;
}
