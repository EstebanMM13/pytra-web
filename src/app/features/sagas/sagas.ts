import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { ICONS } from '../../shared/ui/icons';
import { TranslatePipe } from '@ngx-translate/core';
import { combineLatest, map } from 'rxjs';
import { Game } from '../../core/models/game.model';
import { Saga } from '../../core/models/saga.model';
import { GameService } from '../../core/services/game.service';
import { SagaService } from '../../core/services/saga.service';
import { Navbar } from '../../shared/navbar/navbar';
import { HoursPipe } from '../../shared/pipes/hours.pipe';
import { RatingPipe } from '../../shared/pipes/rating.pipe';
import { RatingTonePipe } from '../../shared/pipes/rating-tone.pipe';
import { TranslatePluralPipe } from '../../shared/pipes/translate-plural.pipe';
import { GameCover } from '../../shared/ui/game-cover';
import { SectionHeader } from '../../shared/ui/section-header';
import { Skeleton } from '../../shared/ui/skeleton';
import { StatCard } from '../../shared/ui/stat-card';
import { StatusPill } from '../../shared/ui/status-pill';
import { SagaDialog } from './saga-dialog';
import { Dropdown, DropdownOption } from '../../shared/ui/dropdown';
import { CoverTilt } from '../../shared/ui/cover-tilt';
import { ScrollParallax } from '../../shared/ui/scroll-parallax';
import {
  DEFAULT_SAGA_SORT,
  SAGA_SORTS,
  SagaSort,
  SagaSummary,
  filterSagas,
  isPlayed,
  parseSagaSort,
  playedPercent,
  releaseYear,
  sagaBackdropCover,
  sagaGameStatus,
  sagaMetaLine,
  sagaStudiosLine,
  sagaYearRange,
  sortSagas,
  summarizeSagas,
} from './saga.logic';

/** Pause in typing after which the saga search text is written to the URL (as in the library). */
const SEARCH_URL_DELAY_MS = 300;

/**
 * Sagas master-detail. `/sagas` and `/sagas/:id` render this same view: on web the list and the
 * selected saga sit side by side (first saga when none is in the URL); on mobile `/sagas` is the
 * list and `/sagas/:id` the detail screen. The list order lives in the `sort` query param
 * (whitelisted; the default A–Z stays out of the URL) and survives moving between sagas, like the
 * search text in `q` (saga or game name).
 */
