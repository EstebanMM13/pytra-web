import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, catchError, of } from 'rxjs';
import { StatsService } from '../../core/services/stats.service';
import { Navbar } from '../../shared/navbar/navbar';
import { HoursPipe } from '../../shared/pipes/hours.pipe';
import { RatingPipe } from '../../shared/pipes/rating.pipe';
import { RatingTonePipe } from '../../shared/pipes/rating-tone.pipe';
import { TranslatePluralPipe } from '../../shared/pipes/translate-plural.pipe';
import { ICONS } from '../../shared/ui/icons';
import { platformDisplayName } from '../../shared/ui/platform-label';
import { StatsHubCard } from './stats-hub-card';
import { sagaTeaser } from './stats.logic';

/** `undefined` while loading, null when the request failed. */
function load<T>(source: Observable<T>) {
  return toSignal<T | null | undefined>(source.pipe(catchError(() => of(null))), { initialValue: undefined });
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
  private readonly translate = inject(TranslateService);

  protected readonly activity = load(this.stats.getActivity());
  protected readonly byYear = load(this.stats.getByYear());
  protected readonly bySaga = load(this.stats.getBySaga());
  protected readonly platforms = load(this.stats.getByPlatform());
  protected readonly developers = load(this.stats.getByDeveloper());
  protected readonly completion = load(this.stats.getCompletion());
  protected readonly ratings = load(this.stats.getRatings());

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

  protected platformName(name: string): string {
    return platformDisplayName(name, this.translate);
  }
}
