import { ChangeDetectionStrategy, booleanAttribute, Component, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { HoursPipe } from '../pipes/hours.pipe';
import { RatingPipe } from '../pipes/rating.pipe';
import { RatingTonePipe } from '../pipes/rating-tone.pipe';
import { GameCover } from './game-cover';
import { ICONS } from './icons';

/**
 * Run (experience) row: accent bar (brand on the best run, neutral otherwise), title + meta, mono
 * hours and rating coloured by value.
 * Projects extra content (e.g. a StatusPill) before the figures.
 * `onSurface` is for rows placed directly on the page (mobile) instead of inside a card.
 * Binding `coverUrl` (even to null, which shows the initials fallback) swaps the accent bar for a cover thumbnail.
 * `platinum` adds an icy trophy badge and turns the accent bar silver (unless best); `fullCompletion`
 * adds a teal badge-check badge. Both sit by the status: on the line under the meta on phones (with
 * the best pill, so the title keeps its width), before the projected figures from sm up.
 * `backdropUrl` lays a soft blurred cover behind the row (lighter than the game hero's, so text stays first).
 */
@Component({
  selector: 'app-run-row',
  imports: [NgTemplateOutlet, LucideDynamicIcon, TranslatePipe, HoursPipe, RatingPipe, RatingTonePipe, GameCover],
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
          class="size-full scale-110 object-cover opacity-50 blur-lg saturate-150 light:opacity-55 light:brightness-125 light:saturate-200"
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
    <ng-template #bestPill let-size>
      <span
        class="shrink-0 items-center rounded-full bg-gold-tint px-2 text-[11px] font-medium text-gold-tint-fg"
        [class]="size"
        data-best
      >
        {{ 'common.best' | translate }}
      </span>
    </ng-template>
    <ng-template #badges>
      @if (platinum()) {
        <span
          class="platinum-glow platinum-pill relative inline-flex h-6 shrink-0 items-center rounded-full px-1.5"
          role="img"
          [attr.aria-label]="'game.stats.platinum' | translate"
          [attr.title]="'game.stats.platinum' | translate"
          data-platinum
        >
          <svg [lucideIcon]="icons.trophy" [size]="13" aria-hidden="true"></svg>
        </span>
      }
      @if (fullCompletion()) {
        <span
          class="completion-pill inline-flex h-6 shrink-0 items-center rounded-full px-1.5"
          role="img"
          [attr.aria-label]="'run.fullCompletionAria' | translate"
          [attr.title]="'run.fullCompletionAria' | translate"
          data-full-completion
        >
          <svg [lucideIcon]="icons.badgeCheck" [size]="13" aria-hidden="true"></svg>
        </span>
      }
    </ng-template>
    <div class="min-w-0 flex-1">
      <p class="flex items-center gap-2 text-[15px] font-semibold">
        <span class="truncate" [attr.title]="title()">{{ title() }}</span>
        @if (best()) {
          <!-- From sm up only: on phones it moves to the status line so the title keeps the room -->
          <ng-container [ngTemplateOutlet]="bestPill" [ngTemplateOutletContext]="{ $implicit: 'hidden py-0.5 sm:inline-flex' }" />
        }
      </p>
      @if (meta()) {
        <p class="mt-1 truncate text-xs text-muted md:text-[13px]" [attr.title]="meta()">{{ meta() }}</p>
      }
      <!-- Status line under the meta: optional projected content (e.g. the status pill on narrow
           screens), then on phones the best pill and the platinum / 100% badges. Each item carries
           its own top margin, so the line takes no room when empty. -->
      <div class="flex flex-wrap items-center gap-x-1.5" data-status-line>
        <ng-content select="[runRowBelow]" />
        @if (best() || platinum() || fullCompletion()) {
          <span class="mt-1.5 flex items-center gap-1.5 sm:hidden">
            @if (best()) {
              <ng-container [ngTemplateOutlet]="bestPill" [ngTemplateOutletContext]="{ $implicit: 'inline-flex h-6' }" />
            }
            <ng-container [ngTemplateOutlet]="badges" />
          </span>
        }
      </div>
    </div>
    @if (platinum() || fullCompletion()) {
      <!-- From sm up the badges sit just before the projected figures (e.g. the status pill) -->
      <span class="hidden shrink-0 items-center gap-1.5 sm:flex">
        <ng-container [ngTemplateOutlet]="badges" />
      </span>
    }
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
  readonly fullCompletion = input(false, { transform: booleanAttribute });
  readonly onSurface = input(false, { transform: booleanAttribute });
  /** Cover shown blurred behind the row; null / undefined keeps the plain background. */
  readonly backdropUrl = input<string | null | undefined>(undefined);

  protected readonly icons = { trophy: ICONS.trophy, badgeCheck: ICONS.badgeCheck };
}
