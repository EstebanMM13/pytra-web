import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { StatsService } from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { HoursPipe } from '../../shared/pipes/hours.pipe';
import { TranslatePluralPipe } from '../../shared/pipes/translate-plural.pipe';
import { ICONS } from '../../shared/ui/icons';
import { SectionHeader } from '../../shared/ui/section-header';
import { Skeleton } from '../../shared/ui/skeleton';
import { ratingTone } from '../../shared/utils/rating-tone';
import { STATS_LIST_PREVIEW, StatsBar, StatsBarList } from './stats-bar-list';
import { StatsCallout } from './stats-callout';
import { StatsColumn, StatsColumnChart } from './stats-column-chart';
import { MAX_STACK_COVERS } from './stats-cover-stack';
import { bestRatedDecade, decadeOf, inDecade, releaseExtremes, topDecade } from './stats-eras.logic';
import { statsFormat } from './stats-format';
import { STATS_HERO_RADIUS } from './stats-hero';
import { statsLibrary } from './stats-library';
import { StatsLoadError } from './stats-load-error';
import { StatsPageHeader } from './stats-page-header';
import { statsSection } from './stats-section';
import { StatsSpotlight } from './stats-spotlight';
import {
  CoverRef,
  GAMES_LINK,
  decadeParams,
  gamesLinkParams,
  joinParts,
  releaseYearCovers,
  releaseYearOf,
  shares,
  topCovers,
  trimEmptyEnds,
  withArt,
} from './stats.logic';

/** An era callout: the reason, the item, its figure and where it links. */
interface EraCallout {
  key: 'bestRated' | 'oldest' | 'newest';
  label: string;
  name: string;
  figure: string;
  figureClass: string;
  covers: CoverRef[];
  link: readonly (string | number)[];
  queryParams: Record<string, string> | null;
}

/**
 * Eras section (`/stats/eras`, all time): the release decade you play most as the spotlight
 * (hours, games, rating, its most played games), a histogram of games per decade with each
 * decade's games, hours and rating in a table under it, the best rated decade and the oldest and
 * newest releases you played, and the release years ranked by hours. Decades open the library on
 * them; release years open their decade (the library has no release-year filter); the oldest and
 * newest releases open their game.
 */
@Component({
  selector: 'app-stats-eras',
  imports: [
    Navbar,
    TranslatePipe,
    TranslatePluralPipe,
    HoursPipe,
    SectionHeader,
    Skeleton,
    StatsBarList,
    StatsCallout,
    StatsColumnChart,
    StatsLoadError,
    StatsPageHeader,
    StatsSpotlight,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stats-eras.html',
})
export class StatsEras {
  protected readonly icons = ICONS;
  protected readonly preview = STATS_LIST_PREVIEW;
  protected readonly heroRadius = STATS_HERO_RADIUS;
  protected readonly gamesLink = GAMES_LINK;
  private readonly stats = inject(StatsService);
  private readonly format = statsFormat();
  private readonly library = statsLibrary();

  // All-time data: the year param is ignored.
  protected readonly section = statsSection(() => this.stats.getByReleaseEra());
  protected readonly state = this.section.state;
  protected readonly coversPending = computed(() => this.library() === null);

  /** Decades from the first to the last with games. */
  private readonly decades = computed(() => trimEmptyEnds(this.state().data?.byDecade ?? [], (d) => d.gameCount));
  /** The most played game's cover per release year, one pass per library list. */
  private readonly yearCovers = computed(() => releaseYearCovers(this.library() ?? []));

  private decadeLabel(decade: number): string {
    return this.format.text('stats.decadeLabel', decadeParams(decade));
  }

  /** The decade with the most hours, with its most played games' covers. */
  protected readonly top = computed(() => {
    const top = topDecade(this.decades());
    if (!top) return null;
    const format = this.format;
    return {
      ...top,
      label: this.decadeLabel(top.decade),
      meta: joinParts([
        format.plural('common.games', top.gameCount),
        top.averageRating !== null ? format.text('stats.platforms.average', { rating: format.rating(top.averageRating) }) : null,
      ]),
      queryParams: gamesLinkParams({ decade: top.decade }),
      covers: withArt(topCovers(this.library() ?? [], inDecade(top.decade), MAX_STACK_COVERS)),
    };
  });

  /** The best rated decade and the oldest / newest releases played (each left out when unknown). */
  protected readonly callouts = computed<EraCallout[]>(() => {
    const format = this.format;
    const best = bestRatedDecade(this.decades());
    const { oldest, newest } = releaseExtremes(this.library() ?? []);
    const callouts: (EraCallout | null)[] = [
      best && {
        key: 'bestRated',
        label: 'stats.eras.bestRated',
        name: this.decadeLabel(best.decade),
        figure: format.rating(best.averageRating),
        figureClass: ratingTone(best.averageRating),
        covers: [],
        link: GAMES_LINK,
        queryParams: gamesLinkParams({ decade: best.decade }),
      },
      ...[
        { key: 'oldest' as const, label: 'stats.eras.oldest', game: oldest },
        { key: 'newest' as const, label: 'stats.eras.newest', game: newest },
      ].map(({ key, label, game }) =>
        game
          ? {
              key,
              label,
              name: game.name,
              figure: String(releaseYearOf(game.releaseDate)),
              figureClass: '',
              covers: [{ id: game.id, name: game.name, url: game.coverImageUrl }],
              link: ['/games', game.id],
              queryParams: null,
            }
          : null,
      ),
    ];
    return callouts.filter((c): c is EraCallout => c !== null);
  });

  protected readonly decadeColumns = computed<StatsColumn[]>(() => {
    const format = this.format;
    return this.decades().map((d) => ({
      key: d.decade,
      label: String(d.decade),
      value: d.gameCount,
      figure: String(d.gameCount),
      title: `${this.decadeLabel(d.decade)}: ${format.plural('common.games', d.gameCount)}`,
      link: d.gameCount > 0 ? GAMES_LINK : null,
      queryParams: gamesLinkParams({ decade: d.decade }),
    }));
  });

  /** Each decade's games, hours and rating, newest first: the table under the histogram. */
  protected readonly decadeRows = computed(() => {
    const format = this.format;
    return [...this.decades()]
      .reverse()
      .filter((d) => d.gameCount > 0)
      .map((d) => ({
        decade: d.decade,
        label: this.decadeLabel(d.decade),
        gameCount: d.gameCount,
        hours: d.hours,
        rating: d.averageRating !== null ? format.rating(d.averageRating) : '—',
        ratingClass: d.averageRating !== null ? ratingTone(d.averageRating) : 'text-faint',
      }));
  });

  /** Release years by hours, with their most played game's cover. */
  protected readonly yearRows = computed<StatsBar[]>(() => {
    const format = this.format;
    const years = [...(this.state().data?.byYear ?? [])].filter((y) => y.hours > 0).sort((a, b) => b.hours - a.hours || b.year - a.year);
    const ratios = shares(years.map((y) => y.hours));
    const covers = this.yearCovers();
    return years.map((y, i) => ({
      key: y.year,
      label: String(y.year),
      share: ratios[i],
      figure: format.hours(y.hours),
      sub: joinParts([
        format.plural('common.games', y.gameCount),
        y.averageRating !== null ? format.text('stats.platforms.average', { rating: format.rating(y.averageRating) }) : null,
      ]),
      link: GAMES_LINK,
      queryParams: gamesLinkParams({ decade: decadeOf(y.year) }),
      cover: covers.get(y.year) ?? null,
    }));
  });
}
