import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../api-base-url';
import { GenreStat } from '../models/stats.model';
import { StatsService } from './stats.service';
import { TokenStorageService } from './token-storage.service';

const byGenreUrl = `${API_BASE_URL}/stats/by-genre`;
const tokenFor = (user: string): string => `h.${btoa(JSON.stringify({ sub: user }))}.s`;
const genres = (hours: number): GenreStat[] => [{ genreId: 1, genreName: 'RPG', gameCount: 2, totalHours: hours }];

describe('StatsService.getByGenre (cached)', () => {
  let stats: StatsService;
  let http: HttpTestingController;

  function read(): GenreStat[][] {
    const values: GenreStat[][] = [];
    stats.getByGenre().subscribe((value) => values.push(value));
    return values;
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    stats = TestBed.inject(StatsService);
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(TokenStorageService).setToken(tokenFor('ana'));
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('serves the cached genres at once on a revisit (the hub and the genres section share them)', () => {
    read();
    http.expectOne(byGenreUrl).flush(genres(10));

    const revisit = read();
    expect(revisit).toEqual([genres(10)]);
    // Refreshed in the background; an unchanged answer emits nothing new.
    http.expectOne(byGenreUrl).flush(genres(10));
    expect(revisit).toEqual([genres(10)]);
  });

  it('drops the cached genres after a write, so the next read waits for fresh ones', () => {
    read();
    http.expectOne(byGenreUrl).flush(genres(10));

    stats.saveYearNote(2025, { summary: 'x', highlights: null }).subscribe();
    http.expectOne(`${API_BASE_URL}/stats/years/2025/note`).flush({ summary: 'x', highlights: null, updatedAt: null });

    const after = read();
    expect(after).toEqual([]);
    http.expectOne(byGenreUrl).flush(genres(20));
    expect(after).toEqual([genres(20)]);
  });
});
