import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, catchError, of, switchMap } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { CurrentUser } from '../models/user.model';
import { TokenStorageService } from './token-storage.service';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly baseUrl = `${API_BASE_URL}/users`;

  /**
   * Current user profile, reloaded whenever the session token changes
   * (login, account switch) and cleared when the token is removed (logout).
   */
  readonly currentUser = toSignal(
    toObservable(this.tokenStorage.token).pipe(
      switchMap((token) =>
        token ? this.me().pipe(catchError(() => of(null))) : of(null),
      ),
    ),
    { initialValue: null as CurrentUser | null },
  );

  readonly displayName = computed(() => {
    const user = this.currentUser();
    return user ? user.usernameDisplay || user.username : null;
  });

  me(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(`${this.baseUrl}/me`);
  }
}
