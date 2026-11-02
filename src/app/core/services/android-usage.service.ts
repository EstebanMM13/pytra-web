import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { UserDataCache } from './user-data-cache';
import { DailyUsage } from './usage-stats.service';

/** An installed Android app linked to a game of the library. */
export interface AndroidLink {
  packageName: string;
  gameId: number;
}

/** Outcome of one usage sync: items that added play, and items that did not. */
export interface AndroidUsageSyncResult {
  recorded: number;
  ignored: number;
}

/** Outcome of a reset: links restarted and minutes taken back from the games. */
export interface AndroidUsageResetResult {
  links: number;
  minutesRemoved: number;
}

/** Android play time sync API: app links and the daily usage upload. */
@Injectable({ providedIn: 'root' })
export class AndroidUsageService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(UserDataCache);
  private readonly linksUrl = `${API_BASE_URL}/android-links`;

  getLinks(): Observable<AndroidLink[]> {
    return this.http.get<AndroidLink[]>(this.linksUrl);
  }

  link(packageName: string, gameId: number): Observable<AndroidLink> {
    return this.http.post<AndroidLink>(this.linksUrl, { packageName, gameId });
  }

  unlink(packageName: string): Observable<void> {
    return this.http.delete<void>(`${this.linksUrl}/${encodeURIComponent(packageName)}`);
  }

  /** Takes back every hour and diary minute Android added; the next sync imports the days again. */
  reset(): Observable<AndroidUsageResetResult> {
    return this.http
      .post<AndroidUsageResetResult>(`${API_BASE_URL}/android-usage/reset`, {})
      .pipe(this.cache.invalidateOnWrite());
  }

  /** Uploads the daily totals; new play changes runs, online hours and the diary, so caches are dropped. */
  sync(days: DailyUsage[]): Observable<AndroidUsageSyncResult> {
    return this.http
      .post<AndroidUsageSyncResult>(`${API_BASE_URL}/android-usage/sync`, days)
      .pipe(this.cache.invalidateOnWrite());
  }
}
