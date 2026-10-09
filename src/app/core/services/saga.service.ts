import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { Saga, SagaRequest } from '../models/saga.model';

@Injectable({ providedIn: 'root' })
export class SagaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/sagas`;

  findAll(): Observable<Saga[]> {
    return this.http.get<Saga[]>(this.baseUrl);
  }

  findById(id: number): Observable<Saga> {
    return this.http.get<Saga>(`${this.baseUrl}/${id}`);
  }

  create(request: SagaRequest): Observable<Saga> {
    return this.http.post<Saga>(this.baseUrl, request);
  }

  update(id: number, request: SagaRequest): Observable<Saga> {
    return this.http.put<Saga>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
