import { ChangeDetectionStrategy, Component, computed, inject, signal, effect, untracked } from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { ICONS } from '../../shared/ui/icons';
import { TranslatePipe } from '@ngx-translate/core';
import { Dropdown, DropdownOption } from '../../shared/ui/dropdown';
import { map } from 'rxjs';
import { Game } from '../../core/models/game.model';
import { GameService } from '../../core/services/game.service';
import { platformNameKey } from '../../core/services/platform.logic';
import { Navbar } from '../../shared/navbar/navbar';
import { HoursPipe } from '../../shared/pipes/hours.pipe';
import { RatingPipe } from '../../shared/pipes/rating.pipe';
import { RatingTonePipe } from '../../shared/pipes/rating-tone.pipe';
import { TranslatePluralPipe } from '../../shared/pipes/translate-plural.pipe';
import { GameCover } from '../../shared/ui/game-cover';
import { Pagination } from '../../shared/ui/pagination';
import { Skeleton } from '../../shared/ui/skeleton';
import { StatusPill } from '../../shared/ui/status-pill';
import { CategoryBadge, UpcomingBadge } from '../../shared/ui/game-badges';
import { todayIso } from '../../shared/utils/run-dates';
import { GameEditDialog } from './game-edit-dialog/game-edit-dialog';
import {
  isUpcoming,
  libraryPlatforms,
  LibraryCategoryFilter,
  LIBRARY_SORTS,
  LIBRARY_STATUS_FILTERS,
  isOnlineOnly,
  LibraryQuery,
  LibrarySort,
  LibraryStatusFilter,
  countByStatus,
  filterGames,
  isLibraryGame,
  LIBRARY_VIEW_KEY,
  LibraryView,
  libraryGenres,
  libraryStatusLine,
  matchesPanelFilters,
  paginate,
  panelFilterCount,
  parseCategoryFilter,
  parseIdList,
  parseLibraryView,
  parsePage,
  parseSort,
  parseStatusFilter,
  pruneIds,
  serializeIdList,
} from './library.logic';
import { LibraryFilters } from './library-filters';
import { formatGenreName } from '../../shared/pipes/genre-name.pipe';

/**
 * Library (/games): confirmed games with their run aggregates, filtered, sorted and paged on the
 * client. Filters live in the URL (`q`, `status`, `platform` and `genre` as comma-separated ids, `category`,
 * `sort`, `page`) so back navigation restores them.
 * The list / grid view is a per-device preference (localStorage); the grid shows every result, unpaged.
 */
