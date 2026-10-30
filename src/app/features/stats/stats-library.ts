import { Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, startWith, switchMap, tap } from 'rxjs';
import { Game } from '../../core/models/game.model';
import { GameService } from '../../core/services/game.service';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';

/**
 * The library list for the stats covers (the stats endpoints send none): the cached `GET /games`
 * the dashboard and the library share, so it usually costs no request. Reloaded when a run is
 * saved elsewhere (the "+" menu), like the stats teasers. Null until it first arrives; a failed
 * load keeps the last list (empty before any), and the screens fall back to their plain visuals.
 * The failure is not reported: covers are decoration, as the app's other optional loads treat
 * them (no error tracking exists to send it to). Created in an injection context.
 */
export function statsLibrary(): Signal<readonly Game[] | null> {
  const games = inject(GameService);
  const saved$ = inject(RunFormLauncher).saved$;
  let last: readonly Game[] = [];
  return toSignal(
    saved$.pipe(
      startWith(null),
      switchMap(() =>
        games.findAll().pipe(
          tap((list) => (last = list)),
          catchError(() => of(last)),
        ),
      ),
    ),
    { initialValue: null },
  );
}
