import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, of, shareReplay, tap } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { Platform, PlatformRequest } from '../models/platform.model';
import { sortPlatforms } from './platform.logic';

/**
 * Global platform catalog, loaded once and cached (it only grows when someone adds a platform).
 * HttpClient only: never inject TranslateService here (see the auth interceptor).
 */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/platforms`;

  private readonly cache = signal<Platform[] | null>(null);
  private inFlight$: Observable<Platform[]> | null = null;

  /** Cached catalog in catalog order; null until loaded. */
  readonly platforms = this.cache.asReadonly();

  /**
   * Catalog in catalog order; served from the cache after the first successful load unless `refresh`
   * (e.g. a run references a platform added from another device since the cache was filled).
   */
  load(refresh = false): Observable<Platform[]> {
    const cached = this.cache();
    if (cached && !refresh) {
      return of(cached);
    }
    if (!this.inFlight$) {
      this.inFlight$ = this.http.get<Platform[]>(this.baseUrl).pipe(
        map(sortPlatforms),
        tap({
          next: (platforms) => this.cache.set(platforms),
          finalize: () => (this.inFlight$ = null),
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.inFlight$;
  }

  /** Create-if-missing (case-insensitive name match returns the existing entry); updates the cache. */
  create(request: PlatformRequest): Observable<Platform> {
    return this.http.post<Platform>(this.baseUrl, request).pipe(
      tap((platform) => {
        const current = this.cache();
        if (current && !current.some((p) => p.id === platform.id)) {
          this.cache.set(sortPlatforms([...current, platform]));
        }
      }),
    );
  }
}
