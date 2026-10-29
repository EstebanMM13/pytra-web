import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { StatsService } from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { HoursPipe } from '../../shared/pipes/hours.pipe';
import { SectionHeader } from '../../shared/ui/section-header';
import { Skeleton } from '../../shared/ui/skeleton';
import { StatsBar, StatsBarList } from './stats-bar-list';
import { statsFormat } from './stats-format';
import { StatsLoadError } from './stats-load-error';
import { StatsPageHeader } from './stats-page-header';
import { StatsScope } from './stats-scope';
import { statsSection } from './stats-section';
import { platformColor, stackLegend, yearSegments } from './stats.logic';

/**
 * Platforms section (`/stats/platforms?year=`): hours, runs and ratings per platform for all time
 * or a year, and every year's hours stacked by platform (each year links to its summary).
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

  protected readonly rows = computed<StatsBar[]>(() => {
    const platforms = (this.state().data?.platforms ?? []).filter((p) => p.hours > 0);
    const max = Math.max(0, ...platforms.map((p) => p.hours));
    const f = this.format;
    return platforms.map((p) => ({
      key: p.platformId,
      label: f.platform(p.name),
      share: max > 0 ? p.hours / max : 0,
      figure: f.hours(p.hours),
      color: platformColor(p.color),
      dot: true,
      sub: [
        p.runCount > 0 ? f.plural('stats.runs', p.runCount) : null,
        p.completedRunCount > 0 ? f.plural('stats.platforms.completed', p.completedRunCount) : null,
        p.onlineHours > 0 ? f.text('stats.platforms.online', { hours: f.hours(p.onlineHours) }) : null,
        p.averageRating !== null ? f.text('stats.platforms.average', { rating: f.rating(p.averageRating) }) : null,
      ]
        .filter(Boolean)
        .join(' · '),
    }));
  });

  /** Years newest first, each a stacked bar scaled to the busiest year. */
  protected readonly years = computed(() => {
    const byYear = this.state().data?.byYear ?? [];
    const max = Math.max(0, ...byYear.map((y) => y.totalHours));
    const unassigned = this.format.text('stats.platforms.unassigned');
    return [...byYear]
      .filter((y) => y.totalHours > 0)
      .reverse()
      .map((y) => ({
        year: y.year,
        totalHours: y.totalHours,
        segments: yearSegments(y, max, unassigned).map((s) => ({
          ...s,
          name: typeof s.key === 'number' ? this.format.platform(s.name) : s.name,
        })),
      }));
  });

  protected readonly legend = computed(() =>
    stackLegend(this.state().data?.byYear ?? []).map((p) => ({ ...p, name: this.format.platform(p.name) })),
  );
}
