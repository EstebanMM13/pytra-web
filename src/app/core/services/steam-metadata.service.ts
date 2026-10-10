import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { SteamGameMetadata, SteamStoreSearchResult } from '../models/steam-metadata.model';

/** Read-only Steam store lookups, proxied by the API (the store has no CORS). */
@Injectable({ providedIn: 'root' })
export class SteamMetadataService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/metadata/steam`;

  search(query: string): Observable<SteamStoreSearchResult[]> {
    return this.http.get<SteamStoreSearchResult[]>(`${this.baseUrl}/search`, { params: { q: query } });
  }

  getDetails(appId: number): Observable<SteamGameMetadata> {
    return this.http.get<SteamGameMetadata>(`${this.baseUrl}/${appId}`);
  }
}
