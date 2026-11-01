import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, defer, EMPTY, Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { UnlockedAchievement } from '../models/achievement.model';
import { Achievement, idsToRecord } from '../../shared/achievements/achievements';
import { DemoModeService } from './demo-mode.service';
import { TokenStorageService } from './token-storage.service';
import { UserDataCache } from './user-data-cache';

/**
 * Achievements the API keeps unlocked. The web still computes them from the data; the unlocks it
 * computes that are not stored yet are recorded here, so they never lock again later.
 */
@Injectable({ providedIn: 'root' })
export class AchievementService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/achievements`;
  private readonly demoMode = inject(DemoModeService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly unlocked = inject(UserDataCache).resource(() =>
    this.http.get<UnlockedAchievement[]>(this.baseUrl),
  );
  /** Ids this session already sent (pending or stored), so every load does not record them again. */
  private sent: { token: string | null; ids: Set<string> } = { token: null, ids: new Set() };

  /** Cached (see `UserDataCache`): may emit the cached list, then a fresher one. */
  getUnlocked(): Observable<UnlockedAchievement[]> {
    return this.unlocked.get();
  }

  /**
   * Records the unlocked achievements of `list` that `stored` lacks, once per session. Emits the whole
   * stored list the API answers; emits nothing when there is nothing to record, in the read-only demo,
   * or when the request fails (never breaks the page: the ids are retried on a later load).
   */
  recordNew(
    list: readonly Achievement[],
    stored: readonly UnlockedAchievement[],
  ): Observable<UnlockedAchievement[]> {
    return defer(() => {
      if (this.demoMode.isDemo()) return EMPTY;
      const sent = this.sentForSession();
      const ids = idsToRecord(list, stored).filter((id) => !sent.has(id));
      if (ids.length === 0) return EMPTY;
      ids.forEach((id) => sent.add(id));
      return this.http.post<UnlockedAchievement[]>(this.baseUrl, { ids }).pipe(
        // The stored list changed: the next screen fetches it instead of serving the old cache.
        tap(() => this.unlocked.invalidate()),
        catchError(() => {
          ids.forEach((id) => sent.delete(id));
          return EMPTY;
        }),
      );
    });
  }

  private sentForSession(): Set<string> {
    const token = this.tokenStorage.token();
    if (this.sent.token !== token) {
      this.sent = { token, ids: new Set() };
    }
    return this.sent.ids;
  }
}
