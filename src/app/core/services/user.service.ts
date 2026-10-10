import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, catchError, of, switchMap, tap } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { CurrentUser, DeleteAccountRequest, ExportFormat, UpdateProfileRequest } from '../models/user.model';
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

  updateProfile(request: UpdateProfileRequest): Observable<CurrentUser> {
    return this.http
      .patch<CurrentUser>(`${this.baseUrl}/me`, request)
      .pipe(tap((user) => this.currentUserState.set(user)));
  }

  /** Full data export as a file; the filename comes in `Content-Disposition`. */
  exportData(format: ExportFormat): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.baseUrl}/me/export`, {
      params: { format },
      observe: 'response',
      responseType: 'blob',
    });
  }

  /** Permanently deletes the account and all its data (204). The caller clears the session. */
  deleteAccount(request: DeleteAccountRequest): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/me`, { body: request });
  }
}
