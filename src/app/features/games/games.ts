import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal, effect, untracked } from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { ICONS } from '../../shared/ui/icons';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, map, of } from 'rxjs';
import { Game } from '../../core/models/game.model';
import { GameService } from '../../core/services/game.service';
import { PsnService } from '../../core/services/psn.service';
import { SteamService } from '../../core/services/steam.service';
import { platformNameKey } from '../../core/services/platform.logic';
import { Navbar } from '../../shared/navbar/navbar';
import { HoursPipe } from '../../shared/pipes/hours.pipe';
import { RatingPipe } from '../../shared/pipes/rating.pipe';
import { RatingTonePipe } from '../../shared/pipes/rating-tone.pipe';
import { TranslatePluralPipe } from '../../shared/pipes/translate-plural.pipe';
import { CoverTilt } from '../../shared/ui/cover-tilt';
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
  LIBRARY_STATUS_FILTERS,
  isOnlineOnly,
  LibraryQuery,
  LibrarySort,
  LibraryStatusFilter,
  countByStatus,
  filterGames,
  isLibraryGame,
  PENDING_BANNER_KEYS,
  pendingSource,
  LIBRARY_VIEW_KEY,
  LibraryView,
  libraryGenres,
  libraryNames,
  libraryStatusLine,
  matchesPanelFilters,
  paginate,
  panelFilterCount,
  parseCategoryFilter,
  parseIdList,
  parseLibraryView,
  parseNameList,
  parsePage,
  parseSort,
  parseStatusFilter,
  pruneIds,
  pruneNames,
  serializeIdList,
  serializeNameList,
} from './library.logic';
import { LibraryFilters } from './library-filters';
import { LibraryStatusPicker } from './library-status-picker';
import { formatGenreName } from '../../shared/pipes/genre-name.pipe';

/** Pause in typing after which the library search text is written to the URL. */
const SEARCH_URL_DELAY_MS = 300;

/** Removable chip of an active panel filter; `id` is the platform / genre id or the developer / publisher name. */
interface FilterChip {
  kind: 'category' | 'platform' | 'genre' | 'developer' | 'publisher';
  id: string;
  label: string;
}

/**
 * Library (/games): confirmed games with their run aggregates, filtered, sorted and paged on the
 * client. Filters live in the URL (`q`, `status`, `platform` and `genre` as comma-separated ids, `dev` and
 * `pub` as repeated names, `category`, `sort`, `page`) so back navigation restores them.
 * The list / grid view is a per-device preference (localStorage); the grid shows every result, unpaged.
 */
