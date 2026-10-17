import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import { GameRequest } from '../models/game.model';
import { PsnPendingGame } from '../models/psn.model';
import { PsnService } from './psn.service';
import { TokenStorageService } from './token-storage.service';

const base = `${API_BASE_URL}/integrations/psn`;
const tokenFor = (user: string): string => `h.${btoa(JSON.stringify({ sub: user }))}.s`;
const pendingGame = (id: number, name: string) =>
  ({ id, name, titleId: `PPSA0${id}`, psnPlatform: 'PS5', psnPlaytimeMinutes: 60 }) as PsnPendingGame;

describe('PsnService', () => {
  let service: PsnService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PsnService);
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(TokenStorageService).setToken(tokenFor('ana'));
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('calls the PSN endpoints', () => {
    const request = { name: 'Astro Bot', category: 'SINGLEPLAYER' } as GameRequest;
    service.getStatus().subscribe();
    service.link('Player_1').subscribe();
    service.unlink().subscribe();
    service.sync().subscribe();
    service.confirmPending(7, request).subscribe();
    service.ignorePending(7).subscribe();
    service.getIgnored().subscribe();
    service.unignore('PPSA 01/2').subscribe();

    expect(http.expectOne({ method: 'GET', url: `${base}/status` })).toBeTruthy();
    expect(http.expectOne({ method: 'PUT', url: `${base}/link` }).request.body).toEqual({ onlineId: 'Player_1' });
    expect(http.expectOne({ method: 'DELETE', url: `${base}/link` })).toBeTruthy();
    expect(http.expectOne({ method: 'POST', url: `${base}/sync` })).toBeTruthy();
    expect(http.expectOne({ method: 'PUT', url: `${base}/pending/7/confirm` }).request.body).toEqual(request);
    expect(http.expectOne({ method: 'PUT', url: `${base}/pending/7/ignore` })).toBeTruthy();
    expect(http.expectOne({ method: 'GET', url: `${base}/ignored` })).toBeTruthy();
    expect(http.expectOne({ method: 'DELETE', url: `${base}/ignored/PPSA%2001%2F2` })).toBeTruthy();
  });

  it('serves the pending list from the cache, then revalidates it', () => {
    service.getPending().subscribe();
    http.expectOne(`${base}/pending`).flush([pendingGame(1, 'Astro Bot')]);

    const values: PsnPendingGame[][] = [];
    service.getPending().subscribe((list) => values.push(list));
    expect(values.map((list) => list.map((g) => g.name))).toEqual([['Astro Bot']]);
    http.expectOne(`${base}/pending`).flush([pendingGame(1, 'Astro Bot')]);
    expect(values).toHaveLength(1);
  });

  const writes: [string, (s: PsnService) => Observable<unknown>, string, string][] = [
    ['link', (s) => s.link('Player_1'), 'PUT', `${base}/link`],
    ['unlink', (s) => s.unlink(), 'DELETE', `${base}/link`],
    ['sync', (s) => s.sync(), 'POST', `${base}/sync`],
    ['confirm', (s) => s.confirmPending(1, {} as GameRequest), 'PUT', `${base}/pending/1/confirm`],
    ['ignore', (s) => s.ignorePending(1), 'PUT', `${base}/pending/1/ignore`],
    ['unignore', (s) => s.unignore('PPSA01'), 'DELETE', `${base}/ignored/PPSA01`],
  ];

  it.each(writes)('invalidates the cached pending list after %s', (_name, write, method, url) => {
    service.getPending().subscribe();
    http.expectOne(`${base}/pending`).flush([pendingGame(1, 'Astro Bot')]);

    write(service).subscribe({ error: () => {} });
    http.expectOne({ method, url }).flush(null);

    const values: PsnPendingGame[][] = [];
    service.getPending().subscribe((list) => values.push(list));
    // Nothing stale is emitted: the read waits for the fresh list.
    expect(values).toEqual([]);
    http.expectOne(`${base}/pending`).flush([]);
    expect(values).toEqual([[]]);
  });

  it('invalidates the cached pending list when a write fails too', () => {
    service.getPending().subscribe();
    http.expectOne(`${base}/pending`).flush([pendingGame(1, 'Astro Bot')]);

    service.sync().subscribe({ error: () => {} });
    http.expectOne(`${base}/sync`).flush({ message: 'PSN_UNAVAILABLE' }, { status: 503, statusText: 'Unavailable' });

    const values: PsnPendingGame[][] = [];
    service.getPending().subscribe((list) => values.push(list));
    expect(values).toEqual([]);
    http.expectOne(`${base}/pending`).flush([]);
  });
});
