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
import { StatsBar, StatsBarList } from './stats-bar-list';
import { statsFormat } from './stats-format';
import { StatsLoadError } from './stats-load-error';
import { StatsPageHeader } from './stats-page-header';
import { StatsScope } from './stats-scope';
import { statsSection } from './stats-section';
import { MIN_ABANDONMENT_SAMPLE, abandonmentRanking, shares } from './stats.logic';

/**
 * Habits section (`/stats/habits?year=`): completion counts, days to finish (median, extremes,
 * buckets), abandonment rate per genre (genres with tiny samples hidden) and run length vs rating.
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
  private readonly stats = inject(StatsService);
  private readonly format = statsFormat();
  protected readonly section = statsSection((year) => this.stats.getCompletion(year));
  protected readonly state = this.section.state;

  protected readonly roundDays = (days: number | null | undefined): number => Math.round(days ?? 0);

  protected readonly dayRows = computed<StatsBar[]>(() => {
    const buckets = this.state().data?.timeToFinish.buckets ?? [];
    const ratios = shares(buckets.map((b) => b.count));
    return buckets.map((b, i) => ({
      key: b.label,
      label: this.format.text('stats.habits.daysRange', { label: b.label }),
      share: ratios[i],
      figure: this.format.plural('stats.runs', b.count),
    }));
  });

  protected readonly abandonment = computed(() => abandonmentRanking(this.state().data?.abandonmentByGenre ?? []));

  protected readonly abandonmentRows = computed<StatsBar[]>(() => {
    const percent = new Intl.NumberFormat(this.format.locale(), { style: 'percent', maximumFractionDigits: 0 });
    return this.abandonment().shown.map((g) => ({
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
    return (this.state().data?.hoursBuckets ?? []).map((b) => ({
      key: b.label,
      label: f.text('stats.habits.hoursRange', { label: b.label }),
      share: (b.averageRating ?? 0) / 10,
      figure: b.averageRating !== null ? f.rating(b.averageRating) : f.text('stats.habits.noRating'),
      figureClass: b.averageRating !== null ? ratingTone(b.averageRating) : 'text-faint',
      sub: f.text('stats.habits.hoursRow', {
        runs: f.plural('stats.runs', b.runCount),
        rated: f.plural('stats.studios.rated', b.ratedCount),
      }),
    }));
  });
}
