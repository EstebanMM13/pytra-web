import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import {
  ExchangeCodeTokenRequest,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  ResendVerificationRequest,
  ResetPasswordRequest,
} from '../models/auth.model';
import { clearPostLoginRedirect } from '../../shared/utils/post-login-redirect';
import { TokenStorageService } from './token-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenStorage = inject(TokenStorageService);

  readonly isAuthenticated = computed(() => this.tokenStorage.token() !== null);
  /** True while browsing the public read-only demo account. */
  readonly isDemo = this.tokenStorage.isDemo;

  register(request: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${API_BASE_URL}/auth/register`, request);
  }

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${API_BASE_URL}/auth/login`, request)
      .pipe(tap((response) => this.tokenStorage.setToken(response.token)));
  }

  verifyEmail(token: string): Observable<void> {
    return this.http.get<void>(`${API_BASE_URL}/auth/verify-email`, { params: { token } });
  }

  resendVerification(request: ResendVerificationRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${API_BASE_URL}/auth/resend-verification`, request);
  }

  forgotPassword(request: ForgotPasswordRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${API_BASE_URL}/auth/forgot-password`, request);
  }

  resetPassword(request: ResetPasswordRequest): Observable<void> {
    return this.http.post<void>(`${API_BASE_URL}/auth/reset-password`, request);
  }

  exchangeCode(request: ExchangeCodeTokenRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${API_BASE_URL}/auth/exchange-code`, request)
      .pipe(tap((response) => this.tokenStorage.setToken(response.token)));
  }

  /** Read-only session on the demo account; 404 when the demo is disabled on the server. */
  demoLogin(): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${API_BASE_URL}/auth/demo`, {})
      .pipe(tap((response) => this.tokenStorage.setToken(response.token)));
  }

  logout(): void {
    clearPostLoginRedirect();
    this.tokenStorage.clearToken();
  }
}
