import { Injectable, signal } from '@angular/core';

const TOKEN_KEY = 'pytra_token';

function isExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
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
