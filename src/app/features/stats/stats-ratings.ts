import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { StatsService } from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { formatGenreName } from '../../shared/pipes/genre-name.pipe';
import { RatingPipe } from '../../shared/pipes/rating.pipe';
import { RatingTonePipe } from '../../shared/pipes/rating-tone.pipe';
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
import { MIN_GENRE_RATINGS, platformColor, ratingSpread, ratingTemperament, shares, splitBySample } from './stats.logic';

/** Bars kept visible (a sliver) when their bucket is not empty. */
const MIN_BAR_PERCENT = 3;

/**
 * Ratings section (`/stats/ratings?year=`): mean / median / spread with a plain-language read,
 * the 0.5-wide histogram (plain divs) and the average per genre and per platform.
 */
@Component({
  selector: 'app-stats-ratings',
  imports: [
    Navbar,
    LucideDynamicIcon,
    TranslatePipe,
    TranslatePluralPipe,
    RatingPipe,
    RatingTonePipe,
    SectionHeader,
    Skeleton,
    StatCard,
    StatsBarList,
    StatsLoadError,
    StatsPageHeader,
    StatsScope,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stats-ratings.html',
})
export class StatsRatings {
  protected readonly icons = ICONS;
  protected readonly minGenreRatings = MIN_GENRE_RATINGS;
  private readonly stats = inject(StatsService);
  private readonly format = statsFormat();
  protected readonly section = statsSection((year) => this.stats.getRatings(year));
  protected readonly state = this.section.state;

  protected readonly temperament = computed(() => ratingTemperament(this.state().data?.mean));
  protected readonly spread = computed(() => ratingSpread(this.state().data?.standardDeviation));

  protected readonly histogram = computed(() => {
    const buckets = this.state().data?.histogram ?? [];
    const ratios = shares(buckets.map((b) => b.count));
    const f = this.format;
    return buckets.map((b, i) => ({
      key: b.from,
      height: b.count > 0 ? Math.max(MIN_BAR_PERCENT, ratios[i] * 100) : 0,
      title: f.text('stats.ratings.histogramBar', { from: f.point(b.from), to: f.point(b.to), count: b.count }),
    }));
  });
  /** Axis ends and middle on the user's scale. */
  protected readonly axis = computed(() => [0, 5, 10].map((point) => this.format.point(point)));

  protected readonly genres = computed(() => {
    const byGenre = [...(this.state().data?.byGenre ?? [])].sort((a, b) => b.averageRating - a.averageRating);
    return splitBySample(byGenre, (g) => g.ratedCount, MIN_GENRE_RATINGS);
  });

  protected readonly genreRows = computed<StatsBar[]>(() =>
    this.genres().shown.map((g) => ({
      key: g.genreId,
      label: formatGenreName(g.genreName),
      share: g.averageRating / 10,
      figure: this.format.rating(g.averageRating),
      figureClass: ratingTone(g.averageRating),
      sub: this.format.plural('stats.ratings.count', g.ratedCount),
    })),
  );

  protected readonly platformRows = computed<StatsBar[]>(() =>
    [...(this.state().data?.byPlatform ?? [])]
      .sort((a, b) => b.averageRating - a.averageRating)
      .map((p) => ({
        key: p.platformId,
        label: this.format.platform(p.name),
        share: p.averageRating / 10,
        figure: this.format.rating(p.averageRating),
        figureClass: ratingTone(p.averageRating),
        color: platformColor(p.color),
        dot: true,
        sub: this.format.plural('stats.ratings.count', p.ratedCount),
      })),
  );
}
