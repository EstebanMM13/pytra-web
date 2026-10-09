import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { Experience, ExperienceRequest } from '../models/experience.model';

@Injectable({ providedIn: 'root' })
export class ExperienceService {
  private readonly http = inject(HttpClient);

  findAllByGame(gameId: number): Observable<Experience[]> {
    return this.http.get<Experience[]>(`${API_BASE_URL}/games/${gameId}/experiences`);
  }

  findById(id: number): Observable<Experience> {
    return this.http.get<Experience>(`${API_BASE_URL}/experiences/${id}`);
  }

  create(gameId: number, request: ExperienceRequest): Observable<Experience> {
    return this.http.post<Experience>(`${API_BASE_URL}/games/${gameId}/experiences`, request);
  }

  update(id: number, request: ExperienceRequest): Observable<Experience> {
    return this.http.put<Experience>(`${API_BASE_URL}/experiences/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/experiences/${id}`);
  }
}
