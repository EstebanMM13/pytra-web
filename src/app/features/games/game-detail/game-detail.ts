import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LucideChevronLeft,
  LucideClock,
  LucideDownload,
  LucideLayers,
  LucidePencil,
  LucidePlay,
  LucidePlus,
  LucideStar,
  LucideTrophy,
} from '@lucide/angular';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Experience } from '../../../core/models/experience.model';
import { Game } from '../../../core/models/game.model';
import { OnlinePlaytime } from '../../../core/models/online-playtime.model';
import { ExperienceService } from '../../../core/services/experience.service';
import { GameService } from '../../../core/services/game.service';
import { OnlinePlaytimeService } from '../../../core/services/online-playtime.service';
import { RunFormLauncher } from '../../../core/services/run-form-launcher.service';
import { Navbar } from '../../../shared/navbar/navbar';
import { HoursPipe } from '../../../shared/pipes/hours.pipe';
import { RatingPipe } from '../../../shared/pipes/rating.pipe';
import { PlatformLabel } from '../../../shared/ui/platform-label';
import { RatingTonePipe } from '../../../shared/pipes/rating-tone.pipe';
import { ToastService } from '../../../shared/toast/toast.service';
import { RunRow } from '../../../shared/ui/run-row';
import { GameCover } from '../../../shared/ui/game-cover';
import { SectionHeader } from '../../../shared/ui/section-header';
import { Skeleton } from '../../../shared/ui/skeleton';
import { decimalValidator, formatDecimalInput, parseDecimal } from '../../../shared/utils/decimal-input';
import { StatCard } from '../../../shared/ui/stat-card';
import { StatusPill } from '../../../shared/ui/status-pill';
import { formatDayMonthYear, formatRunPeriod } from '../../../shared/utils/run-dates';
import { GameEditDialog } from '../game-edit-dialog/game-edit-dialog';

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

