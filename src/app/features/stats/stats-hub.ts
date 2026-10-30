import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, catchError, of, startWith, switchMap } from 'rxjs';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';
import {
  DEVELOPER_MIN_RATED_GAMES,
  DEVELOPER_RANKING_LIMIT,
  StatsService,
} from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { HoursPipe } from '../../shared/pipes/hours.pipe';
import { RatingPipe } from '../../shared/pipes/rating.pipe';
import { RatingTonePipe } from '../../shared/pipes/rating-tone.pipe';
import { TranslatePluralPipe } from '../../shared/pipes/translate-plural.pipe';
import { ICONS } from '../../shared/ui/icons';
import { Skeleton } from '../../shared/ui/skeleton';
import { todayIso } from '../../shared/utils/run-dates';
import { DIARY_LEVEL_CLASS } from '../diary/diary.logic';
import { MAX_STACK_COVERS, StatsCoverStack } from './stats-cover-stack';
import { StatsEyebrow } from './stats-eyebrow';
import { statsFormat } from './stats-format';
import { STATS_HERO_RADIUS, StatsHero } from './stats-hero';
import { StatsHubCard } from './stats-hub-card';
import { statsLibrary } from './stats-library';
import { STATS_BRAND, STATS_BRAND_MUTED, STATS_GOLD } from './stats-palette';
import { StatsPill } from './stats-pill';
import {
  byDeveloper,
  columnHeights,
  finishRate,
  histogramColumns,
  recentDays,
  recentYearBars,
  sagaTeaser,
  shareSlices,
  shares,
  topCovers,
  totalHours,
  withArt,
} from './stats.logic';

/** Days of the activity card's strip (five weeks). */
const ACTIVITY_STRIP_DAYS = 35;
/** Years of the years card's bars. */
const YEAR_BARS = 8;
/** Shortest drawn bar (percent) of the years and ratings teasers, so a small count still shows. */
const YEAR_MIN_BAR_PERCENT = 8;
const RATING_MIN_BAR_PERCENT = 6;
/** Slices of the share bars before the rest is grouped. */
const SHARE_SLICES = 4;
/** Studios of the studios card's fallback bars. */
const TOP_STUDIOS = 3;

/** Strength (percent of the card accent) of each ranked slice, the first the strongest. */
const RANK_ACCENT_PERCENT = [100, 70, 48, 30, 18];

/** The card accent (`--hub-accent`, set by the card) at the strength of the `rank`-th slice. */
function accentShade(rank: number): string {
  const percent = RANK_ACCENT_PERCENT[Math.min(rank, RANK_ACCENT_PERCENT.length - 1)];
  return `color-mix(in srgb, var(--hub-accent) ${percent}%, transparent)`;
}

/** Share slices of the biggest items, shaded from the card accent down (one colour reads best). */
function accentSlices(items: readonly { key: string | number; value: number }[]) {
  return shareSlices(
    items.map((item) => ({ ...item, name: '', color: '' })),
    SHARE_SLICES,
    { name: '', color: '' },
  ).map((slice, i) => ({ ...slice, color: accentShade(i) }));
}

/**
 * A teaser's data: `undefined` while loading, null when the request failed. Reloaded when a run is
 * saved elsewhere (the "+" menu), like the sections; the cache serves the previous value meanwhile.
 * Created in an injection context.
 */
function teaser<T>(request: () => Observable<T>) {
  const saved$ = inject(RunFormLauncher).saved$;
  return toSignal<T | null | undefined>(
    saved$.pipe(
      startWith(null),
      switchMap(() => request().pipe(catchError(() => of(null)))),
    ),
    { initialValue: undefined },
  );
}

/**
 * Stats hub (`/stats`): one card per section, each in its accent colour, with a teaser figure and
 * a small visual of the same data (recent days, hours per year, share bars, a rating histogram).
 * Years and Sagas keep their own pages (`/years`, `/sagas`); the other sections live under
 * `/stats/*`. The teasers come from small cached endpoints fetched in parallel, the same calls
 * (and cache entries) the sections use.
 */
