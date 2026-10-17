import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../api-base-url';
import { Game, GameRequest } from '../models/game.model';
import { AuthService } from './auth.service';
import { ExperienceService } from './experience.service';
import { GameService } from './game.service';
import { RunFormLauncher } from './run-form-launcher.service';
import { StatsService } from './stats.service';
import { TokenStorageService } from './token-storage.service';

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

  it('invalidates every cached resource, including when a run is saved from the form', () => {
    const stats = TestBed.inject(StatsService);
    stats.getSummary().subscribe();
    http.expectOne(`${API_BASE_URL}/stats/summary`).flush({});
    read();
    http.expectOne(gamesUrl).flush(games('Hades'));

    TestBed.inject(RunFormLauncher).notifySaved({ experience: { id: 1 } as never, created: true });

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
});
