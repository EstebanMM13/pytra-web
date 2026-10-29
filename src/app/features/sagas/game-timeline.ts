import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Game } from '../../core/models/game.model';
import { HoursPipe } from '../../shared/pipes/hours.pipe';
import { RatingPipe } from '../../shared/pipes/rating.pipe';
import { RatingTonePipe } from '../../shared/pipes/rating-tone.pipe';
import { CoverTilt } from '../../shared/ui/cover-tilt';
import { GameCover } from '../../shared/ui/game-cover';
import { StatusPill } from '../../shared/ui/status-pill';
import { isPlayed, releaseYear, sagaGameStatus } from './saga.logic';

/**
 * Release-order list of a group of games (a saga, a studio): a timeline whose dots are filled for
 * played games, with cover, status, hours and best rating; each row opens the game. Unplayed games
 * are dimmed. Pass the games already in release order (see `byRelease`).
 */
@Component({
  selector: 'app-game-timeline',
  imports: [RouterLink, TranslatePipe, HoursPipe, RatingPipe, RatingTonePipe, CoverTilt, GameCover, StatusPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  styleUrls: ['./game-timeline.css', '../../shared/ui/cover-tilt.css'],
  template: `
    <!-- Timeline: a connector line runs through the dots, from the first game to the last -->
    <div class="saga-timeline flex flex-col" data-saga-timeline>
      @for (g of games(); track g.id) {
        @let played = isPlayed(g);
        <a
          [routerLink]="['/games', g.id]"
          class="timeline-row hover-lift flex items-center gap-3 border-b border-divider py-2.5 hover:bg-hover md:grid md:grid-cols-[56px_18px_2.25rem_minmax(0,1fr)_120px_70px_70px] md:gap-4 md:border-t md:border-b-0 md:py-2 md:text-sm"
          [attr.data-unplayed]="played ? null : ''"
        >
          <span class="hidden font-mono md:block" [class]="played ? 'text-muted' : 'text-faint'">{{ releaseYear(g) ?? '—' }}</span>
          <span class="relative flex shrink-0 items-center justify-center self-stretch" aria-hidden="true">
            <span class="timeline-line"></span>
            <span
              class="relative size-3 rounded-full border-2"
              [class]="played ? 'border-brand-light bg-brand-light' : 'border-dashed border-faint bg-bg'"
            ></span>
          </span>
          <span class="shrink-0" appCoverTilt>
            <app-game-cover
              decorative
              size="sm"
              [class.saga-unplayed-cover]="!played"
              [url]="g.coverImageUrl"
              [name]="g.name"
              data-saga-cover
            />
          </span>
          @let st = gameStatus(g);
          <div class="min-w-0 flex-1">
            <p class="line-clamp-2 text-[15px] font-medium wrap-break-word md:text-sm" [class]="played ? '' : 'text-text-3'" [title]="g.name">
              {{ g.name }}
              @if (g.hasPlatinum) {
                <span class="text-xs">🏆</span>
              }
            </p>
            <p class="mt-0.5 truncate text-xs md:hidden" [class]="played ? 'text-muted' : 'text-faint'">
              {{ releaseYear(g) ?? '—' }} ·
              {{ (st.kind === 'run' ? 'status.' + st.status : st.kind === 'online' ? 'library.online' : 'game.notPlayed') | translate }}
            </p>
          </div>
          <span class="hidden md:block" data-saga-status>
            @if (st.kind === 'run') {
              <app-status-pill [status]="st.status" />
            } @else if (st.kind === 'online') {
              <!-- Played through online playtime only: same pill as the library -->
              <span class="rounded-full bg-hover px-2 py-0.5 text-xs text-text-3">{{ 'library.online' | translate }}</span>
            } @else {
              <span class="text-xs text-faint">{{ 'game.notPlayed' | translate }}</span>
            }
          </span>
          <span class="hidden text-right font-mono md:block" [class]="played ? '' : 'text-faint'">{{ g.totalHours ? (g.totalHours | hours) : '—' }}</span>
          <span class="shrink-0 text-right font-mono" [class]="g.bestRating | ratingTone">{{ g.bestRating | rating }}</span>
        </a>
      }
    </div>
  `,
})
export class GameTimeline {
  readonly games = input.required<readonly Game[]>();
  protected readonly isPlayed = isPlayed;
  protected readonly gameStatus = sagaGameStatus;
  protected readonly releaseYear = releaseYear;
}
