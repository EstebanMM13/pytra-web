import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import {
  ActivityStats,
  CompletionStats,
  DeveloperStats,
  GenreStat,
  InProgressExperience,
  MostPlayedGame,
  PlatformStats,
  RatingStats,
  ReleaseEraStats,
  SagaStat,
  StatsSummary,
  TopRatedExperience,
  YearNote,
  YearNoteRequest,
  YearStat,
  YearSummary,
} from '../models/stats.model';
import { CachedResource, UserDataCache } from './user-data-cache';

type YearKey = number | 'all';

/**
 * Developer ranking request shared by the stats hub teaser and the studios section, so both read
 * the same cached entry.
 */
export const DEVELOPER_RANKING_LIMIT = 10;
export const DEVELOPER_MIN_RATED_GAMES = 2;

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
  private readonly bySaga = this.cache.resource(() => this.http.get<SagaStat[]>(`${this.baseUrl}/by-saga`));
  /** One cached resource per limit (callers use a few fixed limits: the dashboard, the run rank). */
  private readonly topRated = new Map<number, CachedResource<TopRatedExperience[]>>();
  private readonly mostPlayedSingleplayer = new Map<number, CachedResource<MostPlayedGame[]>>();
  private readonly mostPlayedOnline = new Map<number, CachedResource<MostPlayedGame[]>>();
  /** Per-year resources of the stats hub sections; the key `all` is the request without a year. */
  private readonly activity = new Map<YearKey, CachedResource<ActivityStats>>();
  private readonly byPlatform = new Map<YearKey, CachedResource<PlatformStats>>();
  private readonly completion = new Map<YearKey, CachedResource<CompletionStats>>();
  private readonly ratings = new Map<YearKey, CachedResource<RatingStats>>();
  private readonly byDeveloper = new Map<string, CachedResource<DeveloperStats>>();
  private readonly byReleaseEra = this.cache.resource(() =>
    this.http.get<ReleaseEraStats>(`${this.baseUrl}/by-release-era`),
  );

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

  /**
   * Diary activity of a year (null: the current year, as the API defaults). Streaks are all-time
   * whatever the year. Cached per year (see `UserDataCache`).
   */
  getActivity(year: number | null = null): Observable<ActivityStats> {
    return this.perYear(this.activity, year, 'activity').get();
  }

  /** Hours, runs and ratings per platform of a year (null: all time). Cached per year. */
  getByPlatform(year: number | null = null): Observable<PlatformStats> {
    return this.perYear(this.byPlatform, year, 'by-platform').get();
  }

  /** Top developers by hours and by rating (all time). Cached per parameters. */
  getByDeveloper(limit = DEVELOPER_RANKING_LIMIT, minRatedGames = DEVELOPER_MIN_RATED_GAMES): Observable<DeveloperStats> {
    const key = `${limit}:${minRatedGames}`;
    let resource = this.byDeveloper.get(key);
    if (!resource) {
      resource = this.cache.resource(() =>
        this.http.get<DeveloperStats>(`${this.baseUrl}/by-developer`, { params: { limit, minRatedGames } }),
      );
      this.byDeveloper.set(key, resource);
    }
    return resource.get();
  }

  /** Games per release decade and year (all time). Cached (see `UserDataCache`). */
  getByReleaseEra(): Observable<ReleaseEraStats> {
    return this.byReleaseEra.get();
  }

  /** Completion habits of a year (null: all time). Cached per year. */
  getCompletion(year: number | null = null): Observable<CompletionStats> {
    return this.perYear(this.completion, year, 'completion').get();
  }

  /** Rating distribution of a year (null: all time). Cached per year. */
  getRatings(year: number | null = null): Observable<RatingStats> {
    return this.perYear(this.ratings, year, 'ratings').get();
  }

  /** The cached resource of `path?year=<year>` (no param for null), created on first use. */
  private perYear<T>(resources: Map<YearKey, CachedResource<T>>, year: number | null, path: string): CachedResource<T> {
    const key: YearKey = year ?? 'all';
    let resource = resources.get(key);
    if (!resource) {
      const options = year === null ? {} : { params: { year } };
      resource = this.cache.resource(() => this.http.get<T>(`${this.baseUrl}/${path}`, options));
      resources.set(key, resource);
    }
    return resource;
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
