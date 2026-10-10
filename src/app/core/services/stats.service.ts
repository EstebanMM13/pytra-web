import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import {
  GenreStat,
  InProgressExperience,
  MostPlayedGame,
  SagaStat,
  StatsSummary,
  TopRatedExperience,
  YearNote,
  YearNoteRequest,
  YearStat,
  YearSummary,
} from '../models/stats.model';

@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/stats`;

  getSummary(): Observable<StatsSummary> {
    return this.http.get<StatsSummary>(`${this.baseUrl}/summary`);
  }

  getByYear(): Observable<YearStat[]> {
    return this.http.get<YearStat[]>(`${this.baseUrl}/by-year`);
  }

  /** Years with data, most recent first. */
  getYears(): Observable<number[]> {
    return this.http.get<number[]>(`${this.baseUrl}/years`);
  }

  getYearSummary(year: number): Observable<YearSummary> {
    return this.http.get<YearSummary>(`${this.baseUrl}/years/${year}`);
  }

  saveYearNote(year: number, request: YearNoteRequest): Observable<YearNote> {
    return this.http.put<YearNote>(`${this.baseUrl}/years/${year}/note`, request);
  }

  /** EN_CURSO runs across all games, most recently started first. */
  getInProgress(): Observable<InProgressExperience[]> {
    return this.http.get<InProgressExperience[]>(`${this.baseUrl}/in-progress`);
  }

  getBySaga(): Observable<SagaStat[]> {
    return this.http.get<SagaStat[]>(`${this.baseUrl}/by-saga`);
  }

  getByGenre(): Observable<GenreStat[]> {
    return this.http.get<GenreStat[]>(`${this.baseUrl}/by-genre`);
  }

  getTopRated(limit = 5): Observable<TopRatedExperience[]> {
    return this.http.get<TopRatedExperience[]>(`${this.baseUrl}/top-rated`, {
      params: { limit },
    });
  }

  getMostPlayedSingleplayer(limit = 5): Observable<MostPlayedGame[]> {
    return this.http.get<MostPlayedGame[]>(`${this.baseUrl}/most-played/singleplayer`, {
      params: { limit },
    });
  }

  getMostPlayedOnline(limit = 5): Observable<MostPlayedGame[]> {
    return this.http.get<MostPlayedGame[]>(`${this.baseUrl}/most-played/online`, {
      params: { limit },
    });
  }
}
