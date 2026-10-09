import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { TokenStorageService } from '../services/token-storage.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenStorage = inject(TokenStorageService);
  const router = inject(Router);
  const token = tokenStorage.getToken();

  // Public auth endpoints never need the Bearer token and must not trigger a logout.
  if (!token || !req.url.startsWith(API_BASE_URL) || req.url.startsWith(`${API_BASE_URL}/auth/`)) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })).pipe(
    catchError((error: unknown) => {
      // The backend rejected our token (expired or invalid): drop the session.
      if (error instanceof HttpErrorResponse && error.status === 401) {
        tokenStorage.clearToken();
        if (router.url !== '/login') {
          router.navigate(['/login']);
        }
      }
      return throwError(() => error);
    }),
  );
};
