import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { StatsService } from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { HoursPipe } from '../../shared/pipes/hours.pipe';
import { SectionHeader } from '../../shared/ui/section-header';
import { Skeleton } from '../../shared/ui/skeleton';
import { STATS_LIST_PREVIEW, StatsBar, StatsBarList } from './stats-bar-list';
import { statsFormat } from './stats-format';
import { StatsLoadError } from './stats-load-error';
import { StatsPageHeader } from './stats-page-header';
import { statsPlatformColors } from './stats-platform-colors';
import { StatsScope } from './stats-scope';
import { statsSection } from './stats-section';
import { GAMES_LINK, gamesLinkParams, joinParts, shares, stackLegend, yearSegments } from './stats.logic';

/**
 * Platforms section (`/stats/platforms?year=`): hours, runs and ratings per platform for all time
 * or a year (each row opens the library on that platform, and year), and, for all time, every
 * year's hours stacked by platform (each year links to its summary). Platforms of one family get
 * distinct shades of its colour.
 */
@Component({
  selector: 'app-stats-platforms',
  imports: [
    Navbar,
    RouterLink,
    TranslatePipe,
    HoursPipe,
    SectionHeader,
    Skeleton,
    StatsBarList,
    StatsLoadError,
    StatsPageHeader,
    StatsScope,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stats-platforms.html',
})
export class StatsPlatforms {
  private readonly stats = inject(StatsService);
  private readonly format = statsFormat();
  protected readonly section = statsSection((year) => this.stats.getByPlatform(year));
  protected readonly state = this.section.state;
  private readonly colorOf = statsPlatformColors();
  protected readonly preview = STATS_LIST_PREVIEW;

  protected readonly rows = computed<StatsBar[]>(() => {
    const platforms = (this.state().data?.platforms ?? []).filter((p) => p.hours > 0);
    const ratios = shares(platforms.map((p) => p.hours));
    const f = this.format;
    const colorOf = this.colorOf();
    const year = this.state().year;
    return platforms.map((p, i) => ({
      key: p.platformId,
      label: f.platform(p.name),
      share: ratios[i],
      figure: f.hours(p.hours),
      color: colorOf(p.platformId, p.color),
      dot: true,
      link: GAMES_LINK,
      queryParams: gamesLinkParams({ platform: p.platformId, year }),
      sub: joinParts([
        // Games, as the library lists them once the row is tapped.
        p.gameCount > 0 ? f.plural('common.games', p.gameCount) : null,
        p.runCount > 0 ? f.plural('stats.runs', p.runCount) : null,
        p.completedRunCount > 0 ? f.plural('stats.platforms.completed', p.completedRunCount) : null,
        p.onlineHours > 0 ? f.text('stats.platforms.online', { hours: f.hours(p.onlineHours) }) : null,
        p.averageRating !== null ? f.text('stats.platforms.average', { rating: f.rating(p.averageRating) }) : null,
      ]),
    }));
  });

  /** Years newest first, each a stacked bar scaled to the busiest year. */
  protected readonly years = computed(() => {
    const byYear = this.state().data?.byYear ?? [];
    const max = Math.max(0, ...byYear.map((y) => y.totalHours));
    const unassigned = this.format.text('stats.platforms.unassigned');
    const colorOf = this.colorOf();
    return [...byYear]
      .filter((y) => y.totalHours > 0)
      .reverse()
      .map((y) => ({
        year: y.year,
        totalHours: y.totalHours,
        segments: yearSegments(y, max, unassigned, colorOf).map((s) => ({
          ...s,
          name: typeof s.key === 'number' ? this.format.platform(s.name) : s.name,
        })),
      }));
  });

  protected readonly legend = computed(() =>
    stackLegend(this.state().data?.byYear ?? [], this.colorOf()).map((p) => ({ ...p, name: this.format.platform(p.name) })),
  );
}
