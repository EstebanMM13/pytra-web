import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import {
  DatedRun,
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
import { CachedResource, UserDataCache } from './user-data-cache';

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
  private readonly years = this.cache.resource(() => this.http.get<number[]>(`${this.baseUrl}/years`));
  private readonly inProgress = this.cache.resource(() =>
    this.http.get<InProgressExperience[]>(`${this.baseUrl}/in-progress`),
  );
  private readonly datedRuns = this.cache.resource(() =>
    this.http.get<number[]>(`${this.baseUrl}/years`).pipe(
      switchMap((years) => (years.length ? forkJoin(years.map((year) => this.getYearSummary(year))) : of([]))),
      map((summaries) =>
        summaries.flatMap((summary) =>
          summary.experiences.map(({ experienceId, status, startDate, endDate }) => ({
            experienceId,
            status,
            year: summary.year,
            startDate,
            endDate,
          })),
        ),
      ),
    ),
  );
  private readonly bySaga = this.cache.resource(() => this.http.get<SagaStat[]>(`${this.baseUrl}/by-saga`));
  /** One cached resource per limit (callers use a few fixed limits: the dashboard, the run rank). */
  private readonly topRated = new Map<number, CachedResource<TopRatedExperience[]>>();
  private readonly mostPlayedSingleplayer = new Map<number, CachedResource<MostPlayedGame[]>>();
  private readonly mostPlayedOnline = new Map<number, CachedResource<MostPlayedGame[]>>();

  /** Cached (see `UserDataCache`): may emit the cached summary, then a fresher one. */
  getSummary(): Observable<StatsSummary> {
    return this.summary.get();
  }

  /** Cached (see `UserDataCache`): may emit the cached list, then a fresher one. */
  getByYear(): Observable<YearStat[]> {
    return this.byYear.get();
  }

  /** Years with data, most recent first. Cached (see `UserDataCache`). */
  getYears(): Observable<number[]> {
    return this.years.get();
  }

  getYearSummary(year: number): Observable<YearSummary> {
    return this.http.get<YearSummary>(`${this.baseUrl}/years/${year}`);
  }

  saveYearNote(year: number, request: YearNoteRequest): Observable<YearNote> {
    return this.http
      .put<YearNote>(`${this.baseUrl}/years/${year}/note`, request)
      .pipe(this.cache.invalidateOnWrite());
  }

  /**
   * Every run that counts in some year, with its status and dates, gathered from the year summaries
   * (one request per year: there is no endpoint listing every run). Runs without a year nor dates
   * are in no summary, so they are left out. Cached (see `UserDataCache`).
   */
  getDatedRuns(): Observable<DatedRun[]> {
    return this.datedRuns.get();
  }

  /** EN_CURSO runs across all games, most recently started first. Cached (see `UserDataCache`). */
  getInProgress(): Observable<InProgressExperience[]> {
    return this.inProgress.get();
  }

  /** Cached (see `UserDataCache`). */
  getBySaga(): Observable<SagaStat[]> {
    return this.bySaga.get();
  }

  getByGenre(): Observable<GenreStat[]> {
    return this.http.get<GenreStat[]>(`${this.baseUrl}/by-genre`);
  }

  /** Cached per limit (see `UserDataCache`). */
  getTopRated(limit = 5): Observable<TopRatedExperience[]> {
    return this.perLimit(this.topRated, limit, 'top-rated').get();
  }

  /** Cached per limit (see `UserDataCache`). */
  getMostPlayedSingleplayer(limit = 5): Observable<MostPlayedGame[]> {
    return this.perLimit(this.mostPlayedSingleplayer, limit, 'most-played/singleplayer').get();
  }

  /** Cached per limit (see `UserDataCache`). */
  getMostPlayedOnline(limit = 5): Observable<MostPlayedGame[]> {
    return this.perLimit(this.mostPlayedOnline, limit, 'most-played/online').get();
  }

  /** The cached resource of `path?limit=<limit>`, created on first use. */
  private perLimit<T>(resources: Map<number, CachedResource<T>>, limit: number, path: string): CachedResource<T> {
    let resource = resources.get(limit);
    if (!resource) {
      resource = this.cache.resource(() => this.http.get<T>(`${this.baseUrl}/${path}`, { params: { limit } }));
      resources.set(limit, resource);
    }
    return resource;
  }
}
