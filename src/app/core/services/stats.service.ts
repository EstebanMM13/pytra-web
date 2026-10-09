import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import {
  GenreStat,
  MostPlayedGame,
  SagaStat,
  StatsSummary,
  TopRatedExperience,
  YearStat,
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
