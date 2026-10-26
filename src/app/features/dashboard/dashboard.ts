import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { ICONS } from '../../shared/ui/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, of } from 'rxjs';
import { InProgressExperience, MostPlayedGame, SagaStat, StatsSummary, TopRatedExperience, YearStat } from '../../core/models/stats.model';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';
import { StatsService } from '../../core/services/stats.service';
import { PsnService } from '../../core/services/psn.service';
import { SteamService } from '../../core/services/steam.service';
import { PENDING_BANNER_KEYS, pendingSummary } from '../games/library.logic';
import { UserService } from '../../core/services/user.service';
import { InstallPromptService } from '../../core/services/install-prompt.service';
import { Navbar } from '../../shared/navbar/navbar';
import { HoursPipe, formatHours } from '../../shared/pipes/hours.pipe';
import { RatingPipe } from '../../shared/pipes/rating.pipe';
import { ratingLocale } from '../../shared/utils/rating-format';
import { formatScaledRating } from '../../shared/utils/rating-scale';
import { PreferencesService } from '../../core/services/preferences.service';
import { RatingTonePipe } from '../../shared/pipes/rating-tone.pipe';
import { TranslatePluralPipe } from '../../shared/pipes/translate-plural.pipe';
import { translatePlural } from '../../shared/utils/plural';
import { MiniBar } from '../../shared/ui/mini-bar-chart';
import { RecentBarChart } from '../../shared/ui/recent-bar-chart';
import { GameCover } from '../../shared/ui/game-cover';
import { RunRow } from '../../shared/ui/run-row';
import { SectionHeader } from '../../shared/ui/section-header';
import { Segmented, SegmentedOption } from '../../shared/ui/segmented';
import { PytraMark } from '../../shared/ui/pytra-mark';
import { Skeleton } from '../../shared/ui/skeleton';
import { StatCard } from '../../shared/ui/stat-card';
import { formatDayMonthYear, todayIso } from '../../shared/utils/run-dates';
import { Game } from '../../core/models/game.model';
import { platformDisplayName } from '../../shared/ui/platform-label';
import { Saga } from '../../core/models/saga.model';
import { GameService } from '../../core/services/game.service';
import { SagaService } from '../../core/services/saga.service';
import { AchievementBadge } from '../../shared/achievements/achievement-badge';
import { computeAchievements, topUnlocked } from '../../shared/achievements/achievements';
import { pickTagline, STAT_LINKS, statMeters, topRatedKey, topRatedLink } from './dashboard.logic';

type PlayMode = 'single' | 'online';

const RANKING_SIZE = 5;
/** Years shown in the stat-card sparklines. */
const TREND_YEARS = 8;

/** Sections that show an inline error (with retry) when their request fails. */
type DashboardSection = 'playing' | 'summary' | 'byYear' | 'bySaga' | 'topRated' | 'mostPlayed';

