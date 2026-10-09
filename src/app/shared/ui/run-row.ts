import { ChangeDetectionStrategy, booleanAttribute, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { HoursPipe } from '../pipes/hours.pipe';
import { RatingPipe } from '../pipes/rating.pipe';

/**
 * Run (experience) row: brand accent bar, title + meta, mono hours and gold rating.
 * Projects extra content (e.g. a StatusPill) before the figures.
 * `onSurface` is for rows placed directly on the page (mobile) instead of inside a card.
 */
@Component({
  selector: 'app-run-row',
  imports: [TranslatePipe, HoursPipe, RatingPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex items-center gap-3.5 rounded-[10px] border p-3.5',
    '[class.bg-bg]': '!onSurface()',
    '[class.bg-surface]': 'onSurface()',
    '[class.border-border]': '!best()',
    '[class.border-brand]': 'best()',
  },
  template: `
    <span class="w-1 self-stretch rounded-sm bg-brand-light" aria-hidden="true"></span>
    <div class="min-w-0 flex-1">
      <p class="flex items-center gap-2 text-[15px] font-semibold">
        <span class="truncate">{{ title() }}</span>
        @if (best()) {
          <span
            class="shrink-0 rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-medium text-brand-lighter"
          >
            {{ 'common.best' | translate }}
          </span>
        }
      </p>
      @if (meta()) {
        <p class="mt-1 truncate text-xs text-muted md:text-[13px]">{{ meta() }}</p>
      }
    </div>
    <ng-content />
    @if (hours() !== null) {
      <span class="shrink-0 font-mono text-sm md:text-[15px]">{{ hours() | hours }}</span>
    }
    @if (rating() !== null) {
      <span class="w-10 shrink-0 text-right font-mono text-[15px] font-medium text-gold">
        {{ rating() | rating }}
      </span>
    }
  `,
})
export class RunRow {
  readonly title = input.required<string>();
  readonly meta = input<string | null>(null);
  readonly hours = input<number | null>(null);
  readonly rating = input<number | null>(null);
  readonly best = input(false, { transform: booleanAttribute });
  readonly onSurface = input(false, { transform: booleanAttribute });
}
