import { EMPTY, Observable, catchError, exhaustMap, filter, takeWhile, timer } from 'rxjs';
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
 * completes then, or at {@link ENRICHMENT_POLL_MAX_MS}. No request while the page is hidden, never two
 * at once, and a failed refresh is skipped (the next tick retries).
 */
export function pollWhileEnriching<S extends { enrichment?: EnrichmentProgress | null }, P>(
  refresh: () => Observable<EnrichmentSnapshot<S, P>>,
  isHidden: () => boolean,
  now: () => number = Date.now,
): Observable<EnrichmentSnapshot<S, P>> {
  const startedAt = now();
  return timer(ENRICHMENT_POLL_INTERVAL_MS, ENRICHMENT_POLL_INTERVAL_MS).pipe(
    takeWhile(() => now() - startedAt < ENRICHMENT_POLL_MAX_MS),
    filter(() => !isHidden()),
    exhaustMap(() => refresh().pipe(catchError(() => EMPTY))),
    takeWhile((snapshot) => shouldKeepPolling(snapshot.status.enrichment, now() - startedAt), true),
  );
}
