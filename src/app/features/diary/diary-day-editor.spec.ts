import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { EMPTY, of, throwError } from 'rxjs';
import { DiaryDay } from '../../core/models/diary.model';
import { Experience } from '../../core/models/experience.model';
import { Game } from '../../core/models/game.model';
import { InProgressExperience } from '../../core/models/stats.model';
import { DemoModeService } from '../../core/services/demo-mode.service';
import { DiaryService } from '../../core/services/diary.service';
import { ExperienceService } from '../../core/services/experience.service';
import { GameService } from '../../core/services/game.service';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';
import { StatsService } from '../../core/services/stats.service';
import { ToastService } from '../../shared/toast/toast.service';
import { DiaryDayEditor } from './diary-day-editor';

const DATE = '2026-10-20';

const library = [
  {
    id: 1,
    name: 'Hades',
    category: 'SINGLEPLAYER',
    coverImageUrl: null,
    reviewStatus: 'CONFIRMED',
  },
  {
    id: 2,
    name: 'Apex Legends',
    category: 'ONLINE',
    coverImageUrl: null,
    reviewStatus: 'CONFIRMED',
  },
] as Game[];

const playing = [
  { experienceId: 11, gameId: 1, gameName: 'Hades', coverImageUrl: null },
] as InProgressExperience[];

function savedDay(): DiaryDay {
  return {
    date: DATE,
    note: 'Late night',
    totalHours: 2,
    games: [
      {
        gameId: 2,
        gameName: 'Apex Legends',
        coverImageUrl: null,
        experienceId: null,
        runLabel: null,
        hours: 2,
        note: null,
        countsHours: true,
        synced: false,
      },
    ],
  };
}

function setup(options: { day?: DiaryDay | null; save?: () => unknown } = {}) {
  const diary = {
    findDay: vi.fn(() =>
      options.day ? of(options.day) : throwError(() => new HttpErrorResponse({ status: 404 })),
    ),
    saveDay: vi.fn(
      options.save ?? ((_date: string, request: unknown) => of({ ...savedDay(), request })),
    ),
    deleteDay: vi.fn(() => of(undefined)),
  };
  const toast = { success: vi.fn(), error: vi.fn() };
  const experiences = {
    findAllByGame: vi.fn(() =>
      of([
        { id: 11, gameId: 1, runLabel: 'Run 1', status: 'EN_CURSO' },
        { id: 12, gameId: 1, runLabel: 'Run 2', status: 'EN_CURSO' },
      ] as Experience[]),
    ),
  };
  TestBed.configureTestingModule({
    imports: [DiaryDayEditor],
    providers: [
      provideTranslateService(),
      { provide: DiaryService, useValue: diary },
      { provide: GameService, useValue: { findAll: () => of(library) } },
      { provide: StatsService, useValue: { getInProgress: () => of(playing) } },
      { provide: ExperienceService, useValue: experiences },
      { provide: RunFormLauncher, useValue: { saved$: EMPTY, openNewRun: vi.fn() } },
      { provide: DemoModeService, useValue: { isDemo: signal(false), blockWrite: () => false } },
      { provide: ToastService, useValue: toast },
    ],
  });
  const fixture = TestBed.createComponent(DiaryDayEditor);
  fixture.componentRef.setInput('date', DATE);
  const saved = vi.fn();
  fixture.componentInstance.saved.subscribe(saved);
  fixture.detectChanges();
  // The sheet moves itself to <body>.
  const root = () => document.body;
  return { fixture, diary, toast, experiences, saved, root };
}

function clickButton(root: HTMLElement, text: string): void {
  const button = [...root.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent!.trim() === text,
  );
  if (!button) throw new Error(`No button "${text}"`);
  button.click();
}

function save(root: HTMLElement): void {
  // Web footer save button (the mobile header one is hidden by CSS only).
  clickButton(root, 'diary.editor.save');
}

