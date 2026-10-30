import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { HoursPipe } from '../../shared/pipes/hours.pipe';
import { CoverRef } from './stats.logic';

/**
 * The most played games behind a hero (a studio, a genre, a decade) with their hours (left out
 * when unknown), listed beside its figure on wide screens so the hero's middle is not left empty.
 * Hidden below lg, where the cover stack already shows them.
 */
@Component({
  selector: 'app-stats-hero-games',
  imports: [HoursPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'hidden w-60 shrink-0 border-l border-divider pl-5 lg:block', 'data-hero-games': '' },
  template: `
    <ol class="flex flex-col gap-1 text-xs">
      @for (game of games(); track game.id) {
        <li class="flex items-baseline justify-between gap-3">
          <span class="truncate text-text-2" [attr.title]="game.name">{{ game.name }}</span>
          @if (game.hours) {
            <span class="shrink-0 font-mono text-muted">{{ game.hours | hours }}</span>
          }
        </li>
      }
    </ol>
  `,
})
export class StatsHeroGames {
  readonly games = input.required<readonly CoverRef[]>();
}
