import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon, LucideIconInput } from '@lucide/angular';
import { ICONS } from '../../shared/ui/icons';
import { Skeleton } from '../../shared/ui/skeleton';
import { figureFontSize } from '../../shared/ui/stat-card';
import { STATS_BRAND } from './stats-palette';

/** Smallest the figure shrinks to before it is cut with "…" (the full text stays in its tooltip). */
const MIN_FIGURE_PX = 14;

/**
 * A stats hub entry, the whole card linking to the section: the section's icon in a badge of its
 * accent colour and its name (a short name on phones), a teaser figure, a hint and a small visual
 * (projected content) pinned to the bottom. Every part keeps a fixed number of lines (one for the
 * name and the figure, which shrinks with the card width rather than wrapping; two reserved for
 * the hint) and the visual a fixed height, so the cards of a row line up on a 360px phone.
 */
@Component({
  selector: 'app-stats-hub-card',
  imports: [RouterLink, LucideDynamicIcon, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' },
  template: `
    <a
      [routerLink]="link()"
      class="hover-lift @container flex h-full min-w-0 flex-col rounded-[14px] border border-card-border card-glass p-3.5 [--fig-max:22px] md:p-5 md:[--fig-max:26px]"
      [style.--hub-accent]="accent()"
      data-hub-card
    >
      <span class="flex min-w-0 items-center gap-2 text-[13px] leading-5 font-semibold text-text-2 md:text-sm">
        <span
          class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--hub-accent)_16%,transparent)] text-(--hub-accent) md:size-8"
          aria-hidden="true"
        >
          <svg [lucideIcon]="icon()" [size]="16"></svg>
        </span>
        @if (shortTitle(); as short) {
          <span class="min-w-0 flex-1 truncate sm:hidden" [attr.title]="title()">{{ short }}</span>
          <span class="hidden min-w-0 flex-1 truncate sm:inline">{{ title() }}</span>
        } @else {
          <span class="min-w-0 flex-1 truncate">{{ title() }}</span>
        }
        <!-- Phones: no chevron, the half-width cards need the room for the section name. -->
        <svg [lucideIcon]="icons.chevronRight" [size]="16" class="hidden shrink-0 text-faint sm:block" aria-hidden="true"></svg>
      </span>
      @if (loading()) {
        <app-skeleton class="mt-3 h-7 w-20 rounded-md" />
        <app-skeleton class="mt-1.5 h-3.5 w-28 rounded" />
        <app-skeleton class="mt-auto h-9 w-full rounded-md md:h-11" />
      } @else {
        <span
          class="mt-3 block h-7 overflow-hidden leading-7 font-bold tracking-[-0.02em] text-ellipsis whitespace-nowrap md:h-8 md:leading-8"
          [class]="figureClass()"
          [style.font-size]="figureSize()"
          [attr.title]="figure()"
          data-hub-figure
          >{{ figure() ?? '—' }}</span
        >
        <span class="mt-0.5 line-clamp-2 min-h-[2lh] text-xs leading-snug wrap-break-word text-muted">{{ hint() }}</span>
        <span class="mt-auto block h-[42px] pt-1.5 md:h-11 md:pt-2" aria-hidden="true" data-hub-visual>
          <ng-content />
        </span>
      }
    </a>
  `,
})
export class StatsHubCard {
  protected readonly icons = ICONS;
  readonly link = input.required<string>();
  readonly icon = input.required<LucideIconInput>();
  readonly title = input.required<string>();
  /** Shown instead of `title` on phones (< sm), where two cards share a row. */
  readonly shortTitle = input<string | null>(null);
  /** The section's colour (a CSS colour, e.g. `var(--pt-gold)`): icon badge and teaser visual. */
  readonly accent = input(STATS_BRAND);
  readonly loading = input(false);
  /** Teaser figure; a dash when null (no data or a failed load). */
  readonly figure = input<string | null>(null);
  readonly figureClass = input('');
  readonly hint = input<string | null>(null);
  /** One line whatever the name: shrunk to the card width, cut only below a readable size. */
  protected readonly figureSize = computed(() => `max(${MIN_FIGURE_PX}px, ${figureFontSize(this.figure() ?? '—')})`);
}
