import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../api-base-url';
import { UnlockedAchievement } from '../models/achievement.model';
import { Achievement } from '../../shared/achievements/achievements';
import { AchievementService } from './achievement.service';
import { DemoModeService } from './demo-mode.service';
import { TokenStorageService } from './token-storage.service';

const url = `${API_BASE_URL}/achievements`;
const tokenFor = (user: string): string => `h.${btoa(JSON.stringify({ sub: user }))}.s`;
const badge = (id: string, unlocked: boolean): Achievement => ({
  id,
  category: 'special',
  tier: 'bronze',
  current: unlocked ? 1 : 0,
  target: 1,
  unlocked,
  progress: unlocked ? 1 : 0,
  rank: 0,
});
const stored = (id: string): UnlockedAchievement => ({ id, unlockedAt: '2026-11-01T10:00:00' });

describe('AchievementService', () => {
  let service: AchievementService;
  let http: HttpTestingController;
  const isDemo = signal(false);

  function record(
    list: Achievement[],
    already: UnlockedAchievement[] = [],
  ): UnlockedAchievement[][] {
    const values: UnlockedAchievement[][] = [];
    service.recordNew(list, already).subscribe((value) => values.push(value));
    return values;
  }

  beforeEach(() => {
    localStorage.clear();
    isDemo.set(false);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DemoModeService, useValue: { isDemo } },
      ],
    });
    service = TestBed.inject(AchievementService);
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(TokenStorageService).setToken(tokenFor('ana'));
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('reads the stored unlocks', () => {
    const values: UnlockedAchievement[][] = [];
    service.getUnlocked().subscribe((value) => values.push(value));
    http.expectOne({ method: 'GET', url }).flush([stored('years10')]);
    expect(values).toEqual([[stored('years10')]]);
  });

  it('records only the unlocked ids that are not stored yet, and emits the stored list', () => {
    const values = record(
      [badge('years10', true), badge('multitasker', true), badge('runs10', false)],
      [stored('years10')],
    );

    const req = http.expectOne({ method: 'POST', url });
    expect(req.request.body).toEqual({ ids: ['multitasker'] });
    req.flush([stored('years10'), stored('multitasker')]);
    expect(values).toEqual([[stored('years10'), stored('multitasker')]]);
  });

  it('records each id once: a later load while the first record is pending or done sends nothing', () => {
    record([badge('multitasker', true)]);
    const req = http.expectOne({ method: 'POST', url });
    record([badge('multitasker', true)]);
    http.expectNone({ method: 'POST', url });
    req.flush([stored('multitasker')]);

    record([badge('multitasker', true)]);
    http.expectNone({ method: 'POST', url });
  });

  it('sends nothing when every unlocked id is already stored', () => {
    expect(record([badge('years10', true), badge('runs10', false)], [stored('years10')])).toEqual(
      [],
    );
    http.expectNone({ method: 'POST', url });
  });

  it('swallows a failed record and retries it on a later load', () => {
    const values = record([badge('multitasker', true)]);
    http
      .expectOne({ method: 'POST', url })
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    expect(values).toEqual([]);

    record([badge('multitasker', true)]);
    const retry = http.expectOne({ method: 'POST', url });
    expect(retry.request.body).toEqual({ ids: ['multitasker'] });
    retry.flush([stored('multitasker')]);
  });

  it('records again for another session (another user may not have them)', () => {
    record([badge('multitasker', true)]);
    http.expectOne({ method: 'POST', url }).flush([stored('multitasker')]);

    TestBed.inject(TokenStorageService).setToken(tokenFor('bea'));
    record([badge('multitasker', true)]);
    http.expectOne({ method: 'POST', url }).flush([stored('multitasker')]);
  });

  it('never records from the read-only demo', () => {
    isDemo.set(true);
    expect(record([badge('multitasker', true)])).toEqual([]);
    http.expectNone({ method: 'POST', url });
  });
});
