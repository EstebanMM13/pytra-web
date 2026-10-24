import { Component, input, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { BehaviorSubject, of } from 'rxjs';
import { DiaryService } from '../../core/services/diary.service';
import { Navbar } from '../../shared/navbar/navbar';
import { todayIso } from '../../shared/utils/run-dates';
import { Diary } from './diary';
import { DiaryDayEditor } from './diary-day-editor';
import { gridRange, monthOf } from './diary.logic';

@Component({ selector: 'app-navbar', template: '' })
class NavbarStub {}

@Component({ selector: 'app-diary-day-editor', template: '' })
class EditorStub {
  readonly date = input.required<string>();
  readonly saved = output<{ date: string; day: null }>();
  readonly closed = output<void>();
}

describe('Diary', () => {
  function setup(date: string | null = null) {
    const today = todayIso();
    const queryParams = new BehaviorSubject(convertToParamMap(date ? { date } : {}));
    const diary = {
      findRange: vi.fn(() =>
        of([
          {
            date: today,
            note: null,
            totalHours: 4,
            games: [{ gameId: 1, gameName: 'Hades', hours: 4 }],
          },
        ]),
      ),
    };
    TestBed.configureTestingModule({
      imports: [Diary],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: DiaryService, useValue: diary },
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParams } },
      ],
    });
    TestBed.overrideComponent(Diary, {
      remove: { imports: [Navbar, DiaryDayEditor] },
      add: { imports: [NavbarStub, EditorStub] },
    });
    const fixture = TestBed.createComponent(Diary);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, diary, today, queryParams };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('shows the current month grid with today marked and coloured by its hours', () => {
    const { el, diary, today } = setup();
    const month = monthOf(today)!;
    const range = gridRange(month.year, month.month);

    expect(diary.findRange).toHaveBeenCalledWith(range.from, range.to);
    expect(el.querySelectorAll('[data-calendar] button')).toHaveLength(42);
    const cell = el.querySelector<HTMLButtonElement>(`[data-date="${today}"]`)!;
    expect(cell.getAttribute('aria-current')).toBe('date');
    expect(cell.getAttribute('data-level')).toBe('3');
    expect(el.querySelectorAll('[data-month-day]')).toHaveLength(1);
    expect(el.querySelector('app-diary-day-editor')).toBeNull();
  });

  it('opens the editor of the day given in the URL, and a tapped day through the URL', () => {
    const { fixture, el, today } = setup(todayIso());
    expect(el.querySelector('app-diary-day-editor')).not.toBeNull();

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    el.querySelector<HTMLButtonElement>(`[data-date="${today}"]`)!.click();
    fixture.detectChanges();
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { date: today } }),
    );
  });

  it('moves between months', () => {
    const { fixture, el, diary } = setup();
    el.querySelector<HTMLButtonElement>('button[aria-label="diary.calendar.previous"]')!.click();
    fixture.detectChanges();
    expect(diary.findRange).toHaveBeenCalledTimes(2);
    // Back on another month: the "today" shortcut appears.
    expect(
      [...el.querySelectorAll('button')].some(
        (b) => b.textContent!.trim() === 'diary.calendar.today',
      ),
    ).toBe(true);
  });
});
