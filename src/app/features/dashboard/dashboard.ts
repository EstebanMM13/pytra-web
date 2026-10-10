import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  LucideArrowRight,
  LucideClock,
  LucideDownload,
  LucideGamepad2,
  LucideLayers,
  LucidePlay,
  LucideStar,
  LucideWifi,
} from '@lucide/angular';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, of } from 'rxjs';
import { InProgressExperience, MostPlayedGame, SagaStat, StatsSummary, TopRatedExperience, YearStat } from '../../core/models/stats.model';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';
import { StatsService } from '../../core/services/stats.service';
import { SteamService } from '../../core/services/steam.service';
import { UserService } from '../../core/services/user.service';
import { Navbar } from '../../shared/navbar/navbar';
import { HoursPipe } from '../../shared/pipes/hours.pipe';
import { RatingPipe } from '../../shared/pipes/rating.pipe';
import { MiniBar, MiniBarChart } from '../../shared/ui/mini-bar-chart';
import { RunRow } from '../../shared/ui/run-row';
import { SectionHeader } from '../../shared/ui/section-header';
import { Segmented, SegmentedOption } from '../../shared/ui/segmented';
import { Skeleton } from '../../shared/ui/skeleton';
import { StatCard } from '../../shared/ui/stat-card';
import { formatDayMonthYear } from '../../shared/utils/run-dates';

type PlayMode = 'single' | 'online';

const RANKING_SIZE = 5;
const MAX_YEARS = 10;

/** Sections that show an inline error (with retry) when their request fails. */
type DashboardSection = 'playing' | 'summary' | 'byYear' | 'bySaga' | 'topRated' | 'mostPlayed';

