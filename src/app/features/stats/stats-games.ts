import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { combineLatest } from 'rxjs';
import { STATS_RANKING_LIMIT, StatsService } from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { SectionHeader } from '../../shared/ui/section-header';
import { Segmented, SegmentedOption } from '../../shared/ui/segmented';
import { Skeleton } from '../../shared/ui/skeleton';
import { ratingTone } from '../../shared/utils/rating-tone';
import { STATS_LIST_PREVIEW, StatsBar, StatsBarList } from './stats-bar-list';
import { statsFormat } from './stats-format';
import { statsLibrary } from './stats-library';
import { StatsLoadError } from './stats-load-error';
import { StatsPageHeader } from './stats-page-header';
import { statsSection } from './stats-section';
import { coverMap, ratingShare, shares } from './stats.logic';
import { SHORT_GEM_MAX_HOURS, SHORT_GEM_MIN_RATING, waitingDays } from './stats-games.logic';

type PlayMode = 'single' | 'online';

/**
 * Every row keeps its small line, a blank one when there is nothing to say, so all the rows (and
 * the cards side by side) have the same height.
 */
function subLine(text: string | null | undefined): string {
  return text || ' ';
}

const PLAY_MODE_OPTIONS: readonly SegmentedOption<PlayMode>[] = [
  { value: 'single', label: 'stats.games.single' },
  { value: 'online', label: 'stats.games.online' },
];

/** One ranking card of the page. */
interface Ranking {
  key: string;
  title: string;
  /** Small line under the title explaining the rule (short gems' thresholds). */
  hint: string | null;
  tone: 'brand' | 'gold';
  rows: StatsBar[];
  empty: string;
}

/**
 * Games section (`/stats/games`, all time): full rankings of the library's games, up to 50 rows
 * each: most played (singleplayer or online), top rated, most replayed, longest single runs, short
 * gems, most diary days and the longest pending games. The dashboard keeps the top 5 of the first
 * two and links here. Every row opens its game (or its run).
 */
