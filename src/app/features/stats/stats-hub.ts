import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, catchError, of, startWith, switchMap } from 'rxjs';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';
import {
  DEVELOPER_MIN_RATED_GAMES,
  DEVELOPER_RANKING_LIMIT,
  StatsService,
} from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { HoursPipe } from '../../shared/pipes/hours.pipe';
import { RatingPipe } from '../../shared/pipes/rating.pipe';
import { RatingTonePipe } from '../../shared/pipes/rating-tone.pipe';
import { TranslatePluralPipe } from '../../shared/pipes/translate-plural.pipe';
import { ICONS } from '../../shared/ui/icons';
import { StatsHubCard } from './stats-hub-card';
import { statsFormat } from './stats-format';
import { sagaTeaser } from './stats.logic';

/**
 * A teaser's data: `undefined` while loading, null when the request failed. Reloaded when a run is
 * saved elsewhere (the "+" menu), like the sections; the cache serves the previous value meanwhile.
 * Created in an injection context.
 */
function teaser<T>(request: () => Observable<T>) {
  const saved$ = inject(RunFormLauncher).saved$;
  return toSignal<T | null | undefined>(
    saved$.pipe(
      startWith(null),
      switchMap(() => request().pipe(catchError(() => of(null)))),
    ),
    { initialValue: undefined },
  );
}

/**
 * Stats hub (`/stats`): one card per section with a teaser figure. Years and Sagas keep their own
 * pages (`/years`, `/sagas`); the other sections live under `/stats/*`. The teasers come from small
 * cached endpoints fetched in parallel, the same calls (and cache entries) the sections use.
 */
@Component({
  selector: 'app-stats-hub',
  imports: [Navbar, StatsHubCard, TranslatePipe, TranslatePluralPipe, HoursPipe, RatingPipe, RatingTonePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stats-hub.html',
})
export class StatsHub {
  protected readonly icons = ICONS;
  private readonly stats = inject(StatsService);
  private readonly format = statsFormat();

  protected readonly activity = teaser(() => this.stats.getActivity());
  protected readonly byYear = teaser(() => this.stats.getByYear());
  protected readonly bySaga = teaser(() => this.stats.getBySaga());
  protected readonly platforms = teaser(() => this.stats.getByPlatform());
  // Same parameters as the studios section: one shared cache entry.
  protected readonly developers = teaser(() =>
    this.stats.getByDeveloper(DEVELOPER_RANKING_LIMIT, DEVELOPER_MIN_RATED_GAMES),
  );
  protected readonly completion = teaser(() => this.stats.getCompletion());
  private readonly ratings = teaser(() => this.stats.getRatings());

  /** The most recent year with any hours. */
  protected readonly latestYear = computed(() => {
    const years = this.byYear();
    if (!years) return years;
    return [...years].filter((y) => y.totalHours > 0).sort((a, b) => b.year - a.year)[0] ?? null;
  });
  protected readonly sagas = computed(() => {
    const stats = this.bySaga();
    return stats ? sagaTeaser(stats) : stats;
  });
  protected readonly topPlatform = computed(() => {
    const stats = this.platforms();
    return stats ? (stats.platforms.find((p) => p.hours > 0) ?? null) : stats;
  });
  protected readonly topDeveloper = computed(() => {
    const stats = this.developers();
    return stats ? (stats.topByHours[0] ?? null) : stats;
  });
  protected readonly medianDays = computed(() => {
    const median = this.completion()?.timeToFinish.medianDays;
    return median === null || median === undefined ? null : Math.round(median);
  });

  /** The mean rating and its sample, null when nothing is rated (or the load failed). */
  protected readonly ratingsTeaser = computed(() => {
    const stats = this.ratings();
    if (stats === undefined) return undefined;
    return stats && stats.mean !== null ? { mean: stats.mean, count: stats.ratedCount } : null;
  });

  protected platformName(name: string): string {
    return this.format.platform(name);
  }
}
