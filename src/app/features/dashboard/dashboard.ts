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
import { Observable, catchError, of } from 'rxjs';
import { MostPlayedGame, SagaStat, StatsSummary, TopRatedExperience, YearStat } from '../../core/models/stats.model';
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

type PlayMode = 'single' | 'online';

/** A run in progress, as shown in "Jugando ahora". */
export interface PlayingRun {
  experienceId: number;
  gameId: number;
  gameName: string;
  runLabel: string;
  platform: string;
  startDate: string | null;
  hours: number | null;
}

const RANKING_SIZE = 5;
const MAX_YEARS = 10;

/** `null` while loading; failed requests degrade to an empty list so the page still renders. */
function orEmpty<T>(source: Observable<T[]>): Observable<T[]> {
  return source.pipe(catchError(() => of([] as T[])));
}

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
  readonly byYear = signal<YearStat[] | null>(null);
  readonly bySaga = signal<SagaStat[] | null>(null);
  readonly topRated = signal<TopRatedExperience[] | null>(null);
  readonly mostPlayedSingleplayer = signal<MostPlayedGame[] | null>(null);
  readonly mostPlayedOnline = signal<MostPlayedGame[] | null>(null);
  readonly steamPendingCount = signal(0);

  /**
   * Runs with status EN_CURSO. The API has no cross-game endpoint for them yet
   * (only /games/{id}/experiences), so this stays empty and the section shows its
   * empty state. Fill it once an endpoint such as GET /experiences?status=EN_CURSO exists.
   */
  readonly playing = signal<PlayingRun[]>([]);

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
    this.statsService.getSummary().subscribe({
      next: (s) => this.summary.set(s),
      error: () => this.summaryFailed.set(true),
    });
    orEmpty(this.statsService.getByYear()).subscribe((s) => this.byYear.set(s));
    orEmpty(this.statsService.getBySaga()).subscribe((s) => this.bySaga.set(s));
    orEmpty(this.statsService.getTopRated(RANKING_SIZE)).subscribe((s) => this.topRated.set(s));
    orEmpty(this.statsService.getMostPlayedSingleplayer(RANKING_SIZE)).subscribe((s) =>
      this.mostPlayedSingleplayer.set(s),
    );
    orEmpty(this.statsService.getMostPlayedOnline(RANKING_SIZE)).subscribe((s) =>
      this.mostPlayedOnline.set(s),
    );
    // Not linked / not configured answers with an error: simply hide the notice.
    orEmpty(this.steamService.getPending()).subscribe((games) =>
      this.steamPendingCount.set(games.length),
    );
  }

  protected newRun(): void {
    this.runFormLauncher.openNewRun();
  }

  protected barWidth(hours: number): number {
    const max = this.mostPlayedMax();
    return max > 0 ? (hours / max) * 100 : 0;
  }
}
