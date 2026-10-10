import { ChangeDetectionStrategy, Component, computed, inject, signal, effect, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import {
  LucideArrowDownWideNarrow,
  LucideArrowRight,
  LucideDownload,
  LucidePlus,
  LucideSearch,
} from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { Dropdown, DropdownOption } from '../../shared/ui/dropdown';
import { map } from 'rxjs';
import { Game } from '../../core/models/game.model';
import { GameService } from '../../core/services/game.service';
import { Navbar } from '../../shared/navbar/navbar';
import { HoursPipe } from '../../shared/pipes/hours.pipe';
import { RatingPipe } from '../../shared/pipes/rating.pipe';
import { Pagination } from '../../shared/ui/pagination';
import { Skeleton } from '../../shared/ui/skeleton';
import { StatusPill } from '../../shared/ui/status-pill';
import { GameEditDialog } from './game-edit-dialog/game-edit-dialog';
import {
  LIBRARY_PLATFORMS,
  LIBRARY_SORTS,
  LIBRARY_STATUS_FILTERS,
  LibraryQuery,
  LibrarySort,
  LibraryStatusFilter,
  countByStatus,
  filterGames,
  isLibraryGame,
  matchesPlatform,
  matchesText,
  paginate,
  parsePage,
  parsePlatformFilter,
  parseSort,
  parseStatusFilter,
} from './library.logic';

/**
 * Library (/games): confirmed games with their run aggregates, filtered, sorted and paged on the
 * client. Filters live in the URL (`q`, `status`, `platform`, `sort`, `page`) so back navigation restores them.
 */
@Component({
  selector: 'app-games',
  imports: [
    RouterLink,
    TranslatePipe,
    Navbar,
    HoursPipe,
    RatingPipe,
    Pagination,
    Dropdown,
    Skeleton,
    StatusPill,
    GameEditDialog,
    LucideArrowDownWideNarrow,
    LucideArrowRight,
    LucideDownload,
    LucidePlus,
    LucideSearch,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './games.html',
})
export class Games {
  private readonly gameService = inject(GameService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly statusFilters = LIBRARY_STATUS_FILTERS;
  protected readonly sorts = LIBRARY_SORTS;
  protected readonly platforms = LIBRARY_PLATFORMS;
  protected readonly platformOptions: DropdownOption[] = [
    { value: 'ALL', label: 'library.platformAllShort' },
    ...LIBRARY_PLATFORMS.map((p) => ({ value: p, label: `platform.${p}` })),
  ];
  protected readonly sortOptions: DropdownOption[] = LIBRARY_SORTS.map((s) => ({ value: s, label: `library.sort.${s}` }));
  protected readonly skeletonRows = Array.from({ length: 8 }, (_, i) => i);

  /** `null` while loading. */
  private readonly allGames = signal<Game[] | null>(null);
  protected readonly loadError = signal(false);
  protected readonly creating = signal(false);

  protected readonly query = toSignal(
    this.route.queryParamMap.pipe(
      map(
        (params) =>
          ({
            text: params.get('q') ?? '',
            status: parseStatusFilter(params.get('status')),
            sort: parseSort(params.get('sort')),
            platform: parsePlatformFilter(params.get('platform')),
            page: parsePage(params.get('page')),
          }) satisfies LibraryQuery & { page: number },
      ),
    ),
    { requireSync: true },
  );

  protected readonly loading = computed(() => this.allGames() === null);
  protected readonly libraryGames = computed(() => (this.allGames() ?? []).filter(isLibraryGame));
  protected readonly pendingReviewCount = computed(
    () => (this.allGames() ?? []).filter((g) => !isLibraryGame(g)).length,
  );
  protected readonly runCount = computed(() =>
    this.libraryGames().reduce((sum, g) => sum + (g.experienceCount ?? 0), 0),
  );

  /** Tab counters follow the name and platform filters, so they add up to what each tab would show. */
  protected readonly statusCounts = computed(() =>
    countByStatus(
      this.libraryGames().filter(
        (g) => matchesText(g, this.query().text) && matchesPlatform(g, this.query().platform),
      ),
    ),
  );
  protected readonly filtered = computed(() => filterGames(this.libraryGames(), this.query()));
  protected readonly page = computed(() => paginate(this.filtered(), this.query().page));
  protected readonly hasFilters = computed(
    () => !!this.query().text.trim() || this.query().status !== 'ALL' || this.query().platform !== 'ALL',
  );

  constructor() {
    this.load();

    // `?page=` beyond the last page (or after filtering): rewrite the URL to the page shown.
    effect(() => {
      if (this.loading()) {
        return;
      }
      const shown = this.page().page;
      if (this.query().page !== shown) {
        untracked(() => this.updateQuery({ page: shown > 1 ? shown : null }));
      }
    });
  }

  private load(): void {
    this.loadError.set(false);
    this.gameService.findAll().subscribe({
      next: (games) => this.allGames.set(games),
      error: () => {
        this.allGames.set([]);
        this.loadError.set(true);
      },
    });
  }

  protected setText(text: string): void {
    this.updateQuery({ q: text || null, page: null });
  }

  protected setStatus(status: LibraryStatusFilter): void {
    this.updateQuery({ status: status === 'ALL' ? null : status, page: null });
  }

  protected setSort(sort: string): void {
    const parsed: LibrarySort = parseSort(sort);
    this.updateQuery({ sort: parsed === 'recent' ? null : parsed, page: null });
  }

  protected setPlatform(platform: string): void {
    const parsed = parsePlatformFilter(platform);
    this.updateQuery({ platform: parsed === 'ALL' ? null : parsed, page: null });
  }

  protected setPage(page: number): void {
    this.updateQuery({ page: page > 1 ? page : null }, false);
  }

  protected clearFilters(): void {
    this.updateQuery({ q: null, status: null, platform: null, page: null });
  }

  /** Typing and toggles replace the history entry; page changes push one so "back" pages back. */
  private updateQuery(params: Params, replaceUrl = true): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }

  protected onGameCreated(game: Game): void {
    this.creating.set(false);
    this.allGames.update((list) => [...(list ?? []), game]);
    this.router.navigate(['/games', game.id]);
  }
}
