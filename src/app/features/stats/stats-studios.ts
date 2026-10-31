import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import {
  DEVELOPER_MIN_RATED_GAMES,
  DEVELOPER_RANKING_LIMIT,
  StatsService,
} from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { TranslatePluralPipe } from '../../shared/pipes/translate-plural.pipe';
import { ICONS } from '../../shared/ui/icons';
import { SectionHeader } from '../../shared/ui/section-header';
import { Segmented, SegmentedOption } from '../../shared/ui/segmented';
import { Skeleton } from '../../shared/ui/skeleton';
import { ratingTone } from '../../shared/utils/rating-tone';
import { STATS_LIST_PREVIEW, StatsBar, StatsBarList } from './stats-bar-list';
import { MAX_STACK_COVERS } from './stats-cover-stack';
import { statsFormat } from './stats-format';
import { statsLibrary } from './stats-library';
import { StatsLoadError } from './stats-load-error';
import { StatsPageHeader } from './stats-page-header';
import { statsSection } from './stats-section';
import { StatsSpotlight } from './stats-spotlight';
import {
  CoverRef,
  developerCovers,
  developerKey,
  publisherCovers,
  joinParts,
  ratingShare,
  shares,
  withArt,
} from './stats.logic';

type DeveloperRanking = 'hours' | 'rating';
/** Whose studios the page ranks: the games' developers or their publishers (`?by=publisher`). */
export type StudioKind = 'developer' | 'publisher';

const KIND_OPTIONS: readonly SegmentedOption<StudioKind>[] = [
  { value: 'developer', label: 'stats.studios.kindDevelopers' },
  { value: 'publisher', label: 'stats.studios.kindPublishers' },
];

/** Translation keys that change with the studio kind. */
const KIND_TEXT = {
  developer: {
    list: 'stats.studios.developers',
    topByHours: 'stats.studios.topByHours',
    topByRating: 'stats.studios.topByRating',
    threshold: 'stats.studios.threshold',
    empty: 'stats.studios.empty',
    noRated: 'stats.studios.noRated',
  },
  publisher: {
    list: 'stats.studios.publishers',
    topByHours: 'stats.studios.topPublisherByHours',
    topByRating: 'stats.studios.topPublisherByRating',
    threshold: 'stats.studios.publisherThreshold',
    empty: 'stats.studios.publisherEmpty',
    noRated: 'stats.studios.publisherNoRated',
  },
} as const;

const RANKING_OPTIONS: readonly SegmentedOption<DeveloperRanking>[] = [
  { value: 'hours', label: 'stats.studios.byHours' },
  { value: 'rating', label: 'stats.studios.byRating' },
];

/** Router commands of the studio detail page (the name goes in `?name=`). */
const STUDIO_LINK: readonly string[] = ['/stats/studio'];

/**
 * Studios section (`/stats/studios`, all time): developers or publishers (a selector kept in
 * `?by=`), the first studio of the picked ranking as a hero card (its games' covers and, on wide
 * screens, its most played games), and every studio by hours or by rating (only those with enough
 * rated games). Each studio opens its studio page.
 * Release decades live in their own section (`/stats/eras`).
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
    StatsSpotlight,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stats-studios.html',
})
export class StatsStudios {
  protected readonly icons = ICONS;
  protected readonly studioLink = STUDIO_LINK;
  private readonly stats = inject(StatsService);
  private readonly format = statsFormat();
  protected readonly rankingOptions = RANKING_OPTIONS;
  protected readonly ranking = signal<DeveloperRanking>('hours');
  protected readonly preview = STATS_LIST_PREVIEW;
  protected readonly kindOptions = KIND_OPTIONS;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly kind = toSignal(
    this.route.queryParamMap.pipe(map((params): StudioKind => (params.get('by') === 'publisher' ? 'publisher' : 'developer'))),
    { initialValue: 'developer' as StudioKind },
  );
  protected readonly text = computed(() => KIND_TEXT[this.kind()]);

  // All-time data: the year param is ignored.
  private readonly developers = statsSection(() =>
    // Same parameters as the hub teaser: one shared cache entry.
    this.stats.getByDeveloper(DEVELOPER_RANKING_LIMIT, DEVELOPER_MIN_RATED_GAMES),
  );
  private readonly publishers = statsSection(() => this.stats.getByPublisher(DEVELOPER_RANKING_LIMIT, DEVELOPER_MIN_RATED_GAMES));
  protected readonly section = computed(() => (this.kind() === 'publisher' ? this.publishers : this.developers));
  protected readonly state = computed(() => this.section().state());
  private readonly library = statsLibrary();

  /** The library is still loading: the hero keeps the covers' room. */
  protected readonly coversPending = computed(() => this.library() === null);
  /** Covers per studio of the picked kind, indexed once per library load (rows and hero look them up). */
  private readonly coverIndex = computed(() =>
    this.kind() === 'publisher'
      ? publisherCovers(this.library() ?? [], MAX_STACK_COVERS)
      : developerCovers(this.library() ?? [], MAX_STACK_COVERS),
  );

  protected setKind(kind: StudioKind): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { by: kind === 'publisher' ? 'publisher' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Query params of a studio's page: its name, and the kind for publishers. */
  private studioParams(name: string): Record<string, string> {
    return this.kind() === 'publisher' ? { name, by: 'publisher' } : { name };
  }

  /** Up to four covers of a studio's games, most played first. */
  private coversOf(developer: string): CoverRef[] {
    return this.coverIndex().get(developerKey(developer)) ?? [];
  }

  /** The picked ranking's developers (by hours, or by rating among those with enough rated games). */
  private readonly ranked = computed(() => {
    const developers = this.state().data;
    if (!developers) return [];
    return this.ranking() === 'hours' ? developers.topByHours : developers.topByRating;
  });

  protected readonly developerRows = computed<StatsBar[]>(() => {
    const format = this.format;
    const byHours = this.ranking() === 'hours';
    const ranked = this.ranked();
    const ratios = shares(ranked.map((d) => d.hours));
    return ranked.map((d, i) => ({
      key: i,
      label: d.developer,
      share: byHours ? ratios[i] : ratingShare(d.averageRating),
      figure: byHours ? format.hours(d.hours) : format.rating(d.averageRating),
      figureClass: byHours ? undefined : ratingTone(d.averageRating),
      sub: byHours
        ? format.plural('common.games', d.gameCount)
        : joinParts([format.plural('stats.studios.rated', d.ratedGameCount), format.hours(d.hours)]),
      link: STUDIO_LINK,
      queryParams: this.studioParams(d.developer),
      cover: this.coversOf(d.developer)[0] ?? null,
    }));
  });

  /** The first studio of the picked ranking, with its headline figure; null when the ranking is empty. */
  protected readonly topStudio = computed(() => {
    const top = this.ranked()[0];
    if (!top) return null;
    const format = this.format;
    const byHours = this.ranking() === 'hours';
    return {
      name: top.developer,
      queryParams: this.studioParams(top.developer),
      covers: withArt(this.coversOf(top.developer)),
      figure: byHours ? format.hours(top.hours) : format.rating(top.averageRating),
      figureClass: byHours ? '' : ratingTone(top.averageRating),
      meta: byHours
        ? joinParts([
            format.plural('common.games', top.gameCount),
            top.averageRating !== null ? format.text('stats.platforms.average', { rating: format.rating(top.averageRating) }) : null,
          ])
        : joinParts([format.plural('stats.studios.rated', top.ratedGameCount), format.hours(top.hours)]),
    };
  });
}