@Component({
  selector: 'app-games',
  imports: [
    GameCover,
    RouterLink,
    TranslatePipe,
    TranslatePluralPipe,
    Navbar,
    HoursPipe,
    RatingPipe,
    RatingTonePipe,
    Pagination,
    Dropdown,
    Skeleton,
    StatusPill,
    CategoryBadge,
    UpcomingBadge,
    GameEditDialog,
    LibraryFilters,
    LucideDynamicIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './games.html',
})
export class Games {
  protected readonly icons = ICONS;

  private readonly gameService = inject(GameService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly statusFilters = LIBRARY_STATUS_FILTERS;
  protected readonly isOnlineOnly = isOnlineOnly;
  protected readonly statusLine = libraryStatusLine;
  /** Fixed when the page loads: good enough for a "coming soon" badge. */
  private readonly today = todayIso();
  protected readonly isUpcoming = (game: Game): boolean => isUpcoming(game, this.today);
  protected readonly sorts = LIBRARY_SORTS;
  protected readonly sortOptions: DropdownOption[] = LIBRARY_SORTS.map((s) => ({ value: s, label: `library.sort.${s}` }));
  protected readonly skeletonRows = Array.from({ length: 8 }, (_, i) => i);

  /** `null` while loading. */
  private readonly allGames = signal<Game[] | null>(null);
  protected readonly loadError = signal(false);
  protected readonly creating = signal(false);
  protected readonly views: readonly LibraryView[] = ['list', 'grid'];
  protected readonly view = signal<LibraryView>(readLibraryView());

  /** Filters exactly as in the URL. */
  private readonly urlQuery = toSignal(
    this.route.queryParamMap.pipe(
      map(
        (params) =>
          ({
            text: params.get('q') ?? '',
            status: parseStatusFilter(params.get('status')),
            sort: parseSort(params.get('sort')),
            platforms: parseIdList(params.get('platform')).map(String),
            genres: parseIdList(params.get('genre')),
            category: parseCategoryFilter(params.get('category')),
            page: parsePage(params.get('page')),
          }) satisfies LibraryQuery & { page: number },
      ),
    ),
    { requireSync: true },
  );

  protected readonly loading = computed(() => this.allGames() === null);

  /** The URL filters, minus platform / genre ids the loaded library does not have. */
  protected readonly query = computed(() => {
    const query = this.urlQuery();
    if (this.loading()) {
      return query;
    }
    return {
      ...query,
      platforms: pruneIds(query.platforms, this.platforms().map((p) => String(p.id))),
      genres: pruneIds(query.genres, this.genreOptions().map((g) => g.id)),
    };
  });
  protected readonly libraryGames = computed(() => (this.allGames() ?? []).filter(isLibraryGame));
  protected readonly pendingReviewCount = computed(
    () => (this.allGames() ?? []).filter((g) => !isLibraryGame(g)).length,
  );
  /** Only the platforms the user's games were played on (runs or online). */
  protected readonly platforms = computed(() => libraryPlatforms(this.libraryGames()));
  /** Only the genres present in the library. */
  protected readonly genreOptions = computed(() => libraryGenres(this.libraryGames(), formatGenreName));
  protected readonly filterCount = computed(() => panelFilterCount(this.query()));
  /** Removable chips for the active panel filters. */
  protected readonly filterChips = computed(() => {
    const query = this.query();
    const chips: { kind: 'category' | 'platform' | 'genre'; id: string; label: string }[] = [];
    if (query.category !== 'ALL') {
      chips.push({ kind: 'category', id: query.category, label: `category.${query.category}` });
    }
    const platforms = new Map(this.platforms().map((p) => [String(p.id), p.name]));
    for (const id of query.platforms) {
      const name = platforms.get(id);
      if (name) chips.push({ kind: 'platform', id, label: this.platformLabel(name) });
    }
    const genres = new Map(this.genreOptions().map((g) => [g.id, g.label]));
    for (const id of query.genres) {
      const label = genres.get(id);
      if (label) chips.push({ kind: 'genre', id: String(id), label });
    }
    return chips;
  });
  protected readonly platformLabel = (name: string): string => platformNameKey(name) ?? name;
  protected readonly runCount = computed(() =>
    this.libraryGames().reduce((sum, g) => sum + (g.experienceCount ?? 0), 0),
  );

  /** Tab counters follow the name and panel filters, so they add up to what each tab would show. */
  protected readonly statusCounts = computed(() =>
    countByStatus(this.libraryGames().filter((g) => matchesPanelFilters(g, this.query()))),
  );
  protected readonly filtered = computed(() => filterGames(this.libraryGames(), this.query()));
  protected readonly page = computed(() => paginate(this.filtered(), this.query().page));
  protected readonly hasFilters = computed(
    () =>
      !!this.query().text.trim() ||
      this.query().status !== 'ALL' ||
      this.filterCount() > 0,
  );

  constructor() {
    // `?create=1` (from the navbar "Añadir" menu) opens the create dialog once.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      if (params.get('create') === '1') {
        this.creating.set(true);
        void this.router.navigate([], { queryParams: { create: null }, queryParamsHandling: 'merge', replaceUrl: true });
      }
    });
    this.load();

    // Unknown platform / genre ids (stale links): drop them from the URL too.
    effect(() => {
      if (this.loading()) {
        return;
      }
      const url = this.urlQuery();
      const { platforms, genres } = this.query();
      if (platforms.length !== url.platforms.length || genres.length !== url.genres.length) {
        untracked(() =>
          this.updateQuery({ platform: serializeIdList(platforms), genre: serializeIdList(genres) }),
        );
      }
    });

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

  protected setPlatforms(platforms: readonly string[]): void {
    this.updateQuery({ platform: serializeIdList(parseIdList(platforms.join(','))), page: null });
  }

  protected setGenres(genres: readonly number[]): void {
    this.updateQuery({ genre: serializeIdList(parseIdList(genres.join(','))), page: null });
  }

  protected removeChip(chip: { kind: 'category' | 'platform' | 'genre'; id: string }): void {
    const query = this.query();
    if (chip.kind === 'category') this.setCategory('ALL');
    else if (chip.kind === 'platform') this.setPlatforms(query.platforms.filter((p) => p !== chip.id));
    else this.setGenres(query.genres.filter((g) => String(g) !== chip.id));
  }

  /** Clears the filter panel only (type, platforms, genres); search and status tab stay. */
  protected clearPanelFilters(): void {
    this.updateQuery({ platform: null, genre: null, category: null, page: null });
  }

  protected setCategory(category: string): void {
    const parsed: LibraryCategoryFilter = parseCategoryFilter(category);
    this.updateQuery({ category: parsed === 'ALL' ? null : parsed, page: null });
  }

  protected setPage(page: number): void {
    this.updateQuery({ page: page > 1 ? page : null }, false);
  }

  protected setView(view: LibraryView): void {
    this.view.set(view);
    try {
      localStorage.setItem(LIBRARY_VIEW_KEY, view);
    } catch {
      // Storage unavailable (private mode, quota): keep the in-memory choice only.
    }
  }

  protected clearFilters(): void {
    this.updateQuery({ q: null, status: null, platform: null, genre: null, category: null, page: null });
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

function readLibraryView(): LibraryView {
  try {
    return parseLibraryView(localStorage.getItem(LIBRARY_VIEW_KEY));
  } catch {
    return 'list';
  }
}
