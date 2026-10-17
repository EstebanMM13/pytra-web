import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '../api-base-url';
import { DEMO_READ_ONLY, DemoModeService } from '../services/demo-mode.service';
import { TokenStorageService } from '../services/token-storage.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  function setup(demo: boolean) {
    const notifyReadOnly = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: TokenStorageService, useValue: { getToken: () => 'token', clearToken: vi.fn() } },
        { provide: DemoModeService, useValue: { isDemo: signal(demo), notifyReadOnly } },
      ],
    });
    return { http: TestBed.inject(HttpClient), backend: TestBed.inject(HttpTestingController), notifyReadOnly };
  }

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('never sends a write from the demo: answers 403 DEMO_READ_ONLY and shows the toast', () => {
    const { http, backend, notifyReadOnly } = setup(true);
    for (const send of [
      () => http.post(`${API_BASE_URL}/games`, {}),
      () => http.put(`${API_BASE_URL}/games/1`, {}),
      () => http.patch(`${API_BASE_URL}/users/me`, {}),
      () => http.delete(`${API_BASE_URL}/games/1`),
      () => http.get(`${API_BASE_URL}/users/me/export`, { params: { format: 'csv' } }),
    ]) {
      let error: HttpErrorResponse | undefined;
      send().subscribe({ error: (e: HttpErrorResponse) => (error = e) });
      expect(error?.status).toBe(403);
      expect(error?.error).toEqual({ message: DEMO_READ_ONLY });
    }
    backend.expectNone(() => true);
    expect(notifyReadOnly).toHaveBeenCalledTimes(5);
  });

  it('lets the demo read', () => {
    const { http, backend, notifyReadOnly } = setup(true);
    http.get(`${API_BASE_URL}/games`).subscribe();
    backend.expectOne(`${API_BASE_URL}/games`).flush([]);
    expect(notifyReadOnly).not.toHaveBeenCalled();
  });

  it('sends writes with the token outside the demo', () => {
    const { http, backend } = setup(false);
    http.post(`${API_BASE_URL}/games`, {}).subscribe();
    const req = backend.expectOne(`${API_BASE_URL}/games`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer token');
    req.flush({});
  });
});
