import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, catchError, of, switchMap, tap } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { CurrentUser, UpdateUsernameRequest } from '../models/user.model';
import { TokenStorageService } from './token-storage.service';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly baseUrl = `${API_BASE_URL}/users`;

  private readonly currentUserState = signal<CurrentUser | null>(null);

  /**
   * Current user profile, reloaded whenever the session token changes
   * (login, account switch), cleared when the token is removed (logout)
   * and replaced locally after a profile update.
   */
  readonly currentUser = this.currentUserState.asReadonly();

  readonly displayName = computed(() => {
    const user = this.currentUser();
    return user ? user.usernameDisplay || user.username : null;
  });

  constructor() {
    toObservable(this.tokenStorage.token)
      .pipe(switchMap((token) => (token ? this.me().pipe(catchError(() => of(null))) : of(null))))
      .subscribe((user) => this.currentUserState.set(user));
  }

  me(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(`${this.baseUrl}/me`);
  }

  updateUsername(request: UpdateUsernameRequest): Observable<CurrentUser> {
    return this.http
      .patch<CurrentUser>(`${this.baseUrl}/me`, request)
      .pipe(tap((user) => this.currentUserState.set(user)));
  }
}
