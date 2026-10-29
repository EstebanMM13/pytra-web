import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { Subject, catchError, map, of, startWith, switchMap } from 'rxjs';
import { Game } from '../../core/models/game.model';
import { GameService } from '../../core/services/game.service';
import { Navbar } from '../../shared/navbar/navbar';
import { HoursPipe } from '../../shared/pipes/hours.pipe';
import { RatingPipe } from '../../shared/pipes/rating.pipe';
import { RatingTonePipe } from '../../shared/pipes/rating-tone.pipe';
import { ICONS } from '../../shared/ui/icons';
import { SectionHeader } from '../../shared/ui/section-header';
import { Skeleton } from '../../shared/ui/skeleton';
import { StatCard } from '../../shared/ui/stat-card';
import { GameTimeline } from '../sagas/game-timeline';
import { developerGames, gameGroupFigures, sagaYearRange } from '../sagas/saga.logic';
import { StatsLoadError } from './stats-load-error';
import { StatsPageHeader } from './stats-page-header';

/** Most characters of the studio name read from the URL (longer is not a link the app made). */
const MAX_NAME_LENGTH = 200;

/** Library state: `games` null while loading. */
interface LibraryState {
  games: Game[] | null;
  failed: boolean;
}

/**
 * Studio detail (`/stats/studio?name=`), opened from a developer row of "Estudios y épocas": the
 * library games whose developer groups with the name (trimmed, case-insensitive, like the API's
 * developer stats), with the saga page's stat cards and release-order timeline. Figures come
 * from the library list (one cached request), as on the saga page.
 */
@Component({
  selector: 'app-stats-studio',
  imports: [
    Navbar,
    RouterLink,
    TranslatePipe,
    HoursPipe,
    RatingPipe,
    RatingTonePipe,
    LucideDynamicIcon,
    SectionHeader,
    Skeleton,
    StatCard,
    StatsLoadError,
    StatsPageHeader,
    GameTimeline,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-navbar />

    <main class="mx-auto flex max-w-5xl flex-col gap-4 px-4 pt-4 pb-8 md:gap-6 md:px-6 md:pt-8 md:pb-12 lg:px-10">
      <app-stats-page-header
        [title]="displayName() || ('stats.studio.unknown' | translate)"
        [subtitle]="subtitle()"
        backLink="/stats/studios"
        backLabel="stats.studios.title"
        backAria="stats.studio.backAria"
      />

      @let lib = library();
      @if (lib.failed) {
        <app-stats-load-error (retry)="retry()" />
      } @else if (!lib.games) {
        <div class="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          @for (i of [1, 2, 3, 4]; track i) {
            <app-skeleton class="h-[72px] rounded-xl md:h-[90px]" />
          }
        </div>
        <app-skeleton class="h-64 rounded-[14px]" />
      } @else if (group(); as g) {
        @if (g.total === 0) {
          <div class="flex flex-col items-center gap-3 rounded-[14px] border border-card-border card-glass px-6 py-12 text-center" data-studio-empty>
            <svg [lucideIcon]="icons.building" [size]="28" class="text-brand-light" aria-hidden="true"></svg>
            <p class="text-sm text-muted">{{ 'stats.studio.empty' | translate }}</p>
          </div>
        } @else {
          <div class="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3" data-studio-stats>
            <app-stat-card
              [icon]="icons.gamepad2"
              [label]="'sagas.stats.played' | translate"
              [value]="g.played + ' / ' + g.total"
              [meter]="g.total ? g.played / g.total : null"
            />
            <app-stat-card [icon]="icons.clock" [label]="'sagas.stats.hours' | translate" [value]="g.hours | hours" />
            <app-stat-card
              [icon]="icons.star"
              tone="gold"
              [label]="'sagas.stats.avgRating' | translate"
              [value]="g.avgRating | rating"
              [valueClass]="'font-mono ' + (g.avgRating | ratingTone)"
            />
            <app-stat-card [icon]="icons.trophy" tone="platinum" [label]="'sagas.stats.platinums' | translate" [value]="g.platinums || '—'" />
          </div>

          <section class="flex flex-col md:rounded-[14px] md:border md:border-card-border md:card-glass md:p-[22px]">
            <app-section-header [label]="'sagas.releaseOrder' | translate" class="mb-2" />
            <app-game-timeline [games]="g.games" />
            <a
              routerLink="/games"
              [queryParams]="{ dev: displayName() }"
              class="tap-area mt-3 inline-flex items-center gap-1 self-start text-[13px] font-medium text-brand-light hover:underline"
              data-studio-library
            >
              {{ 'stats.studio.inLibrary' | translate }}
              <svg [lucideIcon]="icons.chevronRight" [size]="14" aria-hidden="true"></svg>
            </a>
          </section>
        }
      }
    </main>
  `,
})
export class StatsStudio {
  protected readonly icons = ICONS;
  private readonly gameService = inject(GameService);

  /** Studio name from the URL, trimmed and capped. */
  protected readonly name = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((params) => (params.get('name') ?? '').trim().slice(0, MAX_NAME_LENGTH))),
    { initialValue: '' },
  );

  private readonly retry$ = new Subject<void>();
  protected readonly library = toSignal(
    this.retry$.pipe(
      startWith(null),
      switchMap(() =>
        this.gameService.findAll().pipe(
          map((games): LibraryState => ({ games, failed: false })),
          catchError(() => of<LibraryState>({ games: null, failed: true })),
          startWith<LibraryState>({ games: null, failed: false }),
        ),
      ),
    ),
    { initialValue: { games: null, failed: false } satisfies LibraryState },
  );

  protected readonly group = computed(() => {
    const games = this.library().games;
    return games ? gameGroupFigures(developerGames(games, this.name())) : null;
  });

  /** The studio as the library spells it (most common spelling), else as linked. */
  protected readonly displayName = computed(() => {
    const games = this.group()?.games ?? [];
    const counts = new Map<string, number>();
    for (const g of games) {
      const name = g.developer?.trim();
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const best = [...counts].sort(([a, ca], [b, cb]) => cb - ca || a.localeCompare(b))[0];
    return best?.[0] ?? this.name();
  });

  protected readonly subtitle = computed(() => {
    const g = this.group();
    return g && g.total > 0 ? sagaYearRange(g) : null;
  });

  protected retry(): void {
    this.retry$.next();
  }
}
