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
import { UserDataCache } from './user-data-cache';

@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/stats`;
  private readonly cache = inject(UserDataCache);
  private readonly summary = this.cache.resource(() =>
    this.http.get<StatsSummary>(`${this.baseUrl}/summary`),
  );
  private readonly byYear = this.cache.resource(() =>
    this.http.get<YearStat[]>(`${this.baseUrl}/by-year`),
  );

  /** Cached (see `UserDataCache`): may emit the cached summary, then a fresher one. */
  getSummary(): Observable<StatsSummary> {
    return this.summary.get();
  }

  /** Cached (see `UserDataCache`): may emit the cached list, then a fresher one. */
  getByYear(): Observable<YearStat[]> {
    return this.byYear.get();
  }

  /** Years with data, most recent first. */
  getYears(): Observable<number[]> {
    return this.http.get<number[]>(`${this.baseUrl}/years`);
  }

  getYearSummary(year: number): Observable<YearSummary> {
    return this.http.get<YearSummary>(`${this.baseUrl}/years/${year}`);
  }

  saveYearNote(year: number, request: YearNoteRequest): Observable<YearNote> {
    return this.http
      .put<YearNote>(`${this.baseUrl}/years/${year}/note`, request)
      .pipe(this.cache.invalidateOnWrite());
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
