import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../api-base-url';
import { Platform } from '../models/platform.model';
import { PlatformService } from './platform.service';

const url = `${API_BASE_URL}/platforms`;

const platform = (id: number, name: string, sortOrder: number): Platform => ({
  id,
  name,
  color: '#8A857C',
  family: 'OTHER',
  legacyCode: null,
  sortOrder,
});

describe('PlatformService', () => {
  let service: PlatformService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PlatformService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the catalog once, sorted, and serves it from the cache afterwards', () => {
    const results: Platform[][] = [];
    service.load().subscribe((list) => results.push(list));
    service.load().subscribe((list) => results.push(list));
    http.expectOne(url).flush([platform(2, 'PS5', 20), platform(1, 'PC', 10)]);

    service.load().subscribe((list) => results.push(list));
    http.expectNone(url);

    expect(results).toHaveLength(3);
    expect(results.every((list) => list.map((p) => p.id).join() === '1,2')).toBe(true);
    expect(service.platforms()?.map((p) => p.name)).toEqual(['PC', 'PS5']);
  });

  it('reloads on demand', () => {
    service.load().subscribe();
    http.expectOne(url).flush([platform(1, 'PC', 10)]);

    service.load(true).subscribe();
    http.expectOne(url).flush([platform(1, 'PC', 10), platform(30, 'Anbernic', 1000)]);

    expect(service.platforms()?.length).toBe(2);
  });

  it('adds a created platform to the cache once, in catalog order', () => {
    service.load().subscribe();
    http.expectOne(url).flush([platform(1, 'PC', 10), platform(40, 'Zeta', 1000)]);

    service.create({ name: 'Anbernic' }).subscribe();
    const request = http.expectOne(url);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: 'Anbernic' });
    request.flush(platform(30, 'Anbernic', 1000));

    // Create-if-missing may return an existing entry: no duplicate.
    service.create({ name: 'anbernic' }).subscribe();
    http.expectOne(url).flush(platform(30, 'Anbernic', 1000));

    expect(service.platforms()?.map((p) => p.name)).toEqual(['PC', 'Anbernic', 'Zeta']);
  });
});