@Component({
  selector: 'app-dashboard',
  imports: [
    Navbar,
    NgTemplateOutlet,
    RouterLink,
    TranslatePipe,
    TranslatePluralPipe,
    HoursPipe,
    RatingPipe,
    RatingTonePipe,
    StatCard,
    SectionHeader,
    RunRow,
    GameCover,
    Segmented,
    RecentBarChart,
    Skeleton,
    LucideDynamicIcon,
    AchievementBadge,
    PytraMark,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
})
export class Dashboard {
  protected readonly icons = ICONS;
  protected readonly topRatedLink = topRatedLink;
  protected readonly statLinks = STAT_LINKS;
  protected readonly topRatedKey = topRatedKey;
  /** Today's diary day, opened by the "What did you play today?" card. */
  protected readonly diaryToday = { date: todayIso() };

  protected readonly installPrompt = inject(InstallPromptService);
  private readonly statsService = inject(StatsService);
  private readonly steamService = inject(SteamService);
  private readonly psnService = inject(PsnService);
  private readonly translate = inject(TranslateService);
  private readonly runFormLauncher = inject(RunFormLauncher);
  private readonly gameService = inject(GameService);
  private readonly sagaService = inject(SagaService);
  protected readonly displayName = inject(UserService).displayName;
  private readonly preferences = inject(PreferencesService);

  protected readonly statIcons = {
    games: ICONS.gamepad2,
    sagas: ICONS.layers,
    runs: ICONS.play,
    single: ICONS.clock,
    online: ICONS.wifi,
    rating: ICONS.star,
    steam: ICONS.download,
    addGame: ICONS.plus,
  };

  readonly summary = signal<StatsSummary | null>(null);
  readonly summaryFailed = signal(false);
  protected readonly failedSections = signal<ReadonlySet<DashboardSection>>(new Set());
  readonly byYear = signal<YearStat[] | null>(null);
  readonly bySaga = signal<SagaStat[] | null>(null);
  readonly topRated = signal<TopRatedExperience[] | null>(null);
  readonly mostPlayedSingleplayer = signal<MostPlayedGame[] | null>(null);
  readonly mostPlayedOnline = signal<MostPlayedGame[] | null>(null);
  private readonly steamPending = signal<readonly Game[]>([]);
  private readonly psnPending = signal<readonly Game[]>([]);
  /** Steam and PSN games waiting for review, together, and the copy naming their source. */
  protected readonly pending = computed(() => pendingSummary(this.steamPending(), this.psnPending()));
  protected readonly pendingBannerKey = computed(() => PENDING_BANNER_KEYS[this.pending().source]);
  /** Library and sagas, only for achievements; `null` while loading (badges stay hidden). */
  readonly games = signal<Game[] | null>(null);
  readonly sagas = signal<Saga[] | null>(null);

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

  /** Contextual line under the greeting, rotating daily among the ones the data supports. */
  protected readonly tagline = computed(() => {
    const locale = ratingLocale(this.translate.currentLang());
    const t = pickTagline({
      playing: this.playing(),
      byYear: this.byYear(),
      summary: this.summary(),
      topRated: this.topRated(),
      today: new Date(),
    });
    const params: Record<string, string | number> = { ...t.params };
    if (typeof params['rating'] === 'number') {
      params['rating'] = formatScaledRating(params['rating'], this.preferences.ratingScale(), this.preferences.ratingPrecision(), locale);
    }
    if (typeof params['hours'] === 'number') params['hours'] = formatHours(params['hours'], locale);
    const count = typeof params['count'] === 'number' ? params['count'] : null;
    return { key: `dashboard.tagline.${t.key}`, params, count };
  });

  /** Proportion bars for the stat cards without a per-year sparkline (e.g. online hours). */
  protected readonly meters = computed(() => {
    const summary = this.summary();
    return summary ? statMeters(summary, this.games()) : null;
  });

  /** Per-year series (oldest first, last TREND_YEARS) for the stat-card sparklines. */
  protected readonly trends = computed(() => {
    const years = [...(this.byYear() ?? [])].sort((a, b) => a.year - b.year).slice(-TREND_YEARS);
    return {
      hours: years.map((y) => y.totalHours),
      runs: years.map((y) => y.experienceCount),
      rating: years.flatMap((y) => (y.averageRating == null ? [] : [y.averageRating])),
    };
  });

  /** Most impressive unlocked badges (max 4); empty until games, sagas and summary load. */
  protected readonly topBadges = computed(() => {
    const games = this.games();
    const sagas = this.sagas();
    const summary = this.summary();
    if (!games || !sagas || !summary) return [];
    return topUnlocked(computeAchievements({ games, sagas, summary, years: this.byYear() }), 4);
  });

  /** New account (no games yet): show the onboarding card instead of empty stats. */
  protected readonly isEmptyLibrary = computed(() => this.summary()?.totalGames === 0);

  /** True when the three ranking lists have different lengths (loading lists count as full). */
  protected readonly listsUneven = computed(() => {
    const lengths = [this.topRated(), this.mostPlayed(), this.topSagas()].map((l) => l?.length ?? 5);
    return lengths.some((n) => n !== lengths[0]);
  });

  /** Every year, oldest first; the chart shows the last few and the rest behind "Ver todos". */
  protected readonly yearBars = computed<MiniBar[] | null>(() => {
    const years = this.byYear();
    if (years === null) {
      return null;
    }
    const locale = ratingLocale(this.translate.currentLang());
    return [...years]
      .sort((a, b) => a.year - b.year)
      .map((y) => {
        const hours = formatHours(y.totalHours, locale);
        return {
          key: y.year,
          value: y.totalHours,
          label: `'${String(y.year).slice(-2)}`,
          fullLabel: String(y.year),
          // Whole hours keep the per-year label on one line under narrow bars.
          subLabel: `${Math.round(y.totalHours)}h`,
          title: `${y.year}: ${hours}`,
          hint: hours,
          link: `/years/${y.year}`,
        };
      });
  });

  /** Year bar drawn in gold: the current calendar year, else the most recent one charted. */
  protected readonly accentYear = computed(() => {
    const bars = this.yearBars();
    if (!bars?.length) {
      return null;
    }
    const current = new Date().getFullYear();
    return bars.some((b) => b.key === current) ? current : bars[bars.length - 1].key;
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
    // Achievements are a bonus: on failure simply hide them.
    this.gameService
      .findAll()
      .pipe(catchError(() => of(null)))
      .subscribe((games) => this.games.set(games));
    this.sagaService
      .findAll()
      .pipe(catchError(() => of(null)))
      .subscribe((sagas) => this.sagas.set(sagas));
    // Not linked / not configured answers with an error: simply hide the notice (no inline error).
    this.steamService
      .getPending()
      .pipe(catchError(() => of([])))
      .subscribe((games) => this.steamPending.set(games));
    this.psnService
      .getPending()
      .pipe(catchError(() => of([])))
      .subscribe((games) => this.psnPending.set(games));
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
    const parts = [run.runLabel, platformDisplayName(run.platformName, this.translate)];
    if (run.startDate) {
      parts.push(this.translate.instant('common.since', { date: formatDayMonthYear(run.startDate) }) as string);
    }
    return parts.join(' · ');
  }

  /** Days since the run started ("Hoy", "1 día", "N días"); null without a start date. */
  protected daysPlaying(run: InProgressExperience): string | null {
    if (!run.startDate) {
      return null;
    }
    const [y, m, d] = run.startDate.split('-').map(Number);
    const today = new Date();
    const days = Math.max(
      0,
      Math.round((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(y, m - 1, d)) / 86_400_000),
    );
    if (days === 0) {
      return this.translate.instant('dashboard.playingToday') as string;
    }
    return translatePlural(this.translate, 'dashboard.playingDays', days);
  }

  protected readonly topSagasMax = computed(() => Math.max(0, ...(this.topSagas() ?? []).map((s) => s.totalHours)));

  protected newRun(): void {
    this.runFormLauncher.openNewRun();
  }

  protected barWidth(hours: number): number {
    const max = this.mostPlayedMax();
    return max > 0 ? (hours / max) * 100 : 0;
  }

  /** Share of the top saga's hours, for the "By saga" bars. */
  protected sagaBarWidth(hours: number): number {
    const max = this.topSagasMax();
    return max > 0 ? (hours / max) * 100 : 0;
  }
}
