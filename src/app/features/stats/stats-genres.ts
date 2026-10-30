import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, combineLatest, map, of } from 'rxjs';
import { CompletionStats, RatingStats, YearStat } from '../../core/models/stats.model';
import { StatsService } from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { formatGenreName } from '../../shared/pipes/genre-name.pipe';
import { ICONS } from '../../shared/ui/icons';
import { SectionHeader } from '../../shared/ui/section-header';
import { Skeleton } from '../../shared/ui/skeleton';
import { ratingTone } from '../../shared/utils/rating-tone';
import { STATS_LIST_PREVIEW, StatsBar, StatsBarList } from './stats-bar-list';
import { StatsCallout } from './stats-callout';
import { MAX_STACK_COVERS } from './stats-cover-stack';
import { statsFormat } from './stats-format';
import { GenreProfile, genreHighlights, genreProfiles, genreShareBase, genresOfTheYear } from './stats-genres.logic';
import { STATS_HERO_RADIUS } from './stats-hero';
import { statsLibrary, statsPlayFacts } from './stats-library';
import { StatsLoadError } from './stats-load-error';
import { StatsPageHeader } from './stats-page-header';
import { statsSection } from './stats-section';
import { StatsSpotlight } from './stats-spotlight';
import { CoverRef, GAMES_LINK, gamesLinkParams, genreCovers, joinParts, percentFormat, shares, withArt } from './stats.logic';

/** Years listed in "genre of each year". */
export const GENRE_YEARS = 8;

/** A callout of the genres page: a genre standing out for one reason. */
interface GenreCallout {
  key: 'bestRated' | 'mostAbandoned' | 'mostGames';
  label: string;
  genre: GenreProfile;
  figure: string;
  figureClass: string;
  covers: CoverRef[];
  queryParams: Record<string, string>;
}

/**
 * Genres section (`/stats/genres`, all time): the most played one as the spotlight (its share
 * of all the hours, games and rating), the genres
 * that stand out (best rated, most abandoned, most games), every genre ranked by hours with its
 * rating and abandonment, and each year's main genre (run hours from `/stats/play-facts` credited
 * to the genres of the library's games). Only the genre list is required: ratings, abandonment,
 * the yearly hours, the play facts and the library each fall back to nothing when they fail.
 * Genres open the library filtered by them.
 */
