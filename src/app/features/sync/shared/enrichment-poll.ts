import { EMPTY, Observable, catchError, defer, exhaustMap, filter, takeWhile, tap, timer } from 'rxjs';
import {
  ENRICHMENT_POLL_INTERVAL_MS,
  ENRICHMENT_POLL_MAX_MS,
  EnrichmentProgress,
  shouldKeepPolling,
} from '../sync.logic';

/** One refresh while IGDB fills the pending games: the status (with the fill progress) and the list. */
export interface EnrichmentSnapshot<S, P> {
  status: S;
  pending: P[];
}

/**
 * Refreshes status and pending list every {@link ENRICHMENT_POLL_INTERVAL_MS} while the API reports the
 * IGDB fill as active. Emits each refresh (the last one is the one reporting the fill done) and
 * completes then, or after {@link ENRICHMENT_POLL_MAX_MS} of VISIBLE time: no request is sent while the
 * page is hidden and hidden time does not count, so backgrounding the app (mobile) never ends the
 * polling early. Never two requests at once; a failed refresh is skipped (the next tick retries).
 */
export function pollWhileEnriching<T extends { status: { enrichment?: EnrichmentProgress | null } }>(
  refresh: () => Observable<T>,
  isHidden: () => boolean,
): Observable<T> {
  return defer(() => {
    let visibleMs = 0;
    return timer(ENRICHMENT_POLL_INTERVAL_MS, ENRICHMENT_POLL_INTERVAL_MS).pipe(
      filter(() => !isHidden()),
      tap(() => (visibleMs += ENRICHMENT_POLL_INTERVAL_MS)),
      takeWhile(() => visibleMs <= ENRICHMENT_POLL_MAX_MS),
      exhaustMap(() => refresh().pipe(catchError(() => EMPTY))),
      takeWhile((snapshot) => shouldKeepPolling(snapshot.status.enrichment, visibleMs), true),
    );
  });
}