describe('DiaryDayEditor', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    document.body.innerHTML = '';
  });

  it('starts empty for a day without entry and adds a "playing now" game', () => {
    const { fixture, diary, root } = setup();
    expect(diary.findDay).toHaveBeenCalledWith(DATE);

    const chip = root().querySelector<HTMLButtonElement>('[data-playing-chips] button')!;
    expect(chip.textContent!.trim()).toBe('Hades');
    chip.click();
    fixture.detectChanges();

    expect(root().querySelectorAll('[data-diary-row]')).toHaveLength(1);
    // The game is in the day: its chip is gone.
    expect(root().querySelector('[data-playing-chips]')).toBeNull();
  });

  it('adds hours with the quick steps and saves the whole day', () => {
    const { fixture, diary, saved, toast, root } = setup();
    root().querySelector<HTMLButtonElement>('[data-playing-chips] button')!.click();
    fixture.detectChanges();
    clickButton(root(), '+1');
    clickButton(root(), '+0,5');
    fixture.detectChanges();
    expect(
      root().querySelector<HTMLInputElement>('[data-diary-row] input[inputmode="decimal"]')!.value,
    ).toBe('1,5');

    save(root());

    expect(diary.saveDay).toHaveBeenCalledWith(DATE, {
      note: null,
      games: [{ gameId: 1, hours: 1.5, note: null }],
    });
    expect(toast.success).toHaveBeenCalledWith('diary.toast.saved');
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ date: DATE }));
  });

  it('loads a saved day and keeps it when saved again', () => {
    const { diary, root } = setup({ day: savedDay() });
    expect(root().querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('Late night');
    expect(root().querySelector('[data-delete-day]')).not.toBeNull();

    save(root());

    expect(diary.saveDay).toHaveBeenCalledWith(DATE, {
      note: 'Late night',
      games: [{ gameId: 2, hours: 2, note: null }],
    });
  });

  it('does not save rows with invalid hours', () => {
    const { fixture, diary, root } = setup();
    root().querySelector<HTMLButtonElement>('[data-playing-chips] button')!.click();
    fixture.detectChanges();

    save(root());
    fixture.detectChanges();

    expect(diary.saveDay).not.toHaveBeenCalled();
    expect(root().textContent).toContain('diary.editor.hoursError');
  });

  it('asks for the run when the API cannot choose it, and sends the chosen one', () => {
    const runRequired = new HttpErrorResponse({
      status: 400,
      error: {
        message: 'DIARY_RUN_REQUIRED',
        fieldErrors: { 'games[0].experienceId': 'DIARY_RUN_REQUIRED' },
      },
    });
    let calls = 0;
    const { fixture, diary, experiences, toast, root } = setup({
      save: () => (calls++ === 0 ? throwError(() => runRequired) : of(savedDay())),
    });
    root().querySelector<HTMLButtonElement>('[data-playing-chips] button')!.click();
    fixture.detectChanges();
    clickButton(root(), '+1');
    save(root());
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalledWith('diary.editor.runRequiredToast');
    expect(experiences.findAllByGame).toHaveBeenCalledWith(1);
    const select = root().querySelector<HTMLSelectElement>('[data-run-chooser] select')!;
    select.value = '12';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    save(root());
    expect(diary.saveDay).toHaveBeenLastCalledWith(DATE, {
      note: null,
      games: [{ gameId: 1, experienceId: 12, hours: 1, note: null }],
    });
  });

  it('deletes the day after a second tap', () => {
    const { fixture, diary, saved, root } = setup({ day: savedDay() });
    const button = () => root().querySelector<HTMLButtonElement>('[data-delete-day]')!;
    button().click();
    fixture.detectChanges();
    expect(diary.deleteDay).not.toHaveBeenCalled();
    expect(button().textContent!.trim()).toBe('diary.editor.confirmDelete');

    button().click();
    expect(diary.deleteDay).toHaveBeenCalledWith(DATE);
    expect(saved).toHaveBeenCalledWith({ date: DATE, day: null });
  });
});
