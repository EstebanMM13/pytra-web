import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, output } from '@angular/core';
import { Segmented, SegmentedOption } from '../../shared/ui/segmented';
import { YearSelector } from '../years/year-selector';
import { yearTabs } from '../years/years.logic';

type ScopeMode = 'all' | 'year';

const SCOPE_OPTIONS: readonly SegmentedOption<ScopeMode>[] = [
  { value: 'all', label: 'stats.scope.all' },
  { value: 'year', label: 'stats.scope.year' },
];

/**
 * Period picker of a stats section: "All time | By year" and, by year, the "‹ 2026 ›" selector.
 * `year` null means all time; without `allowAll` only the year selector shows.
 */
@Component({
  selector: 'app-stats-scope',
  imports: [Segmented, YearSelector],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-2 sm:w-64' },
  template: `
    @if (allowAll()) {
      <app-segmented stretch [options]="options" [value]="mode()" (valueChange)="setMode($event)" data-scope-mode />
    }
    @if (year() !== null) {
      <app-year-selector [years]="tabs()" [year]="year()" (yearChange)="yearChange.emit($event)" />
    }
  `,
})
export class StatsScope {
  protected readonly options = SCOPE_OPTIONS;

  /** Years with data, most recent first. */
  readonly years = input.required<readonly number[]>();
  readonly year = input.required<number | null>();
  readonly allowAll = input(true, { transform: booleanAttribute });
  readonly yearChange = output<number | null>();

  protected readonly mode = computed<ScopeMode>(() => (this.year() === null ? 'all' : 'year'));
  protected readonly tabs = computed(() => yearTabs(this.years(), this.year()));

  protected setMode(mode: ScopeMode): void {
    if (mode === this.mode()) return;
    this.yearChange.emit(mode === 'all' ? null : (this.years()[0] ?? new Date().getFullYear()));
  }
}
