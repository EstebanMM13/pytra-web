import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, shareReplay } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { ICONS } from '../../../shared/ui/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Experience } from '../../../core/models/experience.model';
import { Game } from '../../../core/models/game.model';
import { OnlinePlaytime } from '../../../core/models/online-playtime.model';
import { ExperienceService } from '../../../core/services/experience.service';
import { GameService } from '../../../core/services/game.service';
import { UserDataCache } from '../../../core/services/user-data-cache';
import { OnlinePlaytimeService } from '../../../core/services/online-playtime.service';
import { RunFormLauncher } from '../../../core/services/run-form-launcher.service';
import { Navbar } from '../../../shared/navbar/navbar';
import { formatGenreName } from '../../../shared/pipes/genre-name.pipe';
import { HoursPipe } from '../../../shared/pipes/hours.pipe';
import { RatingPipe } from '../../../shared/pipes/rating.pipe';
import { PlatformLabel, platformDisplayName } from '../../../shared/ui/platform-label';
import { PlatformRef } from '../../../core/models/platform.model';
import {
  distinctPlatformRefs,
  groupPlatformsByFamily,
  orderPlatformRefsLike,
  platformNameKey,
} from '../../../core/services/platform.logic';
import { PlatformService } from '../../../core/services/platform.service';
import { RatingTonePipe } from '../../../shared/pipes/rating-tone.pipe';
import { ToastService } from '../../../shared/toast/toast.service';
import { RunRow } from '../../../shared/ui/run-row';
import { GameCover } from '../../../shared/ui/game-cover';
import { SectionHeader } from '../../../shared/ui/section-header';
import { Skeleton } from '../../../shared/ui/skeleton';
import { decimalValidator, formatHoursInput, parseDecimal } from '../../../shared/utils/decimal-input';
import { fromRatingScale, isValidTypedRating, scaledRatingDraft } from '../../../shared/utils/rating-scale';
import { PreferencesService } from '../../../core/services/preferences.service';
import { StatCard } from '../../../shared/ui/stat-card';
import { StatusPill } from '../../../shared/ui/status-pill';
import { formatDayMonthYear, formatRunPeriod } from '../../../shared/utils/run-dates';
import { GameEditDialog } from '../game-edit-dialog/game-edit-dialog';
import { GenreChips } from './genre-chips';
import { GameDiaryDays } from './game-diary-days';
import { ScrollParallax } from '../../../shared/ui/scroll-parallax';
import { CoverViewer } from './cover-viewer';
import { TitleClamp } from './title-clamp';
import {
  OnlineFlags,
  OnlinePlaytimeLoadState,
  buildOnlinePlaytimeRequest,
  onlineFlagsOf,
  onlinePlaytimeErrorState,
  shouldCelebrateOnline,
} from './online-playtime.logic';
import { CategoryBadge, UpcomingBadge } from '../../../shared/ui/game-badges';
import { figureFontSize } from '../../../shared/ui/stat-card';
import { isUpcoming } from '../library.logic';
import { toastApiError } from '../../../shared/utils/api-error';
import { burstConfetti } from '../../../shared/utils/confetti';
import { DemoModeService } from '../../../core/services/demo-mode.service';

/** Newest run first: end date, else start date, else stored year; ties by id. */
function byRecencyDesc(a: Experience, b: Experience): number {
  const key = (e: Experience) => e.endDate ?? e.startDate ?? (e.year ? `${e.year}-01-01` : '');
  return key(b).localeCompare(key(a)) || b.id - a.id;
}

/** Saga order: release date (undated last), then name. */
function byRelease(a: Game, b: Game): number {
  const ra = a.releaseDate ?? '9999';
  const rb = b.releaseDate ?? '9999';
  return ra.localeCompare(rb) || a.name.localeCompare(b.name);
}

/** Grid classes of the stats section (`section`) and of each card of it (empty: one cell). */
interface StatsGrid {
  section: string;
  /** Hours card shows the figure beside the campaign / online bar and legend. */
  wideHours: boolean;
  hours: string;
  runs: string;
  avg: string;
  best: string;
  /** Online rating card of ONLINE games. */
  rating: string;
  /** The 100% and platinum cards. */
  trophies: string;
}