@Component({
  selector: 'app-stats-games',
  imports: [
    Navbar,
    TranslatePipe,
    SectionHeader,
    Segmented,
    Skeleton,
    StatsBarList,
    StatsLoadError,
    StatsPageHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stats-games.html',
})
export class StatsGames {
  private readonly stats = inject(StatsService);
  private readonly format = statsFormat();
  protected readonly preview = STATS_LIST_PREVIEW;
  protected readonly playModeOptions = PLAY_MODE_OPTIONS;
  protected readonly playMode = signal<PlayMode>('single');

  // All-time data: the year param is ignored.
  protected readonly section = statsSection(() =>
    combineLatest([
      this.stats.getMostPlayedSingleplayer(STATS_RANKING_LIMIT),
      this.stats.getMostPlayedOnline(STATS_RANKING_LIMIT),
      this.stats.getTopRated(STATS_RANKING_LIMIT),
      this.stats.getGameRankings(),
    ]),
  );
  protected readonly state = this.section.state;
  private readonly library = statsLibrary();
  private readonly covers = computed(() => coverMap(this.library() ?? []));
  /** Library games by id, for each row's small line (runs, hours) the rankings do not send. */
  private readonly games = computed(
    () => new Map((this.library() ?? []).map((game) => [game.id, game])),
  );

  private cover(gameId: number, name: string): StatsBar['cover'] {
    return { url: this.covers().get(gameId) ?? null, name };
  }

  /** Most played games of the picked mode, by hours. */
  protected readonly mostPlayedRows = computed<StatsBar[]>(() => {
    const data = this.state().data;
    if (!data) return [];
    const games = this.playMode() === 'single' ? data[0] : data[1];
    const ratios = shares(games.map((g) => g.totalHours));
    return games.map((g, i) => ({
      key: g.gameId,
      label: g.gameName,
      share: ratios[i],
      figure: this.format.hours(g.totalHours),
      sub: subLine(
        this.playMode() === 'online'
          ? this.format.text('stats.games.online')
          : this.runsOf(g.gameId),
      ),
      link: ['/games', g.gameId],
      cover: this.cover(g.gameId, g.gameName),
    }));
  });

  /** "3 runs" from the library, null while it loads or when unknown. */
  private runsOf(gameId: number): string | null {
    const count = this.games().get(gameId)?.experienceCount;
    return count ? this.format.plural('stats.runs', count) : null;
  }

  /** The game's total hours from the library, null while it loads or when unknown. */
  private hoursOf(gameId: number): string | null {
    const hours = this.games().get(gameId)?.totalHours;
    return hours ? this.format.hours(hours) : null;
  }

  /** The other rankings, in page order. */
  protected readonly rankings = computed<Ranking[]>(() => {
    const data = this.state().data;
    if (!data) return [];
    const [, , topRated, rankings] = data;
    const format = this.format;
    const replayRatios = shares(rankings.mostReplayed.map((g) => g.runCount));
    const runRatios = shares(rankings.longestRuns.map((r) => r.hours));
    const dayRatios = shares(rankings.mostDaysPlayed.map((g) => g.days));
    const now = new Date();
    const waits = rankings.longestPending.map((g) => waitingDays(g.pendingSince, now));
    const waitRatios = shares(waits);
    const month = new Intl.DateTimeFormat(format.locale(), { month: 'short', year: 'numeric' });

    return [
      {
        key: 'topRated',
        title: format.text('stats.games.topRated'),
        hint: null,
        tone: 'gold',
        empty: format.text('stats.games.noRated'),
        rows: topRated.map((r, i) => ({
          key: `${r.gameId}-${r.experienceId ?? 'online'}-${i}`,
          label: r.gameName,
          share: ratingShare(r.rating),
          figure: format.rating(r.rating),
          figureClass: ratingTone(r.rating),
          sub: subLine(r.online ? format.text('stats.games.online') : r.runLabel),
          link: r.experienceId
            ? ['/games', r.gameId, 'experiences', r.experienceId]
            : ['/games', r.gameId],
          cover: this.cover(r.gameId, r.gameName),
        })),
      },
      {
        key: 'mostReplayed',
        title: format.text('stats.games.mostReplayed'),
        hint: null,
        tone: 'brand',
        empty: format.text('stats.games.noReplays'),
        rows: rankings.mostReplayed.map((g, i) => ({
          key: g.gameId,
          label: g.gameName,
          share: replayRatios[i],
          figure: format.plural('stats.runs', g.runCount),
          sub: format.hours(g.hours),
          link: ['/games', g.gameId],
          cover: this.cover(g.gameId, g.gameName),
        })),
      },
      {
        key: 'longestRuns',
        title: format.text('stats.games.longestRuns'),
        hint: null,
        tone: 'brand',
        empty: format.text('common.noData'),
        rows: rankings.longestRuns.map((r, i) => ({
          key: r.experienceId,
          label: r.gameName,
          share: runRatios[i],
          figure: format.hours(r.hours),
          sub: subLine(r.runLabel),
          link: ['/games', r.gameId, 'experiences', r.experienceId],
          cover: this.cover(r.gameId, r.gameName),
        })),
      },
      {
        key: 'shortGems',
        title: format.text('stats.games.shortGems'),
        hint: format.text('stats.games.shortGemsHint', {
          rating: format.point(SHORT_GEM_MIN_RATING),
          hours: format.hours(SHORT_GEM_MAX_HOURS),
        }),
        tone: 'gold',
        empty: format.text('stats.games.noGems'),
        rows: rankings.shortGems.map((g) => ({
          key: g.gameId,
          label: g.gameName,
          share: ratingShare(g.rating),
          figure: format.rating(g.rating),
          figureClass: ratingTone(g.rating),
          sub: format.hours(g.hours),
          link: ['/games', g.gameId],
          cover: this.cover(g.gameId, g.gameName),
        })),
      },
      {
        key: 'mostDaysPlayed',
        title: format.text('stats.games.mostDaysPlayed'),
        hint: null,
        tone: 'brand',
        empty: format.text('stats.games.noDiary'),
        rows: rankings.mostDaysPlayed.map((g, i) => ({
          key: g.gameId,
          label: g.gameName,
          share: dayRatios[i],
          figure: format.plural('stats.days', g.days),
          sub: subLine(this.hoursOf(g.gameId)),
          link: ['/games', g.gameId],
          cover: this.cover(g.gameId, g.gameName),
        })),
      },
      {
        key: 'longestPending',
        title: format.text('stats.games.longestPending'),
        hint: null,
        tone: 'brand',
        empty: format.text('stats.games.noPending'),
        rows: rankings.longestPending.map((g, i) => ({
          key: g.gameId,
          label: g.gameName,
          share: waitRatios[i],
          figure: format.text('stats.games.since', {
            date: month.format(new Date(g.pendingSince)),
          }),
          sub: format.plural('stats.days', waits[i]),
          link: ['/games', g.gameId],
          cover: this.cover(g.gameId, g.gameName),
        })),
      },
    ];
  });
}
