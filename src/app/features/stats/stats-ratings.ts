import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
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
import { STATS_LIST_PREVIEW, StatsBar, StatsBarList } from './stats-bar-list';
import { statsFormat } from './stats-format';
import { StatsHero } from './stats-hero';
import { StatsLoadError } from './stats-load-error';
import { StatsPageHeader } from './stats-page-header';
import { statsPlatformColors } from './stats-platform-colors';
import { StatsScope } from './stats-scope';
import { statsSection } from './stats-section';
import {
  GAMES_LINK,
  MIN_GENRE_RATINGS,
  RatingSpread,
  RatingTemperament,
  columnHeights,
  gamesLinkParams,
  histogramColumns,
  ratingShare,
  ratingSpread,
  ratingTemperament,
  splitBySample,
} from './stats.logic';

/** Plain-language hints of the mean and spread cards (listed in full so the keys stay greppable). */
const TEMPERAMENT_KEYS: Record<RatingTemperament, string> = {
  generous: 'stats.ratings.temperament.generous',
  balanced: 'stats.ratings.temperament.balanced',
  strict: 'stats.ratings.temperament.strict',
};
const SPREAD_KEYS: Record<RatingSpread, string> = {
  tight: 'stats.ratings.spread.tight',
  moderate: 'stats.ratings.spread.moderate',
  wide: 'stats.ratings.spread.wide',
};

/**
 * Ratings section (`/stats/ratings?year=`): mean / median / spread with a plain-language read,
 * the histogram (plain divs: 0.5-wide buckets from md, whole points on phones so every column is
 * labelled) and the average per genre and per platform (rows open the library filtered by them).
 */
@Component({
  selector: 'app-stats-ratings',
  imports: [
    Navbar,
    NgTemplateOutlet,
    LucideDynamicIcon,
    TranslatePipe,
    TranslatePluralPipe,
    RatingPipe,
    RatingTonePipe,
    SectionHeader,
    Skeleton,
    StatCard,
    StatsBarList,
    StatsHero,
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
  protected readonly preview = STATS_LIST_PREVIEW;
  private readonly stats = inject(StatsService);
  private readonly format = statsFormat();
  protected readonly section = statsSection((year) => this.stats.getRatings(year));
  protected readonly state = this.section.state;
  private readonly colorOf = statsPlatformColors();

  /** Translation key of the mean's plain-language read, null without ratings. */
  protected readonly temperamentKey = computed(() => {
    const temperament = ratingTemperament(this.state().data?.mean);
    return temperament ? TEMPERAMENT_KEYS[temperament] : null;
  });
  /** Translation key of the spread's plain-language read, null without ratings. */
  protected readonly spreadKey = computed(() => {
    const spread = ratingSpread(this.state().data?.standardDeviation);
    return spread ? SPREAD_KEYS[spread] : null;
  });

  /** Phones: 11 whole-point columns; md and up: the 21 half-point buckets. Each column has its label. */
  protected readonly histograms = computed(() => {
    const buckets = this.state().data?.histogram ?? [];
    return { narrow: this.columns(histogramColumns(buckets, true)), wide: this.columns(histogramColumns(buckets, false)) };
  });

  private columns(columns: ReturnType<typeof histogramColumns>) {
    const heights = columnHeights(columns.map((c) => c.count));
    const f = this.format;
    return columns.map((c, i) => {
      const from = f.point(c.from);
      return {
        key: c.from,
        height: heights[i],
        label: from,
        title:
          c.from === c.to
            ? f.text('stats.ratings.histogramPoint', { point: from, count: c.count })
            : f.text('stats.ratings.histogramBar', { from, to: f.point(c.to), count: c.count }),
      };
    });
  }

  protected readonly genres = computed(() => {
    const byGenre = [...(this.state().data?.byGenre ?? [])].sort((a, b) => b.averageRating - a.averageRating);
    return splitBySample(byGenre, (g) => g.ratedCount, MIN_GENRE_RATINGS);
  });

  protected readonly genreRows = computed<StatsBar[]>(() => {
    const year = this.state().year;
    return this.genres().shown.map((g) => ({
      key: g.genreId,
      label: formatGenreName(g.genreName),
      share: ratingShare(g.averageRating),
      figure: this.format.rating(g.averageRating),
      figureClass: ratingTone(g.averageRating),
      sub: this.format.plural('stats.ratings.count', g.ratedCount),
      link: GAMES_LINK,
      queryParams: gamesLinkParams({ genre: g.genreId, year }),
    }));
  });

  protected readonly platformRows = computed<StatsBar[]>(() => {
    const colorOf = this.colorOf();
    const year = this.state().year;
    return [...(this.state().data?.byPlatform ?? [])]
      .sort((a, b) => b.averageRating - a.averageRating)
      .map((p) => ({
        key: p.platformId,
        label: this.format.platform(p.name),
        share: ratingShare(p.averageRating),
        figure: this.format.rating(p.averageRating),
        figureClass: ratingTone(p.averageRating),
        color: colorOf(p.platformId, p.color),
        dot: true,
        sub: this.format.plural('stats.ratings.count', p.ratedCount),
        link: GAMES_LINK,
        queryParams: gamesLinkParams({ platform: p.platformId, year }),
      }));
  });
}