@Component({
  selector: 'app-sagas',
  imports: [
    RouterLink,
    TranslatePipe,
    TranslatePluralPipe,
    Navbar,
    HoursPipe,
    RatingPipe,
    RatingTonePipe,
    SectionHeader,
    Skeleton,
    StatCard,
    StatusPill,
    SagaDialog,
    GameCover,
    Dropdown,
    CoverTilt,
    ScrollParallax,
    LucideDynamicIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sagas.html',
  styleUrls: ['./sagas.css', '../../shared/ui/cover-tilt.css'],
})
export class Sagas {
  protected readonly icons = ICONS;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sagaService = inject(SagaService);
  private readonly gameService = inject(GameService);

  protected readonly skeletons = [0, 1, 2, 3, 4];
  protected readonly isPlayed = isPlayed;
  protected readonly gameStatus = sagaGameStatus;
  protected readonly releaseYear = releaseYear;
  protected readonly playedPercent = playedPercent;
  protected readonly metaLine = sagaMetaLine;
  protected readonly studiosLine = sagaStudiosLine;
  protected readonly yearRange = sagaYearRange;
  protected readonly backdropCover = sagaBackdropCover;
  /** Covers in the detail hero's collage (up to four). */
  protected readonly collageCount = (games: number): number => Math.min(Math.max(games, 1), 4);

  private readonly sagas = signal<Saga[] | null>(null);
  private readonly games = signal<Game[]>([]);
  protected readonly loadError = signal(false);
  /** Dialog state: `undefined` closed, `null` creating, a saga when editing. */
  protected readonly dialog = signal<Saga | null | undefined>(undefined);

  /** Saga id in the URL, or null on `/sagas`. */
  protected readonly routeId = toSignal(
    this.route.paramMap.pipe(
      map((params) => {
        const id = Number(params.get('id'));
        return Number.isInteger(id) && id > 0 ? id : null;
      }),
    ),
    { requireSync: true },
  );

  protected readonly sort = toSignal(
    this.route.queryParamMap.pipe(map((params) => parseSagaSort(params.get('sort')))),
    { requireSync: true },
  );
  protected readonly sortOptions: readonly DropdownOption<SagaSort>[] = SAGA_SORTS.map((value) => ({
    value,
    label: `sagas.sort.${value}`,
  }));

  protected readonly loading = computed(() => this.sagas() === null);
  /** Every saga, sorted: the count next to the title (like the library's) ignores the search. */
  protected readonly summaries = computed(() =>
    sortSagas(summarizeSagas(this.sagas() ?? [], this.games()), this.sort()),
  );

  /**
   * Search box text. It filters on every keystroke; the URL (`q`) follows once typing pauses, so a
   * fast typist does not trigger a router navigation per key.
   */
  protected readonly searchText = signal(this.route.snapshot.queryParamMap.get('q') ?? '');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  /** Last `q` seen in the URL: sort changes re-emit the params without touching the search box. */
  private urlText = this.searchText();
  /** `q` this component wrote and whose URL echo has not arrived yet (it must not overwrite newer typing). */
  private echoText: string | null = null;

  /** The listed sagas: the sorted ones matching the search. */
  protected readonly visible = computed(() => filterSagas(this.summaries(), this.searchText()));

  /** The saga in the URL; without one (web), the first listed saga, else the first of all. */
  protected readonly selected = computed<SagaSummary | null>(() => {
    const id = this.routeId();
    if (id !== null) {
      return this.summaries().find((s) => s.saga.id === id) ?? null;
    }
    return this.visible()[0] ?? this.summaries()[0] ?? null;
  });

  constructor() {
    // `?create=1` (from the navbar "Añadir" menu) opens the create dialog once.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      if (params.get('create') === '1') {
        this.dialog.set(null);
        void this.router.navigate([], { queryParams: { create: null }, queryParamsHandling: 'merge', replaceUrl: true });
      }
    });
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
      clearTimeout(this.searchTimer);
      this.searchText.set(text);
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.searchTimer));
    // combineLatest, not forkJoin: cached lists render at once and a fresher emission replaces them.
    combineLatest([this.sagaService.findAll(), this.gameService.findAll()]).subscribe({
      next: ([sagas, games]) => {
        this.games.set(games);
        this.sagas.set(sagas);
      },
      error: () => {
        this.loadError.set(true);
        this.sagas.set([]);
      },
    });
  }

  protected setText(text: string): void {
    this.searchText.set(text);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.writeSearchToUrl(), SEARCH_URL_DELAY_MS);
  }

  protected clearSearch(): void {
    this.searchText.set('');
    clearTimeout(this.searchTimer);
    this.writeSearchToUrl();
  }

  private writeSearchToUrl(): void {
    this.searchTimer = undefined;
    const q = this.searchText();
    if (q === this.urlText) {
      return;
    }
    this.echoText = q;
    void this.router
      .navigate([], { queryParams: { q: q || null }, queryParamsHandling: 'merge', replaceUrl: true })
      .then(
        (done) => {
          // A cancelled navigation never echoes: drop the expectation so it cannot swallow a later one.
          if (!done && this.echoText === q) this.echoText = null;
        },
        () => {
          if (this.echoText === q) this.echoText = null;
        },
      );
  }

  protected setSort(sort: SagaSort): void {
    void this.router.navigate([], {
      queryParams: { sort: sort === DEFAULT_SAGA_SORT ? null : sort },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected onSaved(saga: Saga): void {
    const creating = this.dialog() === null;
    this.dialog.set(undefined);
    this.sagas.update((list) =>
      creating ? [...(list ?? []), saga] : (list ?? []).map((s) => (s.id === saga.id ? saga : s)),
    );
    if (creating) {
      this.router.navigate(['/sagas', saga.id], { queryParamsHandling: 'preserve' });
    }
  }

  protected onDeleted(id: number): void {
    this.dialog.set(undefined);
    this.sagas.update((list) => (list ?? []).filter((s) => s.id !== id));
    // The API leaves the saga's games without saga.
    this.games.update((list) => list.map((g) => (g.sagaId === id ? { ...g, sagaId: null, sagaName: null } : g)));
    this.router.navigate(['/sagas'], { replaceUrl: true, queryParamsHandling: 'preserve' });
  }
}
