import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { Game, GameRequest } from '../models/game.model';
import { SteamSyncResult } from '../models/steam.model';

@Injectable({ providedIn: 'root' })
export class SteamService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/integrations/steam`;

  /**
   * XHR autenticada que emite un token de estado de un solo uso (lleva el JWT
   * vía el interceptor). El llamador usa el token para navegar de página
   * completa a /login — un window.location.href nunca manda el header
   * Authorization, por eso ese segundo paso no puede autenticarse directamente.
   */
  requestConnectToken(): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${this.baseUrl}/connect-token`, {});
  }

  buildLoginUrl(token: string): string {
    return `${this.baseUrl}/login?state=${token}`;
  }

  sync(): Observable<SteamSyncResult> {
    return this.http.post<SteamSyncResult>(`${this.baseUrl}/sync`, {});
  }

  getPending(): Observable<Game[]> {
    return this.http.get<Game[]>(`${this.baseUrl}/pending`);
  }

  confirmPending(gameId: number, request: GameRequest): Observable<Game> {
    return this.http.put<Game>(`${this.baseUrl}/pending/${gameId}/confirm`, request);
  }
}
