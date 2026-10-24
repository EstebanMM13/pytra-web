import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { AccessToken, CreatedAccessToken } from '../models/access-token.model';

/** Personal access tokens of the current user: read-only credentials for the Obsidian sync plugin. */
@Injectable({ providedIn: 'root' })
export class AccessTokenService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/users/me/tokens`;

  list(): Observable<AccessToken[]> {
    return this.http.get<AccessToken[]>(this.baseUrl);
  }

  create(name: string): Observable<CreatedAccessToken> {
    return this.http.post<CreatedAccessToken>(this.baseUrl, { name });
  }

  revoke(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
