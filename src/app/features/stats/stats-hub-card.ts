import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon, LucideIconInput } from '@lucide/angular';
import { ICONS } from '../../shared/ui/icons';
import { Skeleton } from '../../shared/ui/skeleton';

/**
 * A stats hub entry: section name, a teaser figure and a hint line, the whole card linking to the
 * section. Every text wraps to two lines instead of being cut (developer and platform names are
 * figures here), so it reads on a 360px phone at a large system font size.
 */
@Component({
  selector: 'app-stats-hub-card',
  imports: [RouterLink, LucideDynamicIcon, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' },
  template: `
    <a
      [routerLink]="link()"
      class="hover-lift flex h-full min-w-0 flex-col gap-1.5 rounded-[14px] border border-card-border card-glass p-3.5 md:gap-2 md:p-5"
      data-hub-card
    >
      <span class="flex min-w-0 items-start gap-2 text-[13px] leading-5 font-semibold text-text-2 md:text-sm">
        <svg [lucideIcon]="icon()" [size]="16" class="mt-0.5 shrink-0 text-brand-light" aria-hidden="true"></svg>
        <span class="line-clamp-2 min-w-0 flex-1 wrap-break-word">{{ title() }}</span>
        <svg [lucideIcon]="icons.chevronRight" [size]="16" class="mt-0.5 shrink-0 text-faint" aria-hidden="true"></svg>
      </span>
      @if (loading()) {
        <app-skeleton class="mt-0.5 h-7 w-20 rounded-md" />
        <app-skeleton class="h-3.5 w-28 rounded" />
      } @else {
        <span
          class="line-clamp-2 text-[20px] leading-tight font-bold tracking-[-0.02em] wrap-break-word md:text-2xl"
          [class]="figureClass()"
          data-hub-figure
          >{{ figure() ?? '—' }}</span
        >
        @if (hint(); as text) {
          <span class="line-clamp-2 text-xs leading-snug text-muted">{{ text }}</span>
        }
      }
    </a>
  `,
})
export class StatsHubCard {
  protected readonly icons = ICONS;
  readonly link = input.required<string>();
  readonly icon = input.required<LucideIconInput>();
  readonly title = input.required<string>();
  readonly loading = input(false);
  /** Teaser figure; a dash when null (no data or a failed load). */
  readonly figure = input<string | null>(null);
  readonly figureClass = input('');
  readonly hint = input<string | null>(null);
}
