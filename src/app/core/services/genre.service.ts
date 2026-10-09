import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { Genre, GenreRequest } from '../models/genre.model';

@Injectable({ providedIn: 'root' })
export class GenreService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/genres`;

  findAll(): Observable<Genre[]> {
    return this.http.get<Genre[]>(this.baseUrl);
  }

  createIfMissing(request: GenreRequest): Observable<Genre> {
    return this.http.post<Genre>(this.baseUrl, request);
  }
}
