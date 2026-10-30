import { Signal, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, catchError, combineLatest, map, merge, of, startWith, switchMap } from 'rxjs';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';
import { StatsService } from '../../core/services/stats.service';
import { parseYearParam } from '../years/years.logic';
import { statsFormat } from './stats-format';

/** What a section shows for the viewed year: `data` null with `failed` false while loading. */
export interface SectionState<T> {
  year: number | null;
  data: T | null;
  failed: boolean;
}

/**
 * Shared wiring of the stats sections, created in a component's injection context: the period in
 * the `?year=` query param (absent: all time, or the API default) and its label, the years to pick
 * from, and the section data reloaded on year changes, retries and runs saved elsewhere.
 */
export function statsSection<T>(load: (year: number | null) => Observable<T>) {
  const route = inject(ActivatedRoute);
  const router = inject(Router);
  const stats = inject(StatsService);
  const saved$ = inject(RunFormLauncher).saved$;
  const retry$ = new Subject<void>();
  const format = statsFormat();

  const year: Signal<number | null> = toSignal(
    route.queryParamMap.pipe(map((params) => parseYearParam(params.get('year')))),
    { initialValue: parseYearParam(route.snapshot.queryParamMap.get('year')) },
  );
  const years = toSignal(stats.getYears().pipe(catchError(() => of([] as number[]))), {
    initialValue: [] as number[],
  });
  const state = toSignal(
    combineLatest([toObservable(year), merge(retry$, saved$).pipe(startWith(null))]).pipe(
      switchMap(([y]) =>
        load(y).pipe(
          map((data): SectionState<T> => ({ year: y, data, failed: false })),
          catchError(() => of<SectionState<T>>({ year: y, data: null, failed: true })),
        ),
      ),
    ),
    { initialValue: null },
  );
  // A reload keeps showing the previous data until the new one arrives; a year change shows the
  // loading state instead of the other year's figures.
  const current = computed<SectionState<T>>(() => {
    const last = state();
    return last && last.year === year() ? last : { year: year(), data: null, failed: false };
  });

  return {
    year,
    /** The period on screen, for the header eyebrow: the year, or "all time". */
    scopeLabel: computed(() => {
      const y = year();
      return y !== null ? String(y) : format.text('stats.allTime');
    }),
    years,
    state: current,
    /** Changes the period in the URL (replacing the entry: the back button leaves the section). */
    setYear(next: number | null): void {
      void router.navigate([], {
        relativeTo: route,
        queryParams: { year: next },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    },
    retry(): void {
      retry$.next();
    },
  };
}