@Component({
  selector: 'app-games',
  imports: [
    CoverTilt,
    GameCover,
    RouterLink,
    TranslatePipe,
    TranslatePluralPipe,
    Navbar,
    HoursPipe,
    RatingPipe,
    RatingTonePipe,
    Pagination,
    Skeleton,
    StatusPill,
    CategoryBadge,
    UpcomingBadge,
    GameEditDialog,
    LibraryFilters,
    LibraryStatusPicker,
    LucideDynamicIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './games.html',
  styleUrls: ['./games.css', '../../shared/ui/platinum-glow.css'],
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
            developers: parseNameList(params.getAll('dev')),
            publishers: parseNameList(params.getAll('pub')),
            page: parsePage(params.get('page')),
          }) satisfies LibraryQuery & { page: number },
      ),
    ),
    { requireSync: true },
  );

  protected readonly loading = computed(() => this.allGames() === null);

  /**
   * Search box text. It filters on every keystroke; the URL (`q`) follows once typing pauses, so
   * a fast typist does not trigger a router navigation (and a history.replaceState) per key.
   */
  protected readonly searchText = signal(this.urlQuery().text);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  /** `q` this component wrote and whose URL echo has not arrived yet (it must not overwrite newer typing). */
  private echoText: string | null = null;
  /** Last `q` seen in the URL: other filter changes re-emit the params without touching the search box. */
  private urlText = this.searchText();

  /** The URL filters, minus platform / genre ids and developer / publisher names the loaded library does not have. */
  protected readonly query = computed(() => {
    const url = this.urlQuery();
    const text = this.searchText();
    // Typing ahead of the URL behaves like `setText` did: back to the first page.
    const query = text === url.text ? url : { ...url, text, page: 1 };
    if (this.loading()) {
      return query;
    }
    return {
      ...query,
      platforms: pruneIds(query.platforms, this.platforms().map((p) => String(p.id))),
      genres: pruneIds(query.genres, this.genreOptions().map((g) => g.id)),
      developers: pruneNames(query.developers, this.developers()),
      publishers: pruneNames(query.publishers, this.publishers()),
    };
  });
  protected readonly libraryGames = computed(() => (this.allGames() ?? []).filter(isLibraryGame));
  /** Games imported by Steam or PSN still waiting for review (not part of the library yet). */
  private readonly pendingGames = computed(() => (this.allGames() ?? []).filter((g) => !isLibraryGame(g)));
  protected readonly pendingReviewCount = computed(() => this.pendingGames().length);
  /** Ids of each integration's pending list (empty when not linked or on failure), to name the source. */
  private readonly steamPendingIds = toSignal(
    inject(SteamService)
      .getPending()
      .pipe(
        map((games) => new Set(games.map((g) => g.id))),
        catchError(() => of(new Set<number>())),
      ),
    { initialValue: new Set<number>() },
  );
  private readonly psnPendingIds = toSignal(
    inject(PsnService)
      .getPending()
      .pipe(
        map((games) => new Set(games.map((g) => g.id))),
        catchError(() => of(new Set<number>())),
      ),
    { initialValue: new Set<number>() },
  );
  /** Banner copy: Steam only, PSN only, or neutral when both (or the source is unknown). */
  protected readonly pendingBannerKey = computed(
    () => PENDING_BANNER_KEYS[pendingSource(this.pendingGames(), this.steamPendingIds(), this.psnPendingIds())],
  );
  /** Only the platforms the user's games were played on (runs or online). */
  protected readonly platforms = computed(() => libraryPlatforms(this.libraryGames()));
  /** Only the genres present in the library. */
  protected readonly genreOptions = computed(() => libraryGenres(this.libraryGames(), formatGenreName));
  /** Developers and publishers present in the library. */
  protected readonly developers = computed(() => libraryNames(this.libraryGames(), (g) => g.developer));
  protected readonly publishers = computed(() => libraryNames(this.libraryGames(), (g) => g.publisher));
  protected readonly filterCount = computed(() => panelFilterCount(this.query()));
  /** Removable chips for the active panel filters. */
  protected readonly filterChips = computed(() => {
    const query = this.query();
    const chips: FilterChip[] = [];
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
    for (const name of query.developers) chips.push({ kind: 'developer', id: name, label: name });
    for (const name of query.publishers) chips.push({ kind: 'publisher', id: name, label: name });
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

    // External `q` changes (back / forward, links) reach the search box; the echo of our own write is skipped.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const text = params.get('q') ?? '';
      if (text === this.urlText) {
        return;
      }
      this.urlText = text;
      if (text === this.echoText) {
        this.echoText = null;
        return;
      }
      this.echoText = null;
      this.cancelSearchSync();
      this.searchText.set(text);
    });
    inject(DestroyRef).onDestroy(() => this.cancelSearchSync());

    // Unknown platform / genre ids and developer / publisher names (stale links): drop them from the URL too.
    effect(() => {
      if (this.loading()) {
        return;
      }
      const url = this.urlQuery();
      const { platforms, genres, developers, publishers } = this.query();
      if (
        platforms.length !== url.platforms.length ||
        genres.length !== url.genres.length ||
        developers.length !== url.developers.length ||
        publishers.length !== url.publishers.length
      ) {
        untracked(() =>
          this.updateQuery({
            platform: serializeIdList(platforms),
            genre: serializeIdList(genres),
            dev: serializeNameList(developers),
            pub: serializeNameList(publishers),
          }),
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
    this.searchText.set(text);
    this.cancelSearchSync();
    this.searchTimer = setTimeout(() => {
      this.searchTimer = undefined;
      this.updateQuery({ page: null });
    }, SEARCH_URL_DELAY_MS);
  }

  private cancelSearchSync(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = undefined;
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

  protected setDevelopers(developers: readonly string[]): void {
    this.updateQuery({ dev: serializeNameList(parseNameList(developers)), page: null });
  }

  protected setPublishers(publishers: readonly string[]): void {
    this.updateQuery({ pub: serializeNameList(parseNameList(publishers)), page: null });
  }

  protected removeChip(chip: Pick<FilterChip, 'kind' | 'id'>): void {
    const query = this.query();
    if (chip.kind === 'category') this.setCategory('ALL');
    else if (chip.kind === 'platform') this.setPlatforms(query.platforms.filter((p) => p !== chip.id));
    else if (chip.kind === 'developer') this.setDevelopers(query.developers.filter((d) => d !== chip.id));
    else if (chip.kind === 'publisher') this.setPublishers(query.publishers.filter((p) => p !== chip.id));
    else this.setGenres(query.genres.filter((g) => String(g) !== chip.id));
  }

  /** Clears the filter panel only (type, platforms, genres, developers, publishers); search and status tab stay. */
  protected clearPanelFilters(): void {
    this.updateQuery({ platform: null, genre: null, category: null, dev: null, pub: null, page: null });
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
    this.updateQuery({
      q: null,
      status: null,
      platform: null,
      genre: null,
      category: null,
      dev: null,
      pub: null,
      page: null,
    });
  }

  /** Typing and toggles replace the history entry; page changes push one so "back" pages back. */
  private updateQuery(params: Params, replaceUrl = true): void {
    // Every URL write carries the search text, so a pending search is never lost or reverted.
    this.cancelSearchSync();
    if ('q' in params) {
      this.searchText.set(params['q'] ?? '');
    }
    const q = this.searchText();
    const echo = q !== this.urlQuery().text ? q : null;
    if (echo !== null) {
      this.echoText = echo;
    }
    params = { ...params, q: q || null };
    // A cancelled or failed navigation never echoes: drop the expectation so it cannot swallow a
    // later back / forward to the same text.
    const dropEcho = () => {
      if (echo !== null && this.echoText === echo) {
        this.echoText = null;
      }
    };
    this.router
      .navigate([], {
        relativeTo: this.route,
        queryParams: params,
        queryParamsHandling: 'merge',
        replaceUrl,
      })
      .then((navigated) => {
        if (!navigated) dropEcho();
      }, dropEcho);
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
