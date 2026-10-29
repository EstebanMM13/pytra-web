import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { combineLatest, map } from 'rxjs';
import { StatsService } from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { TranslatePluralPipe } from '../../shared/pipes/translate-plural.pipe';
import { SectionHeader } from '../../shared/ui/section-header';
import { Segmented, SegmentedOption } from '../../shared/ui/segmented';
import { Skeleton } from '../../shared/ui/skeleton';
import { ratingTone } from '../../shared/utils/rating-tone';
import { StatsBar, StatsBarList } from './stats-bar-list';
import { statsFormat } from './stats-format';
import { StatsLoadError } from './stats-load-error';
import { StatsPageHeader } from './stats-page-header';
import { statsSection } from './stats-section';
import { decadeParams } from './stats.logic';

type DeveloperRanking = 'hours' | 'rating';

const RANKING_OPTIONS: readonly SegmentedOption<DeveloperRanking>[] = [
  { value: 'hours', label: 'stats.studios.byHours' },
  { value: 'rating', label: 'stats.studios.byRating' },
];

/**
 * Studios & eras section (`/stats/studios`, all time): top developers by hours or by rating (only
 * those with enough rated games) and games per release decade.
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

  // All-time data: the year param is ignored.
  protected readonly section = statsSection(() =>
    combineLatest([this.stats.getByDeveloper(), this.stats.getByReleaseEra()]).pipe(
      map(([developers, eras]) => ({ developers, eras })),
    ),
  );
  protected readonly state = this.section.state;

  protected readonly developerRows = computed<StatsBar[]>(() => {
    const developers = this.state().data?.developers;
    if (!developers) return [];
    const f = this.format;
    if (this.ranking() === 'hours') {
      const max = Math.max(0, ...developers.topByHours.map((d) => d.hours));
      return developers.topByHours.map((d, i) => ({
        key: i,
        label: d.developer,
        share: max > 0 ? d.hours / max : 0,
        figure: f.hours(d.hours),
        sub: f.plural('common.games', d.gameCount),
      }));
    }
    return developers.topByRating.map((d, i) => ({
      key: i,
      label: d.developer,
      share: (d.averageRating ?? 0) / 10,
      figure: f.rating(d.averageRating),
      figureClass: ratingTone(d.averageRating),
      sub: `${f.plural('stats.studios.rated', d.ratedGameCount)} · ${f.hours(d.hours)}`,
    }));
  });

  protected readonly decadeRows = computed<StatsBar[]>(() => {
    const decades = (this.state().data?.eras.byDecade ?? []).filter((d) => d.gameCount > 0);
    const max = Math.max(0, ...decades.map((d) => d.gameCount));
    const f = this.format;
    return decades.map((d) => ({
      key: d.decade,
      label: f.text('stats.studios.decade', decadeParams(d.decade)),
      share: max > 0 ? d.gameCount / max : 0,
      figure: f.plural('common.games', d.gameCount),
      sub: [f.hours(d.hours), d.averageRating !== null ? f.text('stats.platforms.average', { rating: f.rating(d.averageRating) }) : null]
        .filter(Boolean)
        .join(' · '),
    }));
  });
}