@Component({
  selector: 'app-stats-hub',
  imports: [
    Navbar,
    NgTemplateOutlet,
    Skeleton,
    StatsCoverStack,
    StatsEyebrow,
    StatsHero,
    StatsHubCard,
    StatsPill,
    TranslatePipe,
    TranslatePluralPipe,
    HoursPipe,
    RatingPipe,
    RatingTonePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stats-hub.html',
})
export class StatsHub {
  protected readonly icons = ICONS;
  protected readonly gold = STATS_GOLD;
  protected readonly heroRadius = STATS_HERO_RADIUS;
  protected readonly levelClass = DIARY_LEVEL_CLASS;
  private readonly stats = inject(StatsService);
  private readonly format = statsFormat();

  protected readonly activity = teaser(() => this.stats.getActivity());
  protected readonly byYear = teaser(() => this.stats.getByYear());
  protected readonly bySaga = teaser(() => this.stats.getBySaga());
  protected readonly platforms = teaser(() => this.stats.getByPlatform());
  // Same parameters as the studios section: one shared cache entry.
  protected readonly developers = teaser(() =>
    this.stats.getByDeveloper(DEVELOPER_RANKING_LIMIT, DEVELOPER_MIN_RATED_GAMES),
  );
  protected readonly completion = teaser(() => this.stats.getCompletion());
  private readonly ratings = teaser(() => this.stats.getRatings());
  private readonly today = todayIso();
  private readonly library = statsLibrary();

  /** The library is still loading: the covers keep their room. */
  protected readonly coversPending = computed(() => this.library() === null);

  /**
   * The hero's all-time summary: hours of every year (null when they failed to load: the figure
   * shows a dash, like the cards), the first year played, a few counts as pills and the most
   * played games' covers. `undefined` while the years load.
   */
  protected readonly hero = computed(() => {
    const years = this.byYear();
    if (years === undefined) return undefined;
    const played = (years ?? []).filter((y) => y.totalHours > 0);
    const format = this.format;
    const games = this.library() ?? [];
    const completed = this.completion()?.completedCount ?? 0;
    const sagas = this.sagas()?.count ?? 0;
    return {
      hours: years ? totalHours(years) : null,
      since: played.length ? Math.min(...played.map((y) => y.year)) : null,
      pills: [
        games.length ? format.plural('common.games', games.length) : null,
        completed ? format.plural('stats.platforms.completed', completed) : null,
        sagas ? format.plural('stats.hub.sagasFigure', sagas) : null,
      ].filter((pill): pill is string => pill !== null),
      covers: withArt(topCovers(games, (g) => (g.totalHours ?? 0) > 0, MAX_STACK_COVERS)),
    };
  });

  /** Covers of the most played saga's games (from the cached library). */
  protected readonly sagaCovers = computed(() => {
    const top = this.sagas()?.top;
    return top ? withArt(topCovers(this.library() ?? [], (g) => g.sagaId === top.sagaId, MAX_STACK_COVERS)) : [];
  });

  /** Covers of the most played studio's games (from the cached library). */
  protected readonly studioCovers = computed(() => {
    const top = this.topDeveloper();
    return top ? withArt(topCovers(this.library() ?? [], byDeveloper(top.developer), MAX_STACK_COVERS)) : [];
  });

  /** The most recent year with any hours. */
  protected readonly latestYear = computed(() => {
    const years = this.byYear();
    if (!years) return years;
    return [...years].filter((y) => y.totalHours > 0).sort((a, b) => b.year - a.year)[0] ?? null;
  });
  protected readonly sagas = computed(() => {
    const stats = this.bySaga();
    return stats ? sagaTeaser(stats) : stats;
  });
  protected readonly topPlatform = computed(() => {
    const stats = this.platforms();
    return stats ? (stats.platforms.find((p) => p.hours > 0) ?? null) : stats;
  });
  protected readonly topDeveloper = computed(() => {
    const stats = this.developers();
    return stats ? (stats.topByHours[0] ?? null) : stats;
  });
  protected readonly medianDays = computed(() => {
    const median = this.completion()?.timeToFinish.medianDays;
    return median === null || median === undefined ? null : Math.round(median);
  });

  /** The mean rating and its sample, null when nothing is rated (or the load failed). */
  protected readonly ratingsTeaser = computed(() => {
    const stats = this.ratings();
    if (stats === undefined) return undefined;
    return stats && stats.mean !== null ? { mean: stats.mean, count: stats.ratedCount } : null;
  });

  protected platformName(name: string): string {
    return this.format.platform(name);
  }

  // Teaser visuals: empty when there is nothing to draw (the card keeps the room).

  /** Heat level of the last five weeks, oldest first. */
  protected readonly activityStrip = computed(() => recentDays(this.activity()?.days ?? [], this.today, ACTIVITY_STRIP_DAYS));

  protected readonly yearBars = computed(() => recentYearBars(this.byYear() ?? [], YEAR_BARS, YEAR_MIN_BAR_PERCENT));

  /** Hours of the biggest sagas, shaded from the accent down (when the library has no covers). */
  protected readonly sagaSlices = computed(() =>
    accentSlices(
      (this.bySaga() ?? []).filter((s) => s.sagaId !== null).map((s) => ({ key: s.sagaId!, value: s.totalHours })),
    ),
  );

  /** Hours of the most played platforms, shaded from the accent down (no legend: one colour reads best). */
  protected readonly platformSlices = computed(() =>
    accentSlices((this.platforms()?.platforms ?? []).map((p) => ({ key: p.platformId, value: p.hours }))),
  );

  /** The top studios by hours, as bars scaled to the first (when the library has no covers). */
  protected readonly studioBars = computed(() => {
    const top = (this.developers()?.topByHours ?? []).slice(0, TOP_STUDIOS);
    const ratios = shares(top.map((d) => d.hours));
    return top.map((d, i) => ({ key: i, width: ratios[i] * 100, color: accentShade(i) }));
  });

  /** Completed vs abandoned runs as share-bar slices; empty before any of either. */
  protected readonly habitSlices = computed(() => {
    const c = this.completion();
    const rate = c ? finishRate(c.completedCount ?? 0, c.abandonedCount ?? 0) : null;
    if (rate === null) return [];
    return [
      { key: 'completed', share: rate, color: STATS_BRAND },
      { key: 'abandoned', share: 1 - rate, color: STATS_BRAND_MUTED },
    ].filter((slice) => slice.share > 0);
  });

  /** Whole-point rating columns (heights 0..100). */
  protected readonly ratingBars = computed(() => {
    const histogram = this.ratings()?.histogram ?? [];
    return histogram.length ? columnHeights(histogramColumns(histogram, true).map((c) => c.count), RATING_MIN_BAR_PERCENT) : [];
  });
}