@Component({
  selector: 'app-dashboard',
  imports: [
    Navbar,
    NgTemplateOutlet,
    RouterLink,
    TranslatePipe,
    HoursPipe,
    RatingPipe,
    StatCard,
    SectionHeader,
    RunRow,
    Segmented,
    MiniBarChart,
    Skeleton,
    LucideDownload,
    LucideArrowRight,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly statsService = inject(StatsService);
  private readonly steamService = inject(SteamService);
  private readonly translate = inject(TranslateService);
  private readonly runFormLauncher = inject(RunFormLauncher);
  protected readonly displayName = inject(UserService).displayName;

  protected readonly icons = {
    games: LucideGamepad2,
    sagas: LucideLayers,
    runs: LucidePlay,
    single: LucideClock,
    online: LucideWifi,
    rating: LucideStar,
  };

  readonly summary = signal<StatsSummary | null>(null);
  readonly summaryFailed = signal(false);
  protected readonly failedSections = signal<ReadonlySet<DashboardSection>>(new Set());
  readonly byYear = signal<YearStat[] | null>(null);
  readonly bySaga = signal<SagaStat[] | null>(null);
  readonly topRated = signal<TopRatedExperience[] | null>(null);
  readonly mostPlayedSingleplayer = signal<MostPlayedGame[] | null>(null);
  readonly mostPlayedOnline = signal<MostPlayedGame[] | null>(null);
  readonly steamPendingCount = signal(0);

  /** Runs with status EN_CURSO (`/stats/in-progress`); `null` while loading. */
  readonly playing = signal<InProgressExperience[] | null>(null);

  protected readonly playMode = signal<PlayMode>('single');
  protected readonly playModeOptions: SegmentedOption<PlayMode>[] = [
    { value: 'single', label: 'dashboard.single' },
    { value: 'online', label: 'dashboard.online' },
  ];

  protected readonly today = computed(() => {
    const locale = this.translate.currentLang() === 'en' ? 'en-US' : 'es-ES';
    const text = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date());
    return text.charAt(0).toUpperCase() + text.slice(1);
  });

  protected readonly totalHours = computed(() => {
    const s = this.summary();
    return s ? s.totalSingleplayerHours + s.totalOnlineHours : 0;
  });

  protected readonly yearBars = computed<MiniBar[] | null>(() => {
    const years = this.byYear();
    if (years === null) {
      return null;
    }
    const ratingPipe = new RatingPipe();
    return [...years]
      .sort((a, b) => a.year - b.year)
      .slice(-MAX_YEARS)
      .map((y) => ({
        key: y.year,
        value: y.totalHours,
        label: `'${String(y.year).slice(-2)}`,
        topLabel: y.averageRating == null ? null : ratingPipe.transform(y.averageRating),
        title: `${y.year}: ${Math.round(y.totalHours)} h`,
      }));
  });

  protected readonly mostPlayed = computed(() =>
    this.playMode() === 'single' ? this.mostPlayedSingleplayer() : this.mostPlayedOnline(),
  );
  protected readonly mostPlayedMax = computed(() =>
    Math.max(0, ...(this.mostPlayed() ?? []).map((g) => g.totalHours)),
  );

  protected readonly topSagas = computed(() => {
    const sagas = this.bySaga();
    if (sagas === null) {
      return null;
    }
    return sagas
      .filter((s) => s.sagaId !== null)
      .sort((a, b) => b.totalHours - a.totalHours)
      .slice(0, RANKING_SIZE);
  });

  constructor() {
    this.load();
    // A run created/edited from the form changes the totals and "Jugando ahora".
    this.runFormLauncher.saved$.pipe(takeUntilDestroyed()).subscribe(() => this.load());
  }

  private load(): void {
    this.summaryFailed.set(false);
    this.failedSections.set(new Set());
    this.orEmpty('playing', this.statsService.getInProgress()).subscribe((runs) => this.playing.set(runs));
    this.statsService.getSummary().subscribe({
      next: (s) => this.summary.set(s),
      error: () => {
        this.summaryFailed.set(true);
        this.markFailed('summary');
      },
    });
    this.orEmpty('byYear', this.statsService.getByYear()).subscribe((s) => this.byYear.set(s));
    this.orEmpty('bySaga', this.statsService.getBySaga()).subscribe((s) => this.bySaga.set(s));
    this.orEmpty('topRated', this.statsService.getTopRated(RANKING_SIZE)).subscribe((s) => this.topRated.set(s));
    this.orEmpty('mostPlayed', this.statsService.getMostPlayedSingleplayer(RANKING_SIZE)).subscribe((s) =>
      this.mostPlayedSingleplayer.set(s),
    );
    this.orEmpty('mostPlayed', this.statsService.getMostPlayedOnline(RANKING_SIZE)).subscribe((s) =>
      this.mostPlayedOnline.set(s),
    );
    // Not linked / not configured answers with an error: simply hide the notice (no inline error).
    this.steamService
      .getPending()
      .pipe(catchError(() => of([])))
      .subscribe((games) => this.steamPendingCount.set(games.length));
  }

  /** Retry after a failure: back to skeletons, then reload everything. */
  protected retry(): void {
    this.summary.set(null);
    this.playing.set(null);
    this.byYear.set(null);
    this.bySaga.set(null);
    this.topRated.set(null);
    this.mostPlayedSingleplayer.set(null);
    this.mostPlayedOnline.set(null);
    this.load();
  }

  protected failed(section: DashboardSection): boolean {
    return this.failedSections().has(section);
  }

  private markFailed(section: DashboardSection): void {
    this.failedSections.update((set) => new Set(set).add(section));
  }

  /** A failed list degrades to empty (the page still renders) and flags its section. */
  private orEmpty<T>(section: DashboardSection, source: Observable<T[]>): Observable<T[]> {
    return source.pipe(
      catchError(() => {
        this.markFailed(section);
        return of([] as T[]);
      }),
    );
  }

  protected playingMeta(run: InProgressExperience): string {
    const parts = [run.runLabel, this.translate.instant(`platform.${run.platform}`) as string];
    if (run.startDate) {
      parts.push(this.translate.instant('common.since', { date: formatDayMonthYear(run.startDate) }) as string);
    }
    return parts.join(' · ');
  }

  protected newRun(): void {
    this.runFormLauncher.openNewRun();
  }

  protected barWidth(hours: number): number {
    const max = this.mostPlayedMax();
    return max > 0 ? (hours / max) * 100 : 0;
  }
}
