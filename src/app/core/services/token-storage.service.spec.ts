import { TestBed } from '@angular/core/testing';
import { TokenStorageService } from './token-storage.service';

/** Unsigned JWT-shaped token with the given payload (only the payload is read client-side). */
function fakeToken(payload: Record<string, unknown>): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '');
  return `${encode({ alg: 'HS256' })}.${encode(payload)}.signature`;
}

const inOneHour = () => Math.floor(Date.now() / 1000) + 3600;

describe('TokenStorageService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('flags a demo token and clears the flag when a normal login replaces it', () => {
    const storage = TestBed.inject(TokenStorageService);
    expect(storage.isDemo()).toBe(false);

    storage.setToken(fakeToken({ sub: 'demo', demo: true, exp: inOneHour() }));
    expect(storage.isDemo()).toBe(true);

    storage.setToken(fakeToken({ sub: 'alice', exp: inOneHour() }));
    expect(storage.isDemo()).toBe(false);

    storage.setToken(fakeToken({ sub: 'demo', demo: true, exp: inOneHour() }));
    storage.clearToken();
    expect(storage.isDemo()).toBe(false);
  });

  it('only treats a literal true claim as demo', () => {
    const storage = TestBed.inject(TokenStorageService);
    storage.setToken(fakeToken({ sub: 'x', demo: 'true', exp: inOneHour() }));
    expect(storage.isDemo()).toBe(false);
  });
});
