import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { combineLatest, map } from 'rxjs';
import {
  DEVELOPER_MIN_RATED_GAMES,
  DEVELOPER_RANKING_LIMIT,
  StatsService,
} from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { TranslatePluralPipe } from '../../shared/pipes/translate-plural.pipe';
import { SectionHeader } from '../../shared/ui/section-header';
import { Segmented, SegmentedOption } from '../../shared/ui/segmented';
import { Skeleton } from '../../shared/ui/skeleton';
import { ratingTone } from '../../shared/utils/rating-tone';
import { STATS_LIST_PREVIEW, StatsBar, StatsBarList } from './stats-bar-list';
import { statsFormat } from './stats-format';
import { StatsLoadError } from './stats-load-error';
import { StatsPageHeader } from './stats-page-header';
import { statsSection } from './stats-section';
import { GAMES_LINK, decadeParams, gamesLinkParams, joinParts, ratingShare, shares } from './stats.logic';

type DeveloperRanking = 'hours' | 'rating';

const RANKING_OPTIONS: readonly SegmentedOption<DeveloperRanking>[] = [
  { value: 'hours', label: 'stats.studios.byHours' },
  { value: 'rating', label: 'stats.studios.byRating' },
];

/** Router commands of the studio detail page (the name goes in `?name=`). */
const STUDIO_LINK: readonly string[] = ['/stats/studio'];

/**
 * Studios & eras section (`/stats/studios`, all time): top developers by hours or by rating (only
 * those with enough rated games; each opens its studio page) and games per release decade (each
 * opens the library on that decade).
 */
@Component({
  selector: 'app-stats-studios',
  imports: [
    Navbar,
    TranslatePipe,
    TranslatePluralPipe,
    SectionHeader,
    Segmented,
    Skeleton,
    StatsBarList,
    StatsLoadError,
    StatsPageHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stats-studios.html',
})
export class StatsStudios {
  private readonly stats = inject(StatsService);
  private readonly format = statsFormat();
  protected readonly rankingOptions = RANKING_OPTIONS;
  protected readonly ranking = signal<DeveloperRanking>('hours');
  protected readonly preview = STATS_LIST_PREVIEW;

  // All-time data: the year param is ignored.
  protected readonly section = statsSection(() =>
    combineLatest([
      // Same parameters as the hub teaser: one shared cache entry.
      this.stats.getByDeveloper(DEVELOPER_RANKING_LIMIT, DEVELOPER_MIN_RATED_GAMES),
      this.stats.getByReleaseEra(),
    ]).pipe(
      map(([developers, eras]) => ({ developers, eras })),
    ),
  );
  protected readonly state = this.section.state;

  protected readonly developerRows = computed<StatsBar[]>(() => {
    const developers = this.state().data?.developers;
    if (!developers) return [];
    const f = this.format;
    if (this.ranking() === 'hours') {
      const ratios = shares(developers.topByHours.map((d) => d.hours));
      return developers.topByHours.map((d, i) => ({
        key: i,
        label: d.developer,
        share: ratios[i],
        figure: f.hours(d.hours),
        sub: f.plural('common.games', d.gameCount),
        link: STUDIO_LINK,
        queryParams: { name: d.developer },
      }));
    }
    return developers.topByRating.map((d, i) => ({
      key: i,
      label: d.developer,
      share: ratingShare(d.averageRating),
      figure: f.rating(d.averageRating),
      figureClass: ratingTone(d.averageRating),
      sub: joinParts([f.plural('stats.studios.rated', d.ratedGameCount), f.hours(d.hours)]),
      link: STUDIO_LINK,
      queryParams: { name: d.developer },
    }));
  });

  protected readonly decadeRows = computed<StatsBar[]>(() => {
    const decades = (this.state().data?.eras.byDecade ?? []).filter((d) => d.gameCount > 0);
    const ratios = shares(decades.map((d) => d.gameCount));
    const f = this.format;
    return decades.map((d, i) => ({
      key: d.decade,
      label: f.text('stats.studios.decade', decadeParams(d.decade)),
      share: ratios[i],
      figure: f.plural('common.games', d.gameCount),
      link: GAMES_LINK,
      queryParams: gamesLinkParams({ decade: d.decade }),
      sub: joinParts([
        f.hours(d.hours),
        d.averageRating !== null ? f.text('stats.platforms.average', { rating: f.rating(d.averageRating) }) : null,
      ]),
    }));
  });
}
