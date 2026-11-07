import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Game } from '../../../core/models/game.model';
import { HoursPipe } from '../../../shared/pipes/hours.pipe';
import { Dropdown, DropdownOption } from '../../../shared/ui/dropdown';
import { GameCover } from '../../../shared/ui/game-cover';
import { ICONS } from '../../../shared/ui/icons';
import { SectionHeader } from '../../../shared/ui/section-header';
import { Skeleton } from '../../../shared/ui/skeleton';
import { formatRelativeTime } from '../../../shared/utils/relative-time';
import { SyncSource } from '../sync.logic';
import { PendingItem, PendingSort, visiblePending } from './pending-games.logic';

/** Games rendered per "show more": whole libraries can arrive here, each game with its cover. */
export const PENDING_PAGE_SIZE = 24;
/** Below this, search and sort add noise: the whole list fits on screen. */
const TOOLBAR_MIN_ITEMS = 7;

/** Games imported by a platform and waiting for review: a searchable grid of covers with their actions. */
@Component({
  selector: 'app-pending-games',
  imports: [Dropdown, GameCover, HoursPipe, LucideDynamicIcon, SectionHeader, Skeleton, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pending-games.html',
})
export class PendingGames<G extends Game = Game> {
  protected readonly icons = ICONS;

  private readonly translate = inject(TranslateService);

  readonly source = input.required<SyncSource>();
  readonly items = input.required<readonly PendingItem<G>[]>();
  /** Server counter: the header figure, which may run ahead of the loaded list. */
  readonly total = input.required<number>();
  readonly loading = input(false);
  /** IGDB is filling the games in the background. */
  readonly enriching = input(false);
  readonly enrichmentCount = input<{ processed: number; total: number } | null>(null);
  readonly busyGameId = input<number | null>(null);

  readonly createRun = output<G>();
  readonly addGame = output<G>();
  readonly ignoreGame = output<G>();

  protected readonly query = signal('');
  protected readonly sort = signal<PendingSort>('hours');
  protected readonly sortOptions: readonly DropdownOption<PendingSort>[] = [
    { value: 'hours', label: 'sync.pending.sort.hours' },
    { value: 'recent', label: 'sync.pending.sort.recent' },
    { value: 'name', label: 'sync.pending.sort.name' },
  ];

  /** A new search or order starts over from the first page. */
  private readonly limit = linkedSignal({
    source: () => [this.query(), this.sort()],
    computation: () => PENDING_PAGE_SIZE,
  });

  protected readonly matches = computed(() => visiblePending(this.items(), this.query(), this.sort()));
  protected readonly shown = computed(() => this.matches().slice(0, this.limit()));
  protected readonly remaining = computed(() => this.matches().length - this.shown().length);
  /** Stays while searching, so a list that shrinks under an active search can still clear it. */
  protected readonly showToolbar = computed(() => this.items().length >= TOOLBAR_MIN_ITEMS || this.query() !== '');

  private readonly locale = computed(() => (this.translate.currentLang() === 'en' ? 'en-US' : 'es-ES'));

  protected lastSession(item: PendingItem<G>): string | null {
    return formatRelativeTime(item.lastPlayedAt, this.locale());
  }

  protected showMore(): void {
    this.limit.update((limit) => limit + PENDING_PAGE_SIZE);
  }
}