@Component({
  selector: 'app-game-detail',
  imports: [
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
    LucideChevronLeft,
    LucideLayers,
    LucidePencil,
    LucidePlus,
    LucideDownload,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-detail.html',
})
export class GameDetail {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly gameService = inject(GameService);
  private readonly experienceService = inject(ExperienceService);
  private readonly onlinePlaytimeService = inject(OnlinePlaytimeService);
  private readonly runFormLauncher = inject(RunFormLauncher);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  protected readonly icons = { runs: LucidePlay, hours: LucideClock, rating: LucideStar, platinum: LucideTrophy };

  readonly gameId = signal(0);
  readonly game = signal<Game | null>(null);
  /** `null` while loading. */
  readonly experiences = signal<Experience[] | null>(null);
  readonly onlinePlaytime = signal<OnlinePlaytime | null>(null);
  readonly sagaGames = signal<Game[]>([]);
  readonly loadError = signal(false);
  readonly editing = signal(false);
  readonly savingOnline = signal(false);

  // Text inputs so "12,5" works on every keyboard/locale (number inputs drop it as empty).
  readonly onlinePlaytimeForm = this.fb.group({
    totalHours: this.fb.control('0', [Validators.required, decimalValidator('hours', (h) => h >= 0)]),
    // The API stores the online rating as an integer 0–10.
    generalRating: this.fb.control('', decimalValidator('rating', (r) => Number.isInteger(r) && r >= 0 && r <= 10)),
  });

  protected readonly runs = computed(() => [...(this.experiences() ?? [])].sort(byRecencyDesc));

  protected readonly ratings = computed(() =>
    this.runs()
      .map((r) => r.rating)
      .filter((r): r is number => r !== null),
  );

  protected readonly stats = computed(() => {
    const runs = this.runs();
    const ratings = this.ratings();
    const runHours = runs.reduce((sum, r) => sum + (r.hours ?? 0), 0);
    return {
      runs: runs.length,
      runHours,
      onlineHours: this.onlinePlaytime()?.totalHours ?? 0,
      totalHours: runHours + (this.onlinePlaytime()?.totalHours ?? 0),
      avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
      bestRating: ratings.length ? Math.max(...ratings) : null,
      platinum: runs.some((r) => r.platinum),
    };
  });

  /** Highlighted only when there is something to compare against. */
  protected readonly bestRunId = computed(() => {
    const runs = this.runs();
    const best = this.stats().bestRating;
    if (runs.length < 2 || best === null) {
      return null;
    }
    return runs.find((r) => r.rating === best)?.id ?? null;
  });

  /** API aggregate (enum order) when present; otherwise derived from the loaded runs. */
  protected readonly platforms = computed(() => {
    const fromApi = this.game()?.platforms;
    return fromApi?.length ? fromApi : [...new Set(this.runs().map((r) => r.platform))];
  });

  protected readonly platformNames = computed(() =>
    this.platforms()
      .map((p) => this.translate.instant(`platform.${p}`) as string)
      .join(', '),
  );

  protected readonly metaLine = computed(() => {
    const g = this.game();
    if (!g) {
      return '';
    }
    return [
      g.developer,
      g.releaseDate?.slice(0, 4),
      g.genres.map((genre) => genre.name).join(', '),
      this.platformNames(),
    ]
      .filter((part) => !!part)
      .join(' · ');
  });

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

    // Every handler checks the id: a late answer for the previous game must not overwrite this one.
    this.gameService.findById(id).subscribe({
      next: (game) => {
        if (id !== this.gameId()) return;
        this.game.set(game);
        this.loadOnlinePlaytime(game);
        this.loadSaga(game);
      },
      error: () => {
        if (id === this.gameId()) this.loadError.set(true);
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
    // Online hours only exist for ONLINE/HYBRID games; a SINGLEPLAYER game never has them.
    // Also drop hours loaded earlier, e.g. when an edit turns the game into SINGLEPLAYER.
    this.onlinePlaytime.set(null);
    if (game.category === 'SINGLEPLAYER') {
      return;
    }
    this.onlinePlaytimeForm.reset({ totalHours: '0', generalRating: '' });
    const id = game.id;
    this.onlinePlaytimeService.findByGame(id).subscribe({
      next: (playtime) => {
        if (id !== this.gameId()) return;
        const lang = this.lang();
        this.onlinePlaytime.set(playtime);
        this.onlinePlaytimeForm.setValue({
          totalHours: formatDecimalInput(playtime.totalHours, lang),
          generalRating: formatDecimalInput(playtime.generalRating, lang),
        });
      },
      error: () => {
        // 404: no online hours recorded for this game yet.
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

  private lang(): string {
    return this.translate.currentLang() === 'en' ? 'en' : 'es';
  }

  protected runMeta(run: Experience): string {
    const locale = this.translate.currentLang() === 'en' ? 'en-US' : 'es-ES';
    return [
      this.translate.instant(`platform.${run.platform}`) as string,
      formatRunPeriod(run.startDate, run.endDate, locale) ?? (run.year ? String(run.year) : null),
      run.platinum ? '🏆' : null,
      run.replay ? (this.translate.instant('run.replay') as string) : null,
    ]
      .filter((part) => !!part)
      .join(' · ');
  }

  protected releaseDate(game: Game): string {
    return formatDayMonthYear(game.releaseDate);
  }

  protected genreNames(game: Game): string {
    // Sorted so the order is stable everywhere (the API returns genres as an unordered set).
    return game.genres.map((g) => g.name).sort((a, b) => a.localeCompare(b, 'es')).join(', ');
  }

  protected newRun(): void {
    this.runFormLauncher.openNewRun(this.gameId());
  }

  protected onGameSaved(game: Game): void {
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
    if (this.onlinePlaytimeForm.invalid || this.savingOnline()) {
      this.onlinePlaytimeForm.markAllAsTouched();
      return;
    }
    const raw = this.onlinePlaytimeForm.getRawValue();
    const id = this.gameId();
    this.savingOnline.set(true);
    this.onlinePlaytimeService
      .upsert(id, {
        totalHours: parseDecimal(raw.totalHours) ?? 0,
        generalRating: parseDecimal(raw.generalRating),
        // Keep fields this card does not edit.
        lastSessionAt: this.onlinePlaytime()?.lastSessionAt ?? null,
        notes: this.onlinePlaytime()?.notes ?? null,
      })
      .subscribe({
        next: (playtime) => {
          this.savingOnline.set(false);
          if (id !== this.gameId()) return;
          this.onlinePlaytime.set(playtime);
          this.toast.success(this.translate.instant('game.online.saved'));
        },
        error: () => {
          this.savingOnline.set(false);
          this.toast.error(this.translate.instant('game.online.error'));
        },
      });
  }
}
