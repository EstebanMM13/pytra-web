import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LucideCalendar,
  LucideChevronLeft,
  LucideMinus,
  LucidePencil,
  LucidePlus,
  LucideTrash2,
} from '@lucide/angular';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Experience } from '../../../core/models/experience.model';
import { Game } from '../../../core/models/game.model';
import { ExperienceService } from '../../../core/services/experience.service';
import { GameService } from '../../../core/services/game.service';
import { RunFormLauncher } from '../../../core/services/run-form-launcher.service';
import { StatsService } from '../../../core/services/stats.service';
import { Navbar } from '../../../shared/navbar/navbar';
import { HoursPipe } from '../../../shared/pipes/hours.pipe';
import { RatingPipe } from '../../../shared/pipes/rating.pipe';
import { PlatformLabel } from '../../../shared/ui/platform-label';
import { RatingTonePipe } from '../../../shared/pipes/rating-tone.pipe';
import { ToastService } from '../../../shared/toast/toast.service';
import { SectionHeader } from '../../../shared/ui/section-header';
import { Skeleton } from '../../../shared/ui/skeleton';
import { StatCard } from '../../../shared/ui/stat-card';
import { StatusPill } from '../../../shared/ui/status-pill';
import { formatDayMonthYear, runDuration, splitLines } from '../../../shared/utils/run-dates';

/** `/stats/top-rated` caps `limit` at 50 server-side. */
const RANK_WINDOW = 50;

/**
 * Position of `rating` among the user's ratings (1 = best; ties share a position), from the
 * best-first `topRatings` window. Null when the window is full and does not reach `rating`.
 */
export function ratingRank(rating: number, topRatings: readonly number[], windowSize = RANK_WINDOW): number | null {
  const better = topRatings.filter((r) => r > rating).length;
  const complete = topRatings.length < windowSize;
  return complete || better < topRatings.length ? better + 1 : null;
}

@Component({
  selector: 'app-experience-detail',
  imports: [
    RouterLink,
    TranslatePipe,
    Navbar,
    HoursPipe,
    RatingPipe,
    RatingTonePipe,
    PlatformLabel,
    SectionHeader,
    Skeleton,
    StatCard,
    StatusPill,
    LucideChevronLeft,
    LucidePencil,
    LucideTrash2,
    LucidePlus,
    LucideMinus,
    LucideCalendar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './experience-detail.html',
})
export class ExperienceDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly experienceService = inject(ExperienceService);
  private readonly gameService = inject(GameService);
  private readonly statsService = inject(StatsService);
  private readonly runFormLauncher = inject(RunFormLauncher);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly gameId = signal(0);
  private readonly experienceId = signal(0);

  readonly experience = signal<Experience | null>(null);
  readonly game = signal<Game | null>(null);
  readonly loadError = signal(false);
  readonly deleting = signal(false);
  /** Best ratings first, as returned by `/stats/top-rated`; `null` until loaded or on failure. */
  private readonly topRatings = signal<number[] | null>(null);

  protected readonly pros = computed(() => splitLines(this.experience()?.pros));
  protected readonly cons = computed(() => splitLines(this.experience()?.cons));

  protected readonly rank = computed(() => {
    const rating = this.experience()?.rating;
    const top = this.topRatings();
    return rating === null || rating === undefined || top === null ? null : ratingRank(rating, top);
  });

  protected readonly duration = computed(() => {
    const e = this.experience();
    return e ? runDuration(e.startDate, e.endDate) : null;
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.load(Number(params.get('gameId')), Number(params.get('id')));
    });

    this.statsService.getTopRated(RANK_WINDOW).subscribe({
      next: (top) => this.topRatings.set(top.map((t) => t.rating)),
      error: () => {},
    });

    this.runFormLauncher.saved$.pipe(takeUntilDestroyed()).subscribe(({ experience }) => {
      if (experience.id === this.experienceId()) {
        this.experience.set(experience);
        // The rating may have changed: refresh the ranking window.
        this.statsService.getTopRated(RANK_WINDOW).subscribe({
          next: (top) => this.topRatings.set(top.map((t) => t.rating)),
          error: () => this.topRatings.set(null),
        });
      }
    });
  }

  private load(gameId: number, experienceId: number): void {
    this.gameId.set(gameId);
    this.experienceId.set(experienceId);
    this.experience.set(null);
    this.loadError.set(false);

    // Ignore late answers for a run/game the user already navigated away from.
    this.experienceService.findById(experienceId).subscribe({
      next: (experience) => {
        if (experienceId === this.experienceId()) this.experience.set(experience);
      },
      error: () => {
        if (experienceId === this.experienceId()) this.loadError.set(true);
      },
    });
    if (this.game()?.id !== gameId) {
      this.game.set(null);
      this.gameService.findById(gameId).subscribe({
        next: (game) => {
          if (gameId === this.gameId()) this.game.set(game);
        },
        error: () => {},
      });
    }
  }

  protected date(value: string | null): string {
    return formatDayMonthYear(value);
  }

  protected durationLabel(short: boolean): string {
    const d = this.duration();
    if (!d) {
      return '—';
    }
    if (short) {
      return this.translate.instant(d.unit === 'months' ? 'run.monthsShort' : 'run.daysShort', { count: d.count });
    }
    if (d.count === 1) {
      return this.translate.instant(d.unit === 'months' ? 'run.oneMonth' : 'run.oneDay');
    }
    return this.translate.instant(d.unit === 'months' ? 'run.months' : 'run.days', { count: d.count });
  }

  protected edit(): void {
    const experience = this.experience();
    if (experience) {
      this.runFormLauncher.openEditRun(experience);
    }
  }

  protected remove(): void {
    const experience = this.experience();
    if (!experience || this.deleting() || !confirm(this.translate.instant('run.deleteConfirm'))) {
      return;
    }
    this.deleting.set(true);
    this.experienceService.delete(experience.id).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('run.deleted'));
        this.router.navigate(['/games', this.gameId()]);
      },
      error: () => {
        this.deleting.set(false);
        this.toast.error(this.translate.instant('run.deleteError'));
      },
    });
  }
}