const PLAIN_GRID: StatsGrid = {
  section: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
  wideHours: false,
  hours: '',
  runs: '',
  avg: '',
  best: '',
  rating: '',
  trophies: '',
};

const PLAIN_ONLINE_GRID: StatsGrid = { ...PLAIN_GRID, section: 'grid-cols-2 md:grid-cols-4' };

const WIDE_HOURS_HYBRID_GRID: StatsGrid = {
  section: 'grid-cols-6 md:grid-cols-12 xl:grid-cols-7',
  wideHours: true,
  hours: 'col-span-6 xl:col-span-2',
  runs: 'col-span-2 md:col-span-3 xl:col-span-1',
  avg: 'col-span-2 md:col-span-3 xl:col-span-1',
  best: 'col-span-2 md:col-span-4 xl:col-span-1',
  rating: '',
  trophies: 'col-span-3 md:col-span-4 xl:col-span-1',
};

const WIDE_HOURS_ONLINE_GRID: StatsGrid = {
  section: 'grid-cols-6 md:grid-cols-2 lg:grid-cols-5',
  wideHours: true,
  hours: 'col-span-6 md:col-span-1 lg:col-span-2',
  runs: '',
  avg: '',
  best: '',
  rating: 'col-span-2 md:col-span-1',
  trophies: 'col-span-2 md:col-span-1',
};

/** Legend column of the wide hours card (dot, label and hours of the longer line) plus its gap. */
const HOURS_LEGEND_PX = 128;

