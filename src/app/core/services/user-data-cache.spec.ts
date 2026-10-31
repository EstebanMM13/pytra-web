import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../api-base-url';
import { Game, GameRequest } from '../models/game.model';
import { AuthService } from './auth.service';
import { ExperienceService } from './experience.service';
import { GameService } from './game.service';
import { StatsService } from './stats.service';
import { TokenStorageService } from './token-storage.service';
import { UserDataCache } from './user-data-cache';

const gamesUrl = `${API_BASE_URL}/games`;

const tokenFor = (user: string): string => `h.${btoa(JSON.stringify({ sub: user }))}.s`;
const games = (...names: string[]): Game[] => names.map((name, i) => ({ id: i + 1, name }) as Game);

describe('UserDataCache (through the cached services)', () => {
  let gameService: GameService;
  let tokens: TokenStorageService;
  let http: HttpTestingController;

  /** Subscribes and returns every value the read emits. */
  function read(): Game[][] {
    const values: Game[][] = [];
    gameService.findAll().subscribe((value) => values.push(value));
    return values;
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    gameService = TestBed.inject(GameService);
    tokens = TestBed.inject(TokenStorageService);
    http = TestBed.inject(HttpTestingController);
    tokens.setToken(tokenFor('ana'));
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('serves the cached list at once on a revisit and refreshes it in the background', () => {
    read();
    http.expectOne(gamesUrl).flush(games('Hades'));

    const revisit = read();
    expect(revisit).toEqual([games('Hades')]);
    http.expectOne(gamesUrl).flush(games('Hades', 'Celeste'));
    expect(revisit).toEqual([games('Hades'), games('Hades', 'Celeste')]);
  });

  it('does not re-emit a background refresh identical to the cached value', () => {
    read();
    http.expectOne(gamesUrl).flush(games('Hades'));

    const revisit = read();
    http.expectOne(gamesUrl).flush(games('Hades'));
    expect(revisit).toEqual([games('Hades')]);
  });

  it('keeps the cached value when the background refresh fails', () => {
    read();
    http.expectOne(gamesUrl).flush(games('Hades'));

    const errors: unknown[] = [];
    const values: Game[][] = [];
    gameService.findAll().subscribe({ next: (v) => values.push(v), error: (e) => errors.push(e) });
    http.expectOne(gamesUrl).flush('boom', { status: 500, statusText: 'Server Error' });
    expect(values).toEqual([games('Hades')]);
    expect(errors).toEqual([]);
    expect(read()).toEqual([games('Hades')]);
    http.expectOne(gamesUrl).flush(games('Hades'));
  });

  it('propagates the error when there is nothing cached', () => {
    const errors: unknown[] = [];
    gameService.findAll().subscribe({ error: (e) => errors.push(e) });
    http.expectOne(gamesUrl).flush('boom', { status: 500, statusText: 'Server Error' });
    expect(errors.length).toBe(1);
  });

  it('shares one request between concurrent reads', () => {
    const first = read();
    const second = read();
    http.expectOne(gamesUrl).flush(games('Hades'));
    expect(first).toEqual([games('Hades')]);
    expect(second).toEqual([games('Hades')]);
  });

  it('drops the cache on a write so the next read waits for fresh data', () => {
    read();
    http.expectOne(gamesUrl).flush(games('Hades'));

    gameService.create({ name: 'Celeste' } as GameRequest).subscribe();
    http.expectOne({ method: 'POST', url: gamesUrl }).flush(games('Celeste')[0]);

    const afterWrite = read();
    expect(afterWrite).toEqual([]);
    http.expectOne(gamesUrl).flush(games('Hades', 'Celeste'));
    expect(afterWrite).toEqual([games('Hades', 'Celeste')]);
  });

  it('never caches a response requested before a write', () => {
    read();
    const stale = http.expectOne(gamesUrl);

    TestBed.inject(ExperienceService).delete(7).subscribe();
    http.expectOne({ method: 'DELETE', url: `${API_BASE_URL}/experiences/7` }).flush(null);
    stale.flush(games('Hades'));

    read();
    http.expectOne(gamesUrl).flush(games('Hades'));
  });

  it('drops a background refresh that started before a write', () => {
    read();
    http.expectOne(gamesUrl).flush(games('Hades'));

    const revisit = read();
    const refresh = http.expectOne(gamesUrl);
    gameService.create({ name: 'Celeste' } as GameRequest).subscribe();
    http.expectOne({ method: 'POST', url: gamesUrl }).flush(games('Celeste')[0]);
    refresh.flush(games('Old'));

    expect(revisit).toEqual([games('Hades')]);
  });

  it('invalidates every cached resource at once', () => {
    const stats = TestBed.inject(StatsService);
    stats.getSummary().subscribe();
    http.expectOne(`${API_BASE_URL}/stats/summary`).flush({});
    read();
    http.expectOne(gamesUrl).flush(games('Hades'));

    TestBed.inject(UserDataCache).invalidateAll();

    const summaries: unknown[] = [];
    stats.getSummary().subscribe((s) => summaries.push(s));
    expect(summaries).toEqual([]);
    http.expectOne(`${API_BASE_URL}/stats/summary`).flush({ totalGames: 1 });
    expect(read()).toEqual([]);
    http.expectOne(gamesUrl).flush(games('Hades'));
  });

  it("never shows the previous user's data after logout and login as someone else", () => {
    read();
    http.expectOne(gamesUrl).flush(games('Ana game'));

    TestBed.inject(AuthService).logout();
    tokens.setToken(tokenFor('bob'));

    const bob = read();
    expect(bob).toEqual([]);
    http.expectOne(gamesUrl).flush(games('Bob game'));
    expect(bob).toEqual([games('Bob game')]);
  });

  it('does not store a response that arrives after the session changed', () => {
    read();
    const anaRequest = http.expectOne(gamesUrl);

    tokens.setToken(tokenFor('bob'));
    anaRequest.flush(games('Ana game'));

    const bob = read();
    expect(bob).toEqual([]);
    http.expectOne(gamesUrl).flush(games('Bob game'));
    expect(bob).toEqual([games('Bob game')]);
  });

  it('frees the previous session data once the token changes', () => {
    read();
    http.expectOne(gamesUrl).flush(games('Ana game'));

    tokens.clearToken();
    TestBed.tick();
    tokens.setToken(tokenFor('ana'));

    expect(read()).toEqual([]);
    http.expectOne(gamesUrl).flush(games('Ana game'));
  });

  it('peeks the cached game for a detail seed, never for another session', () => {
    expect(gameService.cachedById(1)).toBeNull();
    read();
    http.expectOne(gamesUrl).flush(games('Hades'));
    expect(gameService.cachedById(1)?.name).toBe('Hades');
    expect(gameService.cachedById(99)).toBeNull();

    tokens.setToken(tokenFor('bob'));
    expect(gameService.cachedById(1)).toBeNull();
  });

  it('caches the dashboard stats per limit and drops them on a write', () => {
    const stats = TestBed.inject(StatsService);
    const topUrl = `${API_BASE_URL}/stats/top-rated`;
    stats.getTopRated(5).subscribe();
    http.expectOne(`${topUrl}?limit=5`).flush([]);
    stats.getTopRated(50).subscribe();
    http.expectOne(`${topUrl}?limit=50`).flush([]);

    const revisit: unknown[] = [];
    stats.getTopRated(5).subscribe((value) => revisit.push(value));
    expect(revisit).toEqual([[]]);
    http.expectOne(`${topUrl}?limit=5`).flush([]);

    const yearsUrl = `${API_BASE_URL}/stats/years`;
    stats.getYears().subscribe();
    http.expectOne(yearsUrl).flush([2026]);

    gameService.delete(1).subscribe();
    http.expectOne(`${gamesUrl}/1`).flush(null);

    const afterWrite: unknown[] = [];
    stats.getYears().subscribe((value) => afterWrite.push(value));
    expect(afterWrite).toEqual([]);
    http.expectOne(yearsUrl).flush([2025]);
    expect(afterWrite).toEqual([[2025]]);
  });
  it('caches the stats hub sections per year, the no-year request apart', () => {
    const stats = TestBed.inject(StatsService);
    const ratingsUrl = `${API_BASE_URL}/stats/ratings`;
    stats.getRatings().subscribe();
    http.expectOne(ratingsUrl).flush({ ratedCount: 3 });
    stats.getRatings(2024).subscribe();
    http.expectOne(`${ratingsUrl}?year=2024`).flush({ ratedCount: 1 });

    const revisit: unknown[] = [];
    stats.getRatings().subscribe((value) => revisit.push(value));
    expect(revisit).toEqual([{ ratedCount: 3 }]);
    http.expectOne(ratingsUrl).flush({ ratedCount: 3 });

    stats.getByDeveloper(10, 2).subscribe();
    http.expectOne(`${API_BASE_URL}/stats/by-developer?limit=10&minRatedGames=2`).flush({});
  });
  it('drops every stats hub section on a write so the next read waits for fresh data', () => {
    const stats = TestBed.inject(StatsService);
    const base = `${API_BASE_URL}/stats`;
    const reads: [() => { subscribe: (next: (value: unknown) => void) => unknown }, string][] = [
      [() => stats.getActivity(2026), `${base}/activity?year=2026`],
      [() => stats.getByPlatform(), `${base}/by-platform`],
      [() => stats.getByDeveloper(), `${base}/by-developer?limit=0&minRatedGames=2`],
      [() => stats.getByReleaseEra(), `${base}/by-release-era`],
      [() => stats.getCompletion(2025), `${base}/completion?year=2025`],
      [() => stats.getRatings(), `${base}/ratings`],
    ];
    for (const [read, url] of reads) {
      read().subscribe(() => undefined);
      http.expectOne(url).flush({ stale: true });
    }

    gameService.delete(1).subscribe();
    http.expectOne(`${gamesUrl}/1`).flush(null);

    for (const [read, url] of reads) {
      const values: unknown[] = [];
      read().subscribe((value) => values.push(value));
      expect(values).toEqual([]);
      http.expectOne(url).flush({ fresh: true });
      expect(values).toEqual([{ fresh: true }]);
    }
  });
});
