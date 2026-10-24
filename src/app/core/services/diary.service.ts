import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { DiaryDay, DiaryDayRequest, GameDiaryDay } from '../models/diary.model';
import { UserDataCache } from './user-data-cache';

/** The play diary. Saving or deleting a day changes run / online hours, so writes invalidate the cache. */
@Injectable({ providedIn: 'root' })
export class DiaryService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(UserDataCache);

  /** Days with entries between `from` and `to` (both included, `yyyy-mm-dd`), oldest first. */
  findRange(from: string, to: string): Observable<DiaryDay[]> {
    return this.http.get<DiaryDay[]>(`${API_BASE_URL}/diary`, { params: { from, to } });
  }

  /** 404 means the day has no entry yet. */
  findDay(date: string): Observable<DiaryDay> {
    return this.http.get<DiaryDay>(`${API_BASE_URL}/diary/${date}`);
  }

  /** Replaces the whole day; answers null (204) when the day was left empty and got deleted. */
  saveDay(date: string, request: DiaryDayRequest): Observable<DiaryDay | null> {
    return this.http
      .put<DiaryDay | null>(`${API_BASE_URL}/diary/${date}`, request)
      .pipe(this.cache.invalidateOnWrite());
  }

  deleteDay(date: string): Observable<void> {
    return this.http
      .delete<void>(`${API_BASE_URL}/diary/${date}`)
      .pipe(this.cache.invalidateOnWrite());
  }

  /** The days one game was played, latest first. */
  findByGame(gameId: number): Observable<GameDiaryDay[]> {
    return this.http.get<GameDiaryDay[]>(`${API_BASE_URL}/games/${gameId}/diary`);
  }
}
