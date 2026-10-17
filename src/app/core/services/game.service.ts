import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { Game, GameRequest } from '../models/game.model';
import { UserDataCache } from './user-data-cache';

@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/games`;
  private readonly cache = inject(UserDataCache);
  private readonly all = this.cache.resource(() => this.http.get<Game[]>(this.baseUrl));

  /** Whole library; cached (see `UserDataCache`): may emit the cached list, then a fresher one. */
  findAll(): Observable<Game[]> {
    return this.all.get();
  }

  findById(id: number): Observable<Game> {
    return this.http.get<Game>(`${this.baseUrl}/${id}`);
  }

  create(request: GameRequest): Observable<Game> {
    return this.http.post<Game>(this.baseUrl, request).pipe(this.cache.invalidateOnWrite());
  }

  update(id: number, request: GameRequest): Observable<Game> {
    return this.http
      .put<Game>(`${this.baseUrl}/${id}`, request)
      .pipe(this.cache.invalidateOnWrite());
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(this.cache.invalidateOnWrite());
  }
}
