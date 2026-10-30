import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Params, RouterLink } from '@angular/router';
import { LucideDynamicIcon, LucideIconInput } from '@lucide/angular';
import { ICONS } from '../../shared/ui/icons';
import { StatsCoverStack } from './stats-cover-stack';
import { StatsHero } from './stats-hero';
import { StatsHeroGames } from './stats-hero-games';
import { CoverRef } from './stats.logic';

/**
 * The hero of a ranking section (the top studio, genre or decade): a `StatsHero` over the first
 * cover's blurred art (or the section icon as a watermark without covers), linking to the item.
 * The covers fan out at the start (their room kept while `pending`; the section icon in a badge
 * when there are none), then the label, name and meta, the item's most played games on wide
 * screens and the projected headline figure at the end.
 */
@Component({
  selector: 'app-stats-spotlight',
  imports: [RouterLink, LucideDynamicIcon, StatsCoverStack, StatsHero, StatsHeroGames],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <app-stats-hero [backdrop]="covers()[0]?.url ?? null" [watermark]="covers().length ? null : icon()">
      <a
        [routerLink]="link()"
        [queryParams]="queryParams()"
        class="flex min-w-0 items-center gap-3.5 p-[18px] hover:bg-hover/30 max-sm:flex-wrap md:gap-5 md:p-[22px]"
        data-spotlight-link
      >
        @if (covers().length || pending()) {
          <app-stats-cover-stack size="md" compactSize="sm" compactBelow="md" [covers]="covers()" [pending]="pending()" />
        } @else {
          <span
            class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-light md:size-14"
            aria-hidden="true"
          >
            <svg [lucideIcon]="icon()" [size]="22"></svg>
          </span>
        }
        <span class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="text-xs text-text-3">{{ label() }}</span>
          <span class="font-display text-2xl leading-tight font-bold tracking-[-0.02em] wrap-break-word md:text-3xl" data-spotlight-name>{{
            name()
          }}</span>
          @if (meta()) {
            <span class="text-xs text-muted">{{ meta() }}</span>
          }
        </span>
        @if (games() && hasGames()) {
          <app-stats-hero-games [games]="covers()" />
        }
        <!-- Phones: the figure drops to its own line under the name, so a long hint never squeezes the name. -->
        <span
          class="flex shrink-0 flex-col items-end gap-0.5 text-right max-sm:w-full max-sm:flex-row max-sm:items-baseline max-sm:gap-2 max-sm:text-left"
          data-spotlight-figure
        >
          <ng-content />
        </span>
        <svg [lucideIcon]="icons.chevronRight" [size]="18" class="-mr-1 hidden shrink-0 text-faint sm:block" aria-hidden="true"></svg>
      </a>
    </app-stats-hero>
  `,
})
export class StatsSpotlight {
  protected readonly icons = ICONS;
  readonly link = input.required<string | readonly (string | number)[]>();
  readonly queryParams = input<Params | null>(null);
  /** What the item is ("Your most played studio"). */
  readonly label = input.required<string>();
  readonly name = input.required<string>();
  readonly meta = input<string | null>(null);
  readonly covers = input<readonly CoverRef[]>([]);
  /** The covers are still loading: keep their room. */
  readonly pending = input(false);
  /** The section icon: watermark and badge without covers. */
  readonly icon = input.required<LucideIconInput>();
  /** Lists the covers' games with their hours beside the figure (lg+); off where the figure says enough. */
  readonly games = input(true);
  protected readonly hasGames = computed(() => this.covers().length > 0);
}
