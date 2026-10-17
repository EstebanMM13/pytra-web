import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { Saga, SagaRequest } from '../models/saga.model';
import { UserDataCache } from './user-data-cache';

@Injectable({ providedIn: 'root' })
export class SagaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/sagas`;
  private readonly cache = inject(UserDataCache);
  private readonly all = this.cache.resource(() => this.http.get<Saga[]>(this.baseUrl));

  /** Cached (see `UserDataCache`): may emit the cached list, then a fresher one. */
  findAll(): Observable<Saga[]> {
    return this.all.get();
  }

  findById(id: number): Observable<Saga> {
    return this.http.get<Saga>(`${this.baseUrl}/${id}`);
  }

  create(request: SagaRequest): Observable<Saga> {
    return this.http.post<Saga>(this.baseUrl, request).pipe(this.cache.invalidateOnWrite());
  }

  update(id: number, request: SagaRequest): Observable<Saga> {
    return this.http
      .put<Saga>(`${this.baseUrl}/${id}`, request)
      .pipe(this.cache.invalidateOnWrite());
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(this.cache.invalidateOnWrite());
  }
}
