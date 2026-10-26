import { Injectable, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  EMPTY,
  MonoTypeOperatorFunction,
  Observable,
  catchError,
  concat,
  defer,
  filter,
  finalize,
  of,
  shareReplay,
  tap,
} from 'rxjs';
import { TokenStorageService } from './token-storage.service';

/**
 * One cached GET of the signed-in user's data, with stale-while-revalidate reads:
 * - no cached value: the request result (concurrent reads share one request);
 * - cached value: emits it synchronously, then refreshes in the background and emits the fresh
 *   value only if it differs. A failed background refresh keeps the cached value silently.
 * Values are tagged with the session token they were fetched with and never served to another
 * session (logout, login as someone else, demo switch). Created through `UserDataCache.resource`.
 */
export class CachedResource<T> {
  private entry: { token: string | null; value: T } | null = null;
  private inFlight: { token: string | null; request$: Observable<T> } | null = null;
  /** Bumped on invalidation so a request started before a mutation never fills the cache. */
  private generation = 0;
  /** Last value fetched, kept through invalidation (unlike `entry`) until a fresher one lands. */
  private readonly lastFetched = signal<{ token: string | null; value: T } | null>(null, {
    equal: (a, b) => a?.token === b?.token && sameData(a?.value, b?.value),
  });
  private readonly invalidations = signal(0);

  /**
   * The current session's last fetched value, reactive and without any request: still the old
   * value right after an invalidation, until the reload answers. Null before the first fetch.
   */
  readonly latest: Signal<T | null> = computed(() => {
    const last = this.lastFetched();
    return last && last.token === this.currentToken() ? last.value : null;
  });

  /** Number of invalidations so far (the data changed on the server); reactive. */
  readonly invalidationCount: Signal<number> = this.invalidations.asReadonly();

  constructor(
    private readonly fetcher: () => Observable<T>,
    private readonly currentToken: () => string | null,
  ) {}

  get(): Observable<T> {
    return defer(() => {
      const token = this.currentToken();
      const cached = this.entry?.token === token ? this.entry : null;
      if (!cached) {
        return this.fetch(token);
      }
      const stale = cached.value;
      const generation = this.generation;
      return concat(
        of(stale),
        this.fetch(token).pipe(
          // A refresh that started before a write must not overwrite what the reload after it shows.
          filter((fresh) => generation === this.generation && !sameData(fresh, stale)),
          catchError(() => EMPTY),
        ),
      );
    });
  }

  /**
   * The current session's cached value, without any request; null when nothing is cached. For
   * seeding a screen from data another one already loaded (then refresh it the usual way).
   */
  peek(): T | null {
    const token = this.currentToken();
    return this.entry?.token === token ? this.entry.value : null;
  }

  /** Drops the cached value and any in-flight request (the data changed on the server). */
  invalidate(): void {
    this.generation++;
    this.entry = null;
    this.inFlight = null;
    this.invalidations.update((count) => count + 1);
  }

  /** Forgets data fetched by a session other than the current one. */
  pruneOtherSessions(): void {
    const token = this.currentToken();
    if (this.entry && this.entry.token !== token) {
      this.entry = null;
    }
    if (untracked(this.lastFetched)?.token !== token) {
      this.lastFetched.set(null);
    }
    if (this.inFlight && this.inFlight.token !== token) {
      this.invalidate();
    }
  }

  private fetch(token: string | null): Observable<T> {
    if (this.inFlight?.token !== token) {
      const generation = this.generation;
      const request$: Observable<T> = this.fetcher().pipe(
        tap((value) => {
          if (generation === this.generation && token === this.currentToken()) {
            this.entry = { token, value };
            this.lastFetched.set({ token, value });
          }
        }),
        finalize(() => {
          if (this.inFlight?.request$ === request$) {
            this.inFlight = null;
          }
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.inFlight = { token, request$ };
    }
    return this.inFlight!.request$;
  }
}

/** Cheap structural equality for JSON API payloads (skips re-rendering identical refreshes). */
function sameData(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Client cache of the per-user lists and stats several screens share (games, sagas, stats summary
 * and by-year, Steam and PSN pending), so revisits render instantly. Every mutation of user data
 * invalidates all of it (`invalidateAll` / `invalidateOnWrite`): the payloads are small and most
 * writes touch several of them (a run changes game totals, saga totals and the stats).
 */
@Injectable({ providedIn: 'root' })
export class UserDataCache {
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly resources: CachedResource<unknown>[] = [];

  constructor() {
    // Reads already ignore other sessions' data; this frees it as soon as the session changes.
    effect(() => {
      this.tokenStorage.token();
      untracked(() => this.resources.forEach((resource) => resource.pruneOtherSessions()));
    });
  }

  resource<T>(fetcher: () => Observable<T>): CachedResource<T> {
    const resource = new CachedResource(fetcher, () => this.tokenStorage.token());
    this.resources.push(resource as CachedResource<unknown>);
    return resource;
  }

  invalidateAll(): void {
    this.resources.forEach((resource) => resource.invalidate());
  }

  /**
   * For writes: invalidates the cache when the write answers (success or failure, a failed write
   * may have been partially applied), before the caller's own handlers run and reload.
   */
  invalidateOnWrite<T>(): MonoTypeOperatorFunction<T> {
    return tap({ next: () => this.invalidateAll(), error: () => this.invalidateAll() });
  }
}