@Component({
  selector: 'app-game-detail',
  imports: [
    ScrollParallax,
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    Navbar,
    HoursPipe,
    RatingPipe,
    RatingTonePipe,
    PlatformLabel,
    RunRow,
    GameCover,
    SectionHeader,
    Skeleton,
    StatCard,
    StatusPill,
    GameEditDialog,
    UpcomingBadge,
    CategoryBadge,
    GenreChips,
    GameDiaryDays,
    CoverViewer,
    TitleClamp,
    LucideDynamicIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-detail.html',
  styleUrls: ['./game-detail.css', '../../../shared/ui/platinum-glow.css'],
})
export class GameDetail {
  protected readonly icons = ICONS;

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly gameService = inject(GameService);
  private readonly cache = inject(UserDataCache);
  private readonly experienceService = inject(ExperienceService);
  private readonly onlinePlaytimeService = inject(OnlinePlaytimeService);
  private readonly platformService = inject(PlatformService);
  private readonly runFormLauncher = inject(RunFormLauncher);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  protected readonly preferences = inject(PreferencesService);
  private readonly demo = inject(DemoModeService);

  protected readonly statIcons = {
    runs: ICONS.play,
    hours: ICONS.clock,
    rating: ICONS.star,
    best: ICONS.award,
    platinum: ICONS.trophy,
    fullCompletion: ICONS.badgeCheck,
  };

  /** Hero figure size: shrinks long values to the cell width instead of cutting them. */
  protected readonly figureSize = (value: string | number, reservePx = 0): string =>
    figureFontSize(String(value), reservePx);

  /** Room kept beside the hours figure for the campaign / online legend of the wide hours card. */
  protected readonly hoursLegendPx = HOURS_LEGEND_PX;

  readonly gameId = signal(0);
  readonly game = signal<Game | null>(null);
  /** `null` while loading. */
  readonly experiences = signal<Experience[] | null>(null);
  readonly onlinePlaytime = signal<OnlinePlaytime | null>(null);
  readonly sagaGames = signal<Game[]>([]);
  readonly loadError = signal(false);
  readonly editing = signal(false);
  /** The hero cover is open in the fullscreen viewer. */
  readonly coverOpen = signal(false);
  readonly savingOnline = signal(false);
  /** Platforms picked in the online card, in catalog order. */
  readonly onlinePlatforms = signal<PlatformRef[]>([]);
  /** Whether the picker changed since the card loaded (decides if the PUT sends platformIds). */
  private readonly onlinePlatformsTouched = signal(false);
  readonly savingOnlinePlatforms = signal(false);
  /** The online card's platinum / 100% switches: the stored flags, or pending ones before the first save. */
  readonly onlineFlags = signal<OnlineFlags>({ platinum: false, fullCompletion: false });
  readonly savingOnlineFlags = signal(false);
  readonly onlineLoadState = signal<OnlinePlaytimeLoadState>('loading');
  /** Online playtime requested alongside the game (by route id), consumed by the first `loadOnlinePlaytime`. */
  private onlinePrefetch: { id: number; playtime$: Observable<OnlinePlaytime> } | null = null;
  /**
   * Bumped by every local write on this page (game edit, online playtime / platforms). A findById
   * refresh started before a write answers with pre-write data and is ignored.
   */
  private localWrites = 0;

  // Text inputs so "12,5" works on every keyboard/locale (number inputs drop it as empty).
  readonly onlinePlaytimeForm = this.fb.group({
    totalHours: this.fb.control('0', [Validators.required, decimalValidator('hours', (h) => h >= 0)]),
    // Typed on the rating scale with the run form's rules; stored on 0–10 with two decimals.
    generalRating: this.fb.control(
      '',
      decimalValidator('rating', (r) =>
        isValidTypedRating(
          r,
          this.preferences.ratingScale(),
          this.preferences.ratingPrecision(),
          this.onlinePlaytime()?.generalRating ?? null,
        ),
      ),
    ),
  });

  protected readonly runs = computed(() => [...(this.experiences() ?? [])].sort(byRecencyDesc));

  /** Run ratings plus the online general rating: the same set the library's bestRating uses. */
  protected readonly ratings = computed(() =>
    [...this.runs().map((r) => r.rating), this.onlinePlaytime()?.generalRating ?? null].filter(
      (r): r is number => r !== null,
    ),
  );

  /**
   * Hours are summed here from the loaded runs and online playtime (not read from the game's
   * totalHours aggregate, which already includes both) so the card stays current after a run or the
   * online card is saved.
   */
  protected readonly stats = computed(() => {
    const runs = this.runs();
    const ratings = this.ratings();
    const runHours = runs.reduce((sum, r) => sum + (r.hours ?? 0), 0);
    const onlineHours = this.onlinePlaytime()?.totalHours ?? 0;
    return {
      runs: runs.length,
      runHours,
      onlineHours,
      totalHours: runHours + onlineHours,
      avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
      bestRating: ratings.length ? Math.max(...ratings) : null,
      // Hybrid games light the tiles from either source: a run or the online playtime.
      platinum: runs.some((r) => r.platinum) || !!this.onlinePlaytime()?.platinum,
      fullCompletion: runs.some((r) => r.fullCompletion) || !!this.onlinePlaytime()?.fullCompletion,
    };
  });

  /**
   * Any run or the online playtime earned the platinum (or the API says the game has one): the
   * Platinum tile lights up.
   */
  protected readonly platinum = computed(() => this.stats().platinum || !!this.game()?.hasPlatinum);

  /** Same sources as `platinum`, for the 100% tile. Independent of platinum. */
  protected readonly fullCompletion = computed(() => this.stats().fullCompletion || !!this.game()?.hasFullCompletion);

  /** Highlighted only when there is something to compare against. */
  protected readonly bestRunId = computed(() => {
    const runs = this.runs();
    const best = this.stats().bestRating;
    if (runs.length < 2 || best === null) {
      return null;
    }
    return runs.find((r) => r.rating === best)?.id ?? null;
  });

  /**
   * Union of the loaded runs' platforms and the online platforms, in catalog order (the API aggregate
   * until the runs load, so the header does not flicker).
   */
  protected readonly platforms = computed<PlatformRef[]>(() => {
    const fromApi = this.game()?.platformRefs ?? [];
    const local = distinctPlatformRefs([
      ...this.runs().map((r) => ({ id: r.platformId, name: r.platformName, color: r.platformColor })),
      ...(this.onlinePlaytime()?.platforms ?? []),
    ]);
    if (this.experiences() === null || !local.length) {
      return fromApi;
    }
    return orderPlatformRefsLike(local, this.platformService.platforms() ?? fromApi);
  });

  /** ONLINE games are tracked through online playtime only: no "new run" entry points. */
  protected readonly canAddRun = computed(() => this.game()?.category !== 'ONLINE');

  /**
   * ONLINE games are tracked through online playtime only: their stats skip runs and best rating, and
   * show the online platinum / 100% next to the hours and rating.
   */
  protected readonly isOnlineGame = computed(() => this.game()?.category === 'ONLINE');

  /** The online general rating, the "Nota" of an ONLINE game. */
  protected readonly onlineRating = computed(() => this.onlinePlaytime()?.generalRating ?? null);

  /**
   * Campaign vs online split under the total: HYBRID games, and ONLINE ones only when some runs exist
   * (older data); a split of "0 h campaign" says nothing for a pure online game.
   */
  protected readonly showHoursBreakdown = computed(() => {
    const category = this.game()?.category;
    return category === 'HYBRID' || (category === 'ONLINE' && this.stats().runHours > 0);
  });

  /**
   * Grid classes of the stats section and of each card. Without the campaign / online split every
   * card takes one cell. With it, the hours card goes wide (figure left, bar + legend right) so it is
   * as tall as its neighbours, and the other cards still form even rows:
   * - HYBRID: phones hours alone, then runs / average / best three across and 100% / platinum two
   *   across; tablets hours + runs + average, then best / 100% / platinum; wide screens one row with
   *   the hours card two cells wide.
   * - ONLINE with runs: phones hours alone, then rating / 100% / platinum three across; tablets two by
   *   two; desktops one row with the hours card two cells wide.
   */
  protected readonly statsGrid = computed<StatsGrid>(() => {
    const online = this.isOnlineGame();
    if (!this.showHoursBreakdown()) {
      return online ? PLAIN_ONLINE_GRID : PLAIN_GRID;
    }
    return online ? WIDE_HOURS_ONLINE_GRID : WIDE_HOURS_HYBRID_GRID;
  });

  /** Campaign (runs) share of the total hours, for the breakdown bar; 100 without hours. */
  protected readonly campaignShare = computed(() => {
    const { runHours, totalHours } = this.stats();
    return totalHours > 0 ? Math.round((runHours / totalHours) * 1000) / 10 : 100;
  });

  protected readonly upcoming = computed(() => {
    const game = this.game();
    return !!game && isUpcoming(game);
  });

  /** Catalog entries not yet picked for the online card, grouped by family; null while loading. */
  protected readonly onlinePlatformGroups = computed(() => {
    const catalog = this.platformService.platforms();
    if (!catalog) {
      return null;
    }
    const picked = new Set(this.onlinePlatforms().map((p) => p.id));
    return groupPlatformsByFamily(catalog.filter((p) => !picked.has(p.id)));
  });

  protected readonly platformLabel = (name: string): string => platformNameKey(name) ?? name;

  protected readonly platformNames = computed(() =>
    this.platforms()
      .map((p) => platformDisplayName(p.name, this.translate))
      .join(', '),
  );

  /** Display names, sorted so the order is stable everywhere (the API returns genres as an unordered set). */
  protected readonly genres = computed(() =>
    (this.game()?.genres ?? []).map((g) => formatGenreName(g.name)).sort((a, b) => a.localeCompare(b, 'es')),
  );

  protected readonly sagaPosition = computed(() => {
    const games = this.sagaGames();
    const index = games.findIndex((g) => g.id === this.gameId());
    return index >= 0 ? { index: index + 1, total: games.length } : null;
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.load(Number(params.get('id')));
    });

    this.runFormLauncher.saved$.pipe(takeUntilDestroyed()).subscribe(({ experience }) => {
      if (experience.gameId === this.gameId()) {
        this.loadRuns();
      }
    });
  }

  private load(id: number): void {
    this.gameId.set(id);
    this.game.set(null);
    this.experiences.set(null);
    this.onlinePlaytime.set(null);
    this.sagaGames.set([]);
    this.loadError.set(false);
    this.editing.set(false);
    this.coverOpen.set(false);

    // Requests that only need the id start alongside the game instead of after it: the platform
    // catalog (cached after the first load) and the online playtime (ignored for SINGLEPLAYER games).
    this.platformService.load().subscribe({ error: () => {} });
    const playtime$ = this.onlinePlaytimeService.findByGame(id).pipe(shareReplay({ bufferSize: 1, refCount: false }));
    playtime$.subscribe({ error: () => {} });
    this.onlinePrefetch = { id, playtime$ };

    // Stale-while-revalidate: coming from the library or the dashboard the game is already in the
    // cached list, so the hero renders at once; findById then refreshes it.
    const seeded = this.gameService.cachedById(id);
    if (seeded) {
      this.game.set(seeded);
      this.loadOnlinePlaytime(seeded);
      this.loadSaga(seeded);
    }

    // Every handler checks the id: a late answer for the previous game must not overwrite this one,
    // nor an answer requested before a local write (the seed lets the user edit while it loads).
    const writes = this.localWrites;
    const stale = (): boolean => id !== this.gameId() || writes !== this.localWrites;
    this.gameService.findById(id).subscribe({
      next: (game) => {
        if (stale()) return;
        const previous = this.game();
        this.game.set(game);
        // After a seed, only reload what the fresh game changes (the online card keeps its edits).
        if (!previous || previous.category !== game.category) this.loadOnlinePlaytime(game);
        if (!previous || previous.sagaId !== game.sagaId) this.loadSaga(game);
      },
      error: (error: unknown) => {
        if (stale()) return;
        const gone = error instanceof HttpErrorResponse && error.status === 404;
        // Deleted elsewhere: the cached lists (library, dashboard) must not keep showing it.
        if (gone) this.cache.invalidateAll();
        // A seeded game stays on a failed refresh, unless the game no longer exists.
        if (!this.game() || gone) {
          this.game.set(null);
          this.loadError.set(true);
        }
      },
    });
    this.loadRuns();
  }

  private loadRuns(): void {
    const id = this.gameId();
    this.experienceService.findAllByGame(id).subscribe({
      next: (runs) => {
        if (id === this.gameId()) {
          this.experiences.set(runs);
        }
      },
      error: () => {
        if (id === this.gameId()) {
          this.experiences.set([]);
        }
      },
    });
  }

  private loadOnlinePlaytime(game: Game): void {
    // The prefetched answer serves the first call for that game only; later calls (after an edit) refetch.
    const prefetch = this.onlinePrefetch?.id === game.id ? this.onlinePrefetch.playtime$ : null;
    this.onlinePrefetch = null;
    // Online hours only exist for ONLINE/HYBRID games; a SINGLEPLAYER game never has them.
    // Also drop hours loaded earlier, e.g. when an edit turns the game into SINGLEPLAYER.
    this.onlinePlaytime.set(null);
    this.onlinePlatforms.set([]);
    this.onlinePlatformsTouched.set(false);
    this.onlineFlags.set(onlineFlagsOf(null));
    this.onlineLoadState.set('loading');
    if (game.category === 'SINGLEPLAYER') {
      return;
    }
    this.onlinePlaytimeForm.reset({ totalHours: '0', generalRating: '' });
    // Catalog for the online platform picker (cached after the first load).
    this.platformService.load().subscribe({ error: () => {} });
    const id = game.id;
    (prefetch ?? this.onlinePlaytimeService.findByGame(id)).subscribe({
      next: (playtime) => {
        if (id !== this.gameId()) return;
        const lang = this.lang();
        this.onlinePlaytime.set(playtime);
        this.onlinePlatforms.set(playtime.platforms ?? []);
        this.onlineFlags.set(onlineFlagsOf(playtime));
        this.onlineLoadState.set('loaded');
        this.onlinePlaytimeForm.setValue({
          totalHours: formatHoursInput(playtime.totalHours, lang),
          generalRating: scaledRatingDraft(playtime.generalRating, this.preferences.ratingScale(), lang),
        });
      },
      error: (error: unknown) => {
        // 404: no online hours recorded for this game yet. Anything else: saving could overwrite
        // a record we failed to read, so the card is disabled.
        if (id === this.gameId()) this.onlineLoadState.set(onlinePlaytimeErrorState(error));
      },
    });
  }

  /** Sibling games come from the user's game list (the saga endpoints only return names). */
  private loadSaga(game: Game): void {
    if (game.sagaId === null) {
      return;
    }
    const id = game.id;
    this.gameService.findAll().subscribe({
      next: (games) => {
        if (id === this.gameId() && this.game()?.sagaId === game.sagaId) {
          this.sagaGames.set(games.filter((g) => g.sagaId === game.sagaId).sort(byRelease));
        }
      },
      error: () => {},
    });
  }

  /** The typed online rating on the stored 0–10 scale; empty (or invalid, blocked earlier) is null. */
  private storedOnlineRating(text: string): number | null {
    const value = parseDecimal(text);
    return value === null || Number.isNaN(value) ? null : fromRatingScale(value, this.preferences.ratingScale());
  }

  private lang(): string {
    return this.translate.currentLang() === 'en' ? 'en' : 'es';
  }

  protected runMeta(run: Experience): string {
    const locale = this.translate.currentLang() === 'en' ? 'en-US' : 'es-ES';
    return [
      platformDisplayName(run.platformName, this.translate),
      formatRunPeriod(run.startDate, run.endDate, locale) ?? (run.year ? String(run.year) : null),
      run.replay ? (this.translate.instant('run.replay') as string) : null,
    ]
      .filter((part) => !!part)
      .join(' · ');
  }

  protected releaseDate(game: Game): string {
    return formatDayMonthYear(game.releaseDate);
  }

  protected newRun(): void {
    if (!this.canAddRun()) {
      return;
    }
    this.runFormLauncher.openNewRun(this.gameId());
  }

  /** Picks a catalog platform from the online card's select, then resets the select to its prompt. */
  protected addOnlinePlatform(select: HTMLSelectElement): void {
    const id = Number(select.value);
    select.value = '';
    const catalog = this.platformService.platforms() ?? [];
    const platform = catalog.find((p) => p.id === id);
    if (!platform || this.onlinePlatforms().some((p) => p.id === id)) {
      return;
    }
    this.changeOnlinePlatforms(
      orderPlatformRefsLike(
        [...this.onlinePlatforms(), { id: platform.id, name: platform.name, color: platform.color }],
        catalog,
      ),
    );
  }

  protected removeOnlinePlatform(id: number): void {
    this.changeOnlinePlatforms(this.onlinePlatforms().filter((p) => p.id !== id));
  }

  /**
   * With a stored record the change is saved right away (reverted if that fails); without one the
   * platforms stay pending and are sent with the first save of the hours.
   */
  private changeOnlinePlatforms(next: PlatformRef[]): void {
    if (this.savingOnlinePlatforms() || this.onlineLoadState() === 'error') {
      return;
    }
    const previous = this.onlinePlatforms();
    this.onlinePlatforms.set(next);
    this.onlinePlatformsTouched.set(true);
    const existing = this.onlinePlaytime();
    if (!existing) {
      return;
    }
    const id = this.gameId();
    this.savingOnlinePlatforms.set(true);
    this.onlinePlaytimeService
      .upsert(
        id,
        // The stored hours and rating, not the form's possibly unsaved edits.
        buildOnlinePlaytimeRequest({
          totalHours: existing.totalHours,
          generalRating: existing.generalRating,
          existing,
          platformIds: next.map((p) => p.id),
          platformsTouched: true,
          // The switches, not the stored flags: a flag save may still be in flight.
          ...this.onlineFlags(),
        }),
      )
      .subscribe({
        next: (playtime) => {
          this.savingOnlinePlatforms.set(false);
          if (id !== this.gameId()) return;
          this.localWrites++;
          this.onlinePlaytime.set(playtime);
          this.onlinePlatforms.set(playtime.platforms ?? []);
          this.toast.success(this.translate.instant('game.online.saved'));
        },
        error: (err: unknown) => {
          this.savingOnlinePlatforms.set(false);
          if (id === this.gameId()) this.onlinePlatforms.set(previous);
          toastApiError(this.toast, this.translate, err, 'game.online.error');
        },
      });
  }

  /**
   * Flips a platinum / 100% switch of the online card. With a stored record the change is saved right
   * away, like the platforms (reverted if that fails); without one it stays pending and is sent with
   * the first save of the hours.
   */
  protected toggleOnlineFlag(flag: keyof OnlineFlags): void {
    if (this.savingOnlineFlags() || this.onlineLoadState() === 'error' || this.onlineLoadState() === 'loading') {
      return;
    }
    const previous = this.onlineFlags();
    const next: OnlineFlags = { ...previous, [flag]: !previous[flag] };
    this.onlineFlags.set(next);
    const existing = this.onlinePlaytime();
    if (!existing) {
      return;
    }
    const id = this.gameId();
    this.savingOnlineFlags.set(true);
    this.onlinePlaytimeService
      .upsert(
        id,
        // The stored hours and rating, not the form's possibly unsaved edits; the picked platforms,
        // which a record saves right away (one of those saves may still be in flight).
        buildOnlinePlaytimeRequest({
          totalHours: existing.totalHours,
          generalRating: existing.generalRating,
          existing,
          platformIds: this.onlinePlatforms().map((p) => p.id),
          platformsTouched: false,
          ...next,
        }),
      )
      .subscribe({
        next: (playtime) => {
          this.savingOnlineFlags.set(false);
          if (id !== this.gameId()) return;
          this.onOnlineFlagsSaved(playtime, onlineFlagsOf(existing));
          this.onlinePlaytime.set(playtime);
          this.toast.success(this.translate.instant('game.online.saved'));
        },
        error: (err: unknown) => {
          this.savingOnlineFlags.set(false);
          if (id === this.gameId()) this.onlineFlags.set(previous);
          toastApiError(this.toast, this.translate, err, 'game.online.error');
        },
      });
  }

  /**
   * After an online save: syncs the switches, celebrates a newly reached flag and refreshes the game's
   * hasPlatinum / hasFullCompletion (they also come from the runs), which would otherwise keep the
   * tiles lit after a flag is cleared.
   */
  private onOnlineFlagsSaved(playtime: OnlinePlaytime, previous: OnlineFlags): void {
    this.localWrites++;
    const saved = onlineFlagsOf(playtime);
    this.onlineFlags.set(saved);
    if (shouldCelebrateOnline(saved, previous, this.demo.isDemo())) {
      burstConfetti();
    }
    const runs = this.runs();
    this.game.update(
      (game) =>
        game && {
          ...game,
          hasPlatinum: saved.platinum || runs.some((r) => r.platinum),
          hasFullCompletion: saved.fullCompletion || runs.some((r) => r.fullCompletion),
        },
    );
  }

  protected onGameSaved(game: Game): void {
    this.localWrites++;
    const sagaChanged = game.sagaId !== this.game()?.sagaId;
    this.game.set(game);
    this.editing.set(false);
    if (sagaChanged) {
      this.sagaGames.set([]);
      this.loadSaga(game);
    } else {
      this.sagaGames.update((list) => list.map((g) => (g.id === game.id ? game : g)).sort(byRelease));
    }
    this.loadOnlinePlaytime(game);
  }

  protected onGameDeleted(): void {
    this.editing.set(false);
    this.router.navigate(['/games']);
  }

  protected submitOnlinePlaytime(): void {
    if (this.onlinePlaytimeForm.invalid || this.savingOnline() || this.onlineLoadState() === 'error') {
      this.onlinePlaytimeForm.markAllAsTouched();
      return;
    }
    const raw = this.onlinePlaytimeForm.getRawValue();
    const id = this.gameId();
    // Pending switches (no record yet) are saved here: the stored flags are the baseline.
    const previousFlags = onlineFlagsOf(this.onlinePlaytime());
    this.savingOnline.set(true);
    this.onlinePlaytimeService
      .upsert(
        id,
        buildOnlinePlaytimeRequest({
          totalHours: parseDecimal(raw.totalHours) ?? 0,
          generalRating: this.storedOnlineRating(raw.generalRating),
          existing: this.onlinePlaytime(),
          platformIds: this.onlinePlatforms().map((p) => p.id),
          platformsTouched: this.onlinePlatformsTouched(),
          ...this.onlineFlags(),
        }),
      )
      .subscribe({
        next: (playtime) => {
          this.savingOnline.set(false);
          if (id !== this.gameId()) return;
          this.onOnlineFlagsSaved(playtime, previousFlags);
          this.onlinePlaytime.set(playtime);
          this.onlinePlatforms.set(playtime.platforms ?? []);
          this.onlineLoadState.set('loaded');
          this.toast.success(this.translate.instant('game.online.saved'));
        },
        error: (err: unknown) => {
          this.savingOnline.set(false);
          toastApiError(this.toast, this.translate, err, 'game.online.error');
        },
      });
  }
}
