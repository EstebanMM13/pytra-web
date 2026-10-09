import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { Game, GameRequest } from '../models/game.model';

@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/games`;

  findAll(): Observable<Game[]> {
    return this.http.get<Game[]>(this.baseUrl);
  }

  findById(id: number): Observable<Game> {
    return this.http.get<Game>(`${this.baseUrl}/${id}`);
  }

  create(request: GameRequest): Observable<Game> {
    return this.http.post<Game>(this.baseUrl, request);
  }

  update(id: number, request: GameRequest): Observable<Game> {
    return this.http.put<Game>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
