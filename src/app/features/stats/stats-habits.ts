import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { StatsService } from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { formatGenreName } from '../../shared/pipes/genre-name.pipe';
import { TranslatePluralPipe } from '../../shared/pipes/translate-plural.pipe';
import { GameCover, sizedCoverUrl } from '../../shared/ui/game-cover';
import { ICONS } from '../../shared/ui/icons';
import { SectionHeader } from '../../shared/ui/section-header';
import { Skeleton } from '../../shared/ui/skeleton';
import { ratingTone } from '../../shared/utils/rating-tone';
import { STATS_LIST_PREVIEW, StatsBar, StatsBarList } from './stats-bar-list';
import { StatsColumn, StatsColumnChart } from './stats-column-chart';
import { StatsDonut } from './stats-donut';
import { statsFormat } from './stats-format';
import { StatsHero } from './stats-hero';
import { statsLibrary } from './stats-library';
import { STATS_BRAND, STATS_BRAND_MUTED } from './stats-palette';
import { StatsPill } from './stats-pill';
import { StatsLoadError } from './stats-load-error';
import { StatsPageHeader } from './stats-page-header';
import { StatsScope } from './stats-scope';
import { statsSection } from './stats-section';
import { bucketRange } from '../games/play-filters.logic';
import {
  GAMES_LINK,
  MIN_ABANDONMENT_SAMPLE,
  abandonmentRanking,
  coverMap,
  finishRate,
  gamesLinkParams,
  joinParts,
  percentFormat,
  ratingShare,
} from './stats.logic';

/**
 * Habits section (`/stats/habits?year=`): a ring of the finish rate (completed vs abandoned) with
 * the counts, days to finish (median, extremes, a histogram of the buckets), abandonment rate per
 * genre (genres with tiny samples hidden) and run length vs rating. Bucket columns and genre rows
 * open the library on the games behind them (in the year scope too).
 */
@Component({
  selector: 'app-stats-habits',
  imports: [
    Navbar,
    RouterLink,
    LucideDynamicIcon,
    TranslatePipe,
    TranslatePluralPipe,
    SectionHeader,
    Skeleton,
    StatsBarList,
    StatsColumnChart,
    StatsDonut,
    StatsHero,
    GameCover,
    StatsPill,
    StatsLoadError,
    StatsPageHeader,
    StatsScope,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stats-habits.html',
})
export class StatsHabits {
  protected readonly icons = ICONS;
  protected readonly minSample = MIN_ABANDONMENT_SAMPLE;
  protected readonly preview = STATS_LIST_PREVIEW;
  private readonly stats = inject(StatsService);
  private readonly format = statsFormat();
  protected readonly section = statsSection((year) => this.stats.getCompletion(year));
  protected readonly state = this.section.state;
  private readonly library = statsLibrary();
  /** Covers of the fastest / slowest runs' games, from the cached library (the API sends none). */
  private readonly covers = computed(() => coverMap(this.library() ?? []));

  protected coverOf(gameId: number): string | null {
    return this.covers().get(gameId) ?? null;
  }

  /** The small cover variant for a blurred backdrop (no detail survives the blur). */
  protected backdropOf(gameId: number): string | null {
    return sizedCoverUrl(this.coverOf(gameId), 'small');
  }

  /** A backdrop that fails to load is hidden: the card keeps its glass look. */
  protected hideBroken(event: Event): void {
    (event.target as HTMLElement).hidden = true;
  }

  protected readonly roundDays = (days: number | null | undefined): number => Math.round(days ?? 0);

  /** Completed vs abandoned runs as ring slices (an empty ring before any of either). */
  protected readonly finishSlices = computed(() => {
    const c = this.state().data;
    const rate = c ? finishRate(c.completedCount, c.abandonedCount) : null;
    if (rate === null) return [];
    return [
      { key: 'completed', color: STATS_BRAND, share: rate },
      { key: 'abandoned', color: STATS_BRAND_MUTED, share: 1 - rate },
    ];
  });

  /** The counts beside the ring: completed and abandoned with the ring's colours, replays with an icon. */
  protected readonly countRows = computed(() => {
    const c = this.state().data;
    if (!c) return [];
    return [
      { key: 'completed', label: 'stats.habits.completed', value: c.completedCount, color: STATS_BRAND },
      { key: 'abandoned', label: 'stats.habits.abandoned', value: c.abandonedCount, color: STATS_BRAND_MUTED },
      { key: 'replays', label: 'stats.habits.replays', value: c.replayCount, color: null },
    ];
  });

  /** The finish rate as a percentage, null before any completed or abandoned run. */
  protected readonly finishPercent = computed(() => {
    const c = this.state().data;
    const rate = c ? finishRate(c.completedCount, c.abandonedCount) : null;
    return rate === null ? null : percentFormat(this.format.locale())(rate);
  });

  /** Days-to-finish buckets as histogram columns; non-empty ones open the library on their runs. */
  protected readonly dayColumns = computed<StatsColumn[]>(() => {
    const buckets = this.state().data?.timeToFinish.buckets ?? [];
    const year = this.state().year;
    const f = this.format;
    return buckets.map((b) => ({
      key: b.label,
      label: b.label,
      value: b.count,
      figure: String(b.count),
      title: joinParts([
        `${f.text('stats.habits.daysRange', { label: b.label })}: ${f.plural('stats.runs', b.count)}`,
        // The library lists games: say how many when it differs from the runs.
        b.gameCount !== undefined && b.gameCount !== b.count ? f.plural('common.games', b.gameCount) : null,
      ]),
      link: b.count > 0 ? GAMES_LINK : null,
      queryParams: gamesLinkParams({ days: bucketRange(b.minDays, b.maxDays), year }),
    }));
  });

  protected readonly abandonment = computed(() => abandonmentRanking(this.state().data?.abandonmentByGenre ?? []));

  protected readonly abandonmentRows = computed<StatsBar[]>(() => {
    const percent = new Intl.NumberFormat(this.format.locale(), { style: 'percent', maximumFractionDigits: 0 });
    const year = this.state().year;
    return this.abandonment().shown.map((g) => ({
      link: GAMES_LINK,
      queryParams: gamesLinkParams({ genre: g.genreId, year }),
      key: g.genreId,
      label: formatGenreName(g.genreName),
      share: g.abandonmentRate,
      figure: percent.format(g.abandonmentRate),
      sub: this.format.text('stats.habits.abandonmentRow', {
        abandoned: g.abandonedCount,
        total: g.completedCount + g.abandonedCount,
      }),
    }));
  });

  protected readonly hoursRows = computed<StatsBar[]>(() => {
    const f = this.format;
    const year = this.state().year;
    return (this.state().data?.hoursBuckets ?? []).map((b) => ({
      key: b.label,
      label: f.text('stats.habits.hoursRange', { label: b.label }),
      share: ratingShare(b.averageRating),
      figure: b.averageRating !== null ? f.rating(b.averageRating) : f.text('stats.habits.noRating'),
      figureClass: b.averageRating !== null ? ratingTone(b.averageRating) : 'text-faint',
      sub: joinParts([
        f.text('stats.habits.hoursRow', {
          runs: f.plural('stats.runs', b.runCount),
          rated: f.plural('stats.studios.rated', b.ratedCount),
        }),
        b.gameCount !== undefined && b.gameCount !== b.runCount ? f.plural('common.games', b.gameCount) : null,
      ]),
      link: b.runCount > 0 ? GAMES_LINK : null,
      queryParams: gamesLinkParams({ hours: bucketRange(b.minHours, b.maxHours), year }),
    }));
  });
}