@Component({
  selector: 'app-stats-genres',
  imports: [
    Navbar,
    TranslatePipe,
    SectionHeader,
    Skeleton,
    StatsBarList,
    StatsCallout,
    StatsLoadError,
    StatsPageHeader,
    StatsSpotlight,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stats-genres.html',
})
export class StatsGenres {
  protected readonly preview = STATS_LIST_PREVIEW;
  protected readonly heroRadius = STATS_HERO_RADIUS;
  protected readonly gamesLink = GAMES_LINK;
  protected readonly icon = ICONS.layoutGrid;
  private readonly stats = inject(StatsService);
  private readonly format = statsFormat();
  private readonly library = statsLibrary();
  private readonly playFacts = statsPlayFacts();

  // All-time data: the year param is ignored. Only the genre list is essential.
  protected readonly section = statsSection(() =>
    combineLatest([
      this.stats.getByGenre(),
      this.stats.getRatings().pipe(catchError(() => of<Pick<RatingStats, 'byGenre'>>({ byGenre: [] }))),
      this.stats.getCompletion().pipe(catchError(() => of<Pick<CompletionStats, 'abandonmentByGenre'>>({ abandonmentByGenre: [] }))),
      this.stats.getByYear().pipe(catchError(() => of<YearStat[]>([]))),
    ]).pipe(map(([byGenre, ratings, completion, years]) => ({ byGenre, ratings, completion, years }))),
  );
  protected readonly state = this.section.state;
  protected readonly coversPending = computed(() => this.library() === null);
  /** Covers per genre, one pass per library list. */
  private readonly covers = computed(() => genreCovers(this.library() ?? [], MAX_STACK_COVERS));

  protected readonly profiles = computed(() => {
    const data = this.state().data;
    if (!data) return [];
    return genreProfiles(
      data.byGenre,
      data.ratings.byGenre,
      data.completion.abandonmentByGenre,
      genreShareBase(this.library(), data.years),
      formatGenreName,
    );
  });

  private coversOf(genreId: number): CoverRef[] {
    return this.covers().get(genreId) ?? [];
  }

  /** The most played genre, with its covers; null without hours. */
  protected readonly top = computed(() => {
    const top = this.profiles()[0];
    if (!top || top.hours <= 0) return null;
    const format = this.format;
    return {
      ...top,
      covers: withArt(this.coversOf(top.genreId)),
      percent: percentFormat(format.locale())(top.share),
      shareHint: format.text('stats.genres.shareOfHours', { hours: format.hours(top.hours) }),
      meta: joinParts([
        format.plural('common.games', top.gameCount),
        top.rating !== null ? format.text('stats.platforms.average', { rating: format.rating(top.rating) }) : null,
      ]),
      queryParams: gamesLinkParams({ genre: top.genreId }),
    };
  });

  protected readonly callouts = computed<GenreCallout[]>(() => {
    const highlights = genreHighlights(this.profiles());
    const format = this.format;
    const percent = percentFormat(format.locale());
    const callouts: (Omit<GenreCallout, 'covers' | 'queryParams'> | null)[] = [
      highlights.bestRated && {
        key: 'bestRated',
        label: 'stats.genres.bestRated',
        genre: highlights.bestRated,
        figure: format.rating(highlights.bestRated.rating),
        figureClass: ratingTone(highlights.bestRated.rating),
      },
      highlights.mostAbandoned && {
        key: 'mostAbandoned',
        label: 'stats.genres.mostAbandoned',
        genre: highlights.mostAbandoned,
        figure: percent(highlights.mostAbandoned.abandonment!),
        figureClass: '',
      },
      highlights.mostGames && {
        key: 'mostGames',
        label: 'stats.genres.mostGames',
        genre: highlights.mostGames,
        figure: String(highlights.mostGames.gameCount),
        figureClass: '',
      },
    ];
    return callouts
      .filter((c): c is Omit<GenreCallout, 'covers' | 'queryParams'> => c !== null)
      .map((c) => ({
        ...c,
        covers: this.coversOf(c.genre.genreId).slice(0, 1),
        queryParams: gamesLinkParams({ genre: c.genre.genreId }),
      }));
  });

  /** Every genre by hours: games, rating and abandonment under the bar; opens the library on it. */
  protected readonly rows = computed<StatsBar[]>(() => {
    const format = this.format;
    const percent = percentFormat(format.locale());
    const profiles = this.profiles();
    const ratios = shares(profiles.map((p) => p.hours));
    return profiles.map((p, i) => ({
      key: p.genreId,
      label: p.name,
      share: ratios[i],
      figure: format.hours(p.hours),
      sub: joinParts([
        format.plural('common.games', p.gameCount),
        p.rating !== null ? format.text('stats.platforms.average', { rating: format.rating(p.rating) }) : null,
        p.abandonment !== null ? format.text('stats.genres.abandonedShare', { percent: percent(p.abandonment) }) : null,
      ]),
      link: GAMES_LINK,
      queryParams: gamesLinkParams({ genre: p.genreId }),
      cover: this.coversOf(p.genreId)[0] ?? null,
    }));
  });

  /** Each year's main genre, newest first, as bars of its share of the year (needs the play facts and the library). */
  protected readonly years = computed<StatsBar[]>(() => {
    const facts = this.playFacts();
    const games = this.library();
    if (!facts || !games?.length) return [];
    const percent = percentFormat(this.format.locale());
    return genresOfTheYear(facts.runs, games, formatGenreName)
      .slice(0, GENRE_YEARS)
      .map((y) => ({
        key: y.year,
        label: `${y.year} · ${y.name}`,
        share: y.share,
        figure: percent(y.share),
        link: GAMES_LINK,
        queryParams: gamesLinkParams({ genre: y.genreId, year: y.year }),
      }));
  });
}
