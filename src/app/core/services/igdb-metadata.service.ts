import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, shareReplay } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { IgdbGameMetadata, IgdbSearchResult, MetadataProviders } from '../models/igdb-metadata.model';

/** Read-only IGDB lookups, proxied by the API (it holds the Twitch credentials). */
@Injectable({ providedIn: 'root' })
export class IgdbMetadataService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/metadata`;
  private providers$: Observable<MetadataProviders> | null = null;

  /**
   * Which autofill sources the API offers. Asked once per session; a failed check is not cached and
   * reports IGDB as unavailable (Steam still works), so the form never offers a source that 404s.
   */
  providers(): Observable<MetadataProviders> {
    this.providers$ ??= this.http.get<MetadataProviders>(`${this.baseUrl}/providers`).pipe(
      catchError(() => {
        this.providers$ = null;
        return of<MetadataProviders>({ igdb: false, steam: true });
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.providers$;
  }

  search(query: string): Observable<IgdbSearchResult[]> {
    return this.http.get<IgdbSearchResult[]>(`${this.baseUrl}/igdb/search`, { params: { q: query } });
  }

  getDetails(igdbId: number): Observable<IgdbGameMetadata> {
    return this.http.get<IgdbGameMetadata>(`${this.baseUrl}/igdb/${igdbId}`);
  }
}
