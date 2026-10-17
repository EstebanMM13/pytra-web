import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { OnlinePlaytime, OnlinePlaytimeRequest } from '../models/online-playtime.model';
import { UserDataCache } from './user-data-cache';

@Injectable({ providedIn: 'root' })
export class OnlinePlaytimeService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(UserDataCache);

  /** 404 significa que este juego todavía no tiene horas online registradas. */
  findByGame(gameId: number): Observable<OnlinePlaytime> {
    return this.http.get<OnlinePlaytime>(`${API_BASE_URL}/games/${gameId}/online-playtime`);
  }

  upsert(gameId: number, request: OnlinePlaytimeRequest): Observable<OnlinePlaytime> {
    return this.http
      .put<OnlinePlaytime>(`${API_BASE_URL}/games/${gameId}/online-playtime`, request)
      .pipe(this.cache.invalidateOnWrite());
  }
}
