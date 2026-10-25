import { ChangeDetectionStrategy, booleanAttribute, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { HoursPipe } from '../pipes/hours.pipe';
import { RatingPipe } from '../pipes/rating.pipe';
import { RatingTonePipe } from '../pipes/rating-tone.pipe';
import { GameCover } from './game-cover';

/**
 * Run (experience) row: accent bar (brand on the best run, neutral otherwise), title + meta, mono
 * hours and rating coloured by value.
 * Projects extra content (e.g. a StatusPill) before the figures.
 * `onSurface` is for rows placed directly on the page (mobile) instead of inside a card.
 * Binding `coverUrl` (even to null, which shows the initials fallback) swaps the accent bar for a cover thumbnail.
 * `platinum` adds an icy platinum pill beside the title and turns the accent bar silver (unless best).
 * `backdropUrl` lays a soft blurred cover behind the row (lighter than the game hero's, so text stays first).
 */
@Component({
  selector: 'app-run-row',
  imports: [TranslatePipe, HoursPipe, RatingPipe, RatingTonePipe, GameCover],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './platinum-glow.css',
  host: {
    class: 'relative isolate flex items-center gap-3.5 overflow-hidden rounded-[10px] border p-3.5',
    '[class.bg-bg]': '!onSurface()',
    '[class.bg-surface]': 'onSurface()',
    '[class.border-border]': '!best()',
    '[class.border-brand]': 'best()',
  },
  template: `
    @if (backdropUrl(); as backdrop) {
      <div class="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <img
          [src]="backdrop"
          alt=""
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
          class="size-full scale-125 object-cover opacity-45 blur-2xl saturate-150 light:opacity-55 light:brightness-125 light:saturate-200"
        />
        <div class="absolute inset-0 bg-linear-to-r from-bg/45 via-bg/70 to-bg/85 light:from-bg/40 light:via-bg/55 light:to-bg/75"></div>
      </div>
    }
    @if (coverUrl() !== undefined) {
      <app-game-cover decorative size="sm" [url]="coverUrl()" [name]="coverName() ?? title()" />
    } @else {
      <span
        class="w-1 self-stretch rounded-sm"
        [class]="best() ? 'bg-brand-light' : platinum() ? 'bg-platinum' : 'bg-border-strong'"
        aria-hidden="true"
      ></span>
    }
    <div class="min-w-0 flex-1">
      <p class="flex items-center gap-2 text-[15px] font-semibold">
        <span class="truncate" [attr.title]="title()">{{ title() }}</span>
        @if (best()) {
          <span
            class="shrink-0 rounded-full bg-gold-tint px-2 py-0.5 text-[11px] font-medium text-gold-tint-fg"
          >
            {{ 'common.best' | translate }}
          </span>
        }
        @if (platinum()) {
          <!-- Trophy only on phones, where the title needs the room -->
          <span
            class="platinum-glow platinum-pill relative shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
            [attr.aria-label]="'game.stats.platinum' | translate"
          >
            <span class="sm:hidden" aria-hidden="true">🏆</span>
            <span class="hidden sm:inline" aria-hidden="true">{{ 'run.platinum' | translate }}</span>
          </span>
        }
      </p>
      @if (meta()) {
        <p class="mt-1 truncate text-xs text-muted md:text-[13px]" [attr.title]="meta()">{{ meta() }}</p>
      }
      <!-- Optional content under the meta line (e.g. the status pill on narrow screens) -->
      <ng-content select="[runRowBelow]" />
    </div>
    <ng-content />
    @if (hours() !== null) {
      <span class="shrink-0 font-mono text-sm md:text-[15px]">{{ hours() | hours }}</span>
    }
    @if (rating() !== null) {
      <span
        class="w-10 shrink-0 text-right font-mono text-[15px] font-medium"
        [class]="rating() | ratingTone"
      >
        {{ rating() | rating }}
      </span>
    }
  `,
})
export class RunRow {
  readonly title = input.required<string>();
  /** Cover thumbnail url; `undefined` (default) keeps the plain accent bar. */
  readonly coverUrl = input<string | null | undefined>(undefined);
  /** Name for the cover fallback initials when the title is not the game name. */
  readonly coverName = input<string | null>(null);
  readonly meta = input<string | null>(null);
  readonly hours = input<number | null>(null);
  readonly rating = input<number | null>(null);
  readonly best = input(false, { transform: booleanAttribute });
  readonly platinum = input(false, { transform: booleanAttribute });
  readonly onSurface = input(false, { transform: booleanAttribute });
  /** Cover shown blurred behind the row; null / undefined keeps the plain background. */
  readonly backdropUrl = input<string | null | undefined>(undefined);
}
