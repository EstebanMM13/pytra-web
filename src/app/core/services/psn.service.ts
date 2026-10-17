import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { Game, GameRequest } from '../models/game.model';
import { PsnIgnoredTitle, PsnPendingGame, PsnStatus, PsnSyncResult } from '../models/psn.model';
import { UserDataCache } from './user-data-cache';

/** PlayStation Network integration: link by online ID, sync, pending review and ignored titles. */
@Injectable({ providedIn: 'root' })
export class PsnService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/integrations/psn`;
  private readonly cache = inject(UserDataCache);
  private readonly pending = this.cache.resource(() =>
    this.http.get<PsnPendingGame[]>(`${this.baseUrl}/pending`),
  );

  getStatus(): Observable<PsnStatus> {
    return this.http.get<PsnStatus>(`${this.baseUrl}/status`);
  }

  /** Links (or re-links) the PSN account by its public online ID; answers the new status. */
  link(onlineId: string): Observable<PsnStatus> {
    return this.http
      .put<PsnStatus>(`${this.baseUrl}/link`, { onlineId })
      .pipe(this.cache.invalidateOnWrite());
  }

  unlink(): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/link`).pipe(this.cache.invalidateOnWrite());
  }

  sync(): Observable<PsnSyncResult> {
    return this.http
      .post<PsnSyncResult>(`${this.baseUrl}/sync`, {})
      .pipe(this.cache.invalidateOnWrite());
  }

  /** Cached (see `UserDataCache`): may emit the cached list, then a fresher one. */
  getPending(): Observable<PsnPendingGame[]> {
    return this.pending.get();
  }

  confirmPending(gameId: number, request: GameRequest): Observable<Game> {
    return this.http
      .put<Game>(`${this.baseUrl}/pending/${gameId}/confirm`, request)
      .pipe(this.cache.invalidateOnWrite());
  }

  ignorePending(gameId: number): Observable<void> {
    return this.http
      .put<void>(`${this.baseUrl}/pending/${gameId}/ignore`, {})
      .pipe(this.cache.invalidateOnWrite());
  }

  getIgnored(): Observable<PsnIgnoredTitle[]> {
    return this.http.get<PsnIgnoredTitle[]>(`${this.baseUrl}/ignored`);
  }

  unignore(titleId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/ignored/${encodeURIComponent(titleId)}`)
      .pipe(this.cache.invalidateOnWrite());
  }
}
