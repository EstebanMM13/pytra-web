import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { Experience, ExperiencePatch, ExperienceRequest } from '../models/experience.model';
import { UserDataCache } from './user-data-cache';

@Injectable({ providedIn: 'root' })
export class ExperienceService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(UserDataCache);

  findAllByGame(gameId: number): Observable<Experience[]> {
    return this.http.get<Experience[]>(`${API_BASE_URL}/games/${gameId}/experiences`);
  }

  findById(id: number): Observable<Experience> {
    return this.http.get<Experience>(`${API_BASE_URL}/experiences/${id}`);
  }

  create(gameId: number, request: ExperienceRequest): Observable<Experience> {
    return this.http
      .post<Experience>(`${API_BASE_URL}/games/${gameId}/experiences`, request)
      .pipe(this.cache.invalidateOnWrite());
  }

  update(id: number, request: ExperienceRequest): Observable<Experience> {
    return this.http
      .put<Experience>(`${API_BASE_URL}/experiences/${id}`, request)
      .pipe(this.cache.invalidateOnWrite());
  }

  /** Changes only the sent figures (hours, rating) of a run. */
  patch(id: number, patch: ExperiencePatch): Observable<Experience> {
    return this.http
      .patch<Experience>(`${API_BASE_URL}/experiences/${id}`, patch)
      .pipe(this.cache.invalidateOnWrite());
  }

  delete(id: number): Observable<void> {
    return this.http
      .delete<void>(`${API_BASE_URL}/experiences/${id}`)
      .pipe(this.cache.invalidateOnWrite());
  }
}
