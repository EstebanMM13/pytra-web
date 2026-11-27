import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { GameDiaryDay } from '../../../core/models/diary.model';
import { DiaryService } from '../../../core/services/diary.service';
import { GameDiaryDays } from './game-diary-days';

const DAYS: GameDiaryDay[] = [
  { date: '2026-10-22', hours: 2, note: null, experienceId: 11, countsHours: true },
  { date: '2026-10-21', hours: 1.5, note: null, experienceId: 12, countsHours: true },
  { date: '2026-10-20', hours: 3, note: null, experienceId: null, countsHours: true },
];

function setup(experienceId?: number, days: GameDiaryDay[] = DAYS) {
  TestBed.configureTestingModule({
    imports: [GameDiaryDays],
    providers: [
      provideRouter([]),
      provideTranslateService(),
      { provide: DiaryService, useValue: { findByGame: () => of(days) } },
    ],
  });
  const fixture = TestBed.createComponent(GameDiaryDays);
  fixture.componentRef.setInput('gameId', 7);
  if (experienceId !== undefined) fixture.componentRef.setInput('experienceId', experienceId);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const dates = () =>
    [...el.querySelectorAll<HTMLAnchorElement>('[data-diary-days] a')].map((a) =>
      new URL(a.href).searchParams.get('date'),
    );
  return { el, dates };
}

describe('GameDiaryDays', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('lists every diary day of the game, online ones included, without a run', () => {
    const { dates } = setup();
    expect(dates()).toEqual(['2026-10-22', '2026-10-21', '2026-10-20']);
  });

  it('lists only the days of the given run, totalling their hours', () => {
    const { el, dates } = setup(12);
    expect(dates()).toEqual(['2026-10-21']);
    expect(el.querySelector('app-section-header')!.textContent).toContain('1');
    expect(el.querySelector('app-section-header')!.textContent).not.toContain('6');
  });

  it('keeps every day in a list that scrolls inside the card past ten rows', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      date: `2026-10-${String(30 - i).padStart(2, '0')}`,
      hours: 1,
      note: null,
      experienceId: 11,
      countsHours: true,
    }));
    const { el, dates } = setup(undefined, many);
    expect(dates()).toHaveLength(12);
    const list = el.querySelector('[data-diary-days] ul')!;
    expect(list.classList).toContain('scroll-list');
    expect(list.classList).toContain('max-h-[392px]');
    expect(el.textContent).not.toContain('common.showAll');
  });

  it('stays hidden when the run has no diary days', () => {
    const { el } = setup(99);
    expect(el.querySelector('[data-diary-days]')).toBeNull();
  });
});
