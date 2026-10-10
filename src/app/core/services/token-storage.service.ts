import { Injectable, computed, signal } from '@angular/core';

const TOKEN_KEY = 'pytra_token';

/** JWT payload (unverified: only used for UI decisions, the API is the real guard). */
function decodePayload(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

function isExpired(token: string): boolean {
  const payload = decodePayload(token);
  if (!payload) {
    return true;
  }
  return typeof payload['exp'] === 'number' && payload['exp'] * 1000 <= Date.now();
}

function readStoredToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token && isExpired(token)) {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
  return token;
}

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  readonly token = signal<string | null>(readStoredToken());

  /** Read-only demo session (token issued by POST /auth/demo with the `demo` claim). */
  readonly isDemo = computed(() => {
    const token = this.token();
    return token !== null && decodePayload(token)?.['demo'] === true;
  });

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this.token.set(token);
  }

  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.token.set(null);
  }

  getToken(): string | null {
    return this.token();
  }
}
