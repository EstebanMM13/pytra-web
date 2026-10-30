import { Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, catchError, of, startWith, switchMap, tap } from 'rxjs';
import { Game } from '../../core/models/game.model';
import { PlayFacts } from '../../core/models/stats.model';
import { GameService } from '../../core/services/game.service';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';
import { StatsService } from '../../core/services/stats.service';

/**
 * Optional data of a stats screen as a signal: loaded at once and again when a run is saved
 * elsewhere (the "+" menu), like the stats teasers. Null until it first arrives; a failed load
 * keeps the last value (`fallback` before any), so the screen falls back to its plain visuals.
 * The failure is not reported: these are extras, as the app's other optional loads treat them
 * (no error tracking exists to send it to). Created in an injection context.
 */
export function reloadingOnSave<T>(request: () => Observable<T>, fallback: T | null): Signal<T | null> {
  const saved$ = inject(RunFormLauncher).saved$;
  let last: T | null = fallback;
  return toSignal(
    saved$.pipe(
      startWith(null),
      switchMap(() =>
        request().pipe(
          tap((value) => (last = value)),
          catchError(() => of(last)),
        ),
      ),
    ),
    { initialValue: null },
  );
}

/**
 * The library list for the stats covers (the stats endpoints send none): the cached `GET /games`
 * the dashboard and the library share, so it usually costs no request. Empty after a failed
 * first load. Created in an injection context.
 */
export function statsLibrary(): Signal<readonly Game[] | null> {
  const games = inject(GameService);
  return reloadingOnSave<readonly Game[]>(() => games.findAll(), []);
}

/** Every run's year, game and hours (`/stats/play-facts`, cached); null until loaded or after a failed first load. */
export function statsPlayFacts(): Signal<PlayFacts | null> {
  const stats = inject(StatsService);
  return reloadingOnSave(() => stats.getPlayFacts(), null);
}
