import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { StatsService } from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { formatGenreName } from '../../shared/pipes/genre-name.pipe';
import { TranslatePluralPipe } from '../../shared/pipes/translate-plural.pipe';
import { ICONS } from '../../shared/ui/icons';
import { SectionHeader } from '../../shared/ui/section-header';
import { Skeleton } from '../../shared/ui/skeleton';
import { StatCard } from '../../shared/ui/stat-card';
import { ratingTone } from '../../shared/utils/rating-tone';
import { STATS_LIST_PREVIEW, StatsBar, StatsBarList } from './stats-bar-list';
import { statsFormat } from './stats-format';
import { StatsLoadError } from './stats-load-error';
import { StatsPageHeader } from './stats-page-header';
import { StatsScope } from './stats-scope';
import { statsSection } from './stats-section';
import { bucketRange } from '../games/play-filters.logic';
import {
  GAMES_LINK,
  MIN_ABANDONMENT_SAMPLE,
  abandonmentRanking,
  gamesLinkParams,
  joinParts,
  ratingShare,
  shares,
} from './stats.logic';

/**
 * Habits section (`/stats/habits?year=`): completion counts, days to finish (median, extremes,
 * buckets), abandonment rate per genre (genres with tiny samples hidden) and run length vs rating.
 * Bucket and genre rows open the library on the games behind them (in the year scope too).
 */
@Component({
  selector: 'app-stats-habits',
  imports: [
    Navbar,
    RouterLink,
    TranslatePipe,
    TranslatePluralPipe,
    SectionHeader,
    Skeleton,
    StatCard,
    StatsBarList,
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

  protected readonly roundDays = (days: number | null | undefined): number => Math.round(days ?? 0);

  protected readonly dayRows = computed<StatsBar[]>(() => {
    const buckets = this.state().data?.timeToFinish.buckets ?? [];
    const ratios = shares(buckets.map((b) => b.count));
    const year = this.state().year;
    return buckets.map((b, i) => ({
      key: b.label,
      label: this.format.text('stats.habits.daysRange', { label: b.label }),
      share: ratios[i],
      figure: this.format.plural('stats.runs', b.count),
      // The library lists games: say how many when it differs from the runs.
      sub: b.gameCount !== undefined && b.gameCount !== b.count ? this.format.plural('common.games', b.gameCount) : null,
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
