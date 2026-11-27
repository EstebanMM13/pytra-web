import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { EMPTY, of, throwError } from 'rxjs';
import { DiaryDay, DiaryLinkedGame } from '../../core/models/diary.model';
import { Experience } from '../../core/models/experience.model';
import { Game } from '../../core/models/game.model';
import { InProgressExperience } from '../../core/models/stats.model';
import { DemoModeService } from '../../core/services/demo-mode.service';
import { DiaryService } from '../../core/services/diary.service';
import { ExperienceService } from '../../core/services/experience.service';
import { GameService } from '../../core/services/game.service';
import { OnlinePlaytimeService } from '../../core/services/online-playtime.service';
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
  {
    id: 3,
    name: 'Grand Theft Auto V',
    category: 'HYBRID',
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

function setup(
  options: {
    day?: DiaryDay | null;
    save?: () => unknown;
    onlinePlatforms?: { id: number; name: string }[];
    linked?: DiaryLinkedGame[];
  } = {},
) {
  const diary = {
    findDay: vi.fn(() =>
      options.day ? of(options.day) : throwError(() => new HttpErrorResponse({ status: 404 })),
    ),
    saveDay: vi.fn(
      options.save ?? ((_date: string, request: unknown) => of({ ...savedDay(), request })),
    ),
    deleteDay: vi.fn(() => of(undefined)),
    findLinkedGames: vi.fn(() => of(options.linked ?? [])),
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
  const onlinePlaytime = {
    findByGame: vi.fn(() =>
      options.onlinePlatforms
        ? of({ gameId: 2, totalHours: 10, platforms: options.onlinePlatforms.map((p) => ({ ...p, color: null })) })
        : throwError(() => new HttpErrorResponse({ status: 404 })),
    ),
  };
  TestBed.configureTestingModule({
    imports: [DiaryDayEditor],
    providers: [
      provideTranslateService(),
      provideRouter([]),
      { provide: DiaryService, useValue: diary },
      { provide: GameService, useValue: { findAll: () => of(library) } },
      { provide: StatsService, useValue: { getInProgress: () => of(playing) } },
      { provide: ExperienceService, useValue: experiences },
      { provide: OnlinePlaytimeService, useValue: onlinePlaytime },
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

  const twoPlatforms = [
    { id: 4, name: 'PC' },
    { id: 5, name: 'PS5' },
  ];

  function hybridDay(line: Partial<DiaryDay['games'][number]> = {}): DiaryDay {
    return {
      date: DATE,
      note: null,
      totalHours: 2,
      games: [
        {
          gameId: 3,
          gameName: 'Grand Theft Auto V',
          coverImageUrl: null,
          experienceId: 31,
          runLabel: 'Story',
          hours: 2,
          note: null,
          countsHours: true,
          synced: false,
          ...line,
        },
      ],
    };
  }

  it('lets a hybrid game send its hours to online, asking the platform when played on several', () => {
    const { fixture, diary, root } = setup({ day: hybridDay(), onlinePlatforms: twoPlatforms });
    fixture.detectChanges();
    expect(root().querySelector('[data-target-chooser]')).not.toBeNull();
    // Campaign by default for a line counted on a run: no platform asked.
    expect(root().querySelector('[data-platform-chooser]')).toBeNull();

    clickButton(root(), 'diary.editor.toOnlineOption');
    fixture.detectChanges();
    expect(root().textContent).toContain('diary.editor.toOnline');
    const select = root().querySelector<HTMLSelectElement>('[data-platform-chooser] select')!;
    select.value = '5';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    save(root());

    const request = diary.saveDay.mock.calls[0][1] as { games: Record<string, unknown>[] };
    expect(request.games[0]).toEqual(expect.objectContaining({ gameId: 3, online: true, platformId: 5 }));
    expect('experienceId' in request.games[0]).toBe(false);
  });

  it('keeps a hybrid line saved to online on online, and sends a campaign line as such', () => {
    const online = setup({ day: hybridDay({ experienceId: null, runLabel: null, platformId: 4 }), onlinePlatforms: twoPlatforms });
    online.fixture.detectChanges();
    save(online.root());
    expect(online.diary.saveDay).toHaveBeenCalledWith(
      DATE,
      expect.objectContaining({ games: [expect.objectContaining({ online: true, platformId: 4 })] }),
    );
    TestBed.resetTestingModule();
    document.body.innerHTML = '';

    const campaign = setup({ day: hybridDay() });
    campaign.fixture.detectChanges();
    save(campaign.root());
    expect(campaign.diary.saveDay).toHaveBeenCalledWith(
      DATE,
      expect.objectContaining({ games: [expect.objectContaining({ experienceId: 31, online: false })] }),
    );
  });

  it('adds the PC hours of a PSN-linked game and only records the PS5 ones', () => {
    const linked: DiaryLinkedGame[] = [{ gameId: 3, sources: ['PSN'], covered: [{ platformId: 5, source: 'PSN' }] }];
    const { fixture, diary, root } = setup({ day: hybridDay(), onlinePlatforms: twoPlatforms, linked });
    fixture.detectChanges();
    clickButton(root(), 'diary.editor.toOnlineOption');
    fixture.detectChanges();
    const select = root().querySelector<HTMLSelectElement>('[data-platform-chooser] select')!;

    select.value = '5';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(root().querySelector('[data-synced-tag]')!.textContent).toContain('diary.editor.coveredBy');

    select.value = '4';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(root().querySelector('[data-synced-tag]')).toBeNull();
    expect(root().querySelector('[data-outside-sync]')).toBeNull();
    save(root());
    expect(diary.saveDay).toHaveBeenCalledWith(
      DATE,
      expect.objectContaining({ games: [expect.objectContaining({ online: true, platformId: 4 })] }),
    );
  });

  it('asks whether a Steam-linked game on PC was played outside Steam, and counts it when so', () => {
    const linked: DiaryLinkedGame[] = [{ gameId: 2, sources: ['STEAM'], covered: [{ platformId: 4, source: 'STEAM' }] }];
    const { fixture, diary, root } = setup({ day: savedDay(), onlinePlatforms: [{ id: 4, name: 'PC' }], linked });
    fixture.detectChanges();
    expect(root().querySelector('[data-synced-tag]')).not.toBeNull();

    const box = root().querySelector<HTMLInputElement>('[data-outside-sync] input')!;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(root().querySelector('[data-synced-tag]')).toBeNull();
    save(root());
    expect(diary.saveDay).toHaveBeenCalledWith(
      DATE,
      expect.objectContaining({ games: [expect.objectContaining({ gameId: 2, outsideSync: true })] }),
    );
  });

  it('keeps a sync-written line as a record without choosers', () => {
    const { fixture, root } = setup({
      day: hybridDay({ experienceId: null, runLabel: null, countsHours: false, synced: true, autoSynced: true }),
      onlinePlatforms: twoPlatforms,
    });
    fixture.detectChanges();
    expect(root().querySelector('[data-synced-tag]')!.textContent).toContain('diary.syncedTag');
    expect(root().querySelector('[data-target-chooser]')).toBeNull();
    expect(root().querySelector('[data-platform-chooser]')).toBeNull();
  });

  it('asks the platform of an online game played on several and saves it', () => {
    const { fixture, diary, root } = setup({ day: savedDay(), onlinePlatforms: twoPlatforms });
    fixture.detectChanges();
    const select = root().querySelector<HTMLSelectElement>('[data-platform-chooser] select')!;
    expect([...select.options].map((o) => o.textContent!.trim())).toEqual(['diary.editor.pickPlatform', 'PC', 'PS5']);

    select.value = '5';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    save(root());

    expect(diary.saveDay).toHaveBeenCalledWith(
      DATE,
      expect.objectContaining({ games: [expect.objectContaining({ gameId: 2, platformId: 5 })] }),
    );
  });

  it('does not save an online game played on several platforms until one is picked', () => {
    const { fixture, diary, root } = setup({ day: savedDay(), onlinePlatforms: twoPlatforms });
    fixture.detectChanges();
    save(root());
    fixture.detectChanges();

    expect(diary.saveDay).not.toHaveBeenCalled();
    expect(root().querySelector('[data-platform-chooser] [role="alert"]')!.textContent).toContain(
      'diary.editor.platformRequired',
    );
  });

  it('asks nothing for an online game with a single platform', () => {
    const { fixture, diary, root } = setup({ day: savedDay(), onlinePlatforms: [{ id: 4, name: 'PC' }] });
    fixture.detectChanges();
    expect(root().querySelector('[data-platform-chooser]')).toBeNull();
    save(root());
    expect(diary.saveDay).toHaveBeenCalledTimes(1);
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
    clickButton(root(), '+1 h');
    clickButton(root(), '+30 min');
    fixture.detectChanges();
    const [hours, minutes] = [
      ...root().querySelectorAll<HTMLInputElement>('[data-diary-row] app-hours-input input'),
    ];
    expect(hours.value).toBe('1');
    expect(minutes.value).toBe('30');

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
    expect(root().querySelector<HTMLTextAreaElement>('[data-day-note]')!.value).toBe('Late night');
    expect(root().querySelector('[data-delete-day]')).not.toBeNull();

    save(root());

    expect(diary.saveDay).toHaveBeenCalledWith(DATE, {
      note: 'Late night',
      games: [{ gameId: 2, hours: 2, note: null }],
    });
  });

  it('links each game of the day to its game page', () => {
    const { root } = setup({ day: savedDay() });
    const link = root().querySelector<HTMLAnchorElement>('[data-diary-row] a[data-game-link]');
    expect(link).not.toBeNull();
    expect(link!.textContent!.trim()).toBe('Apex Legends');
    expect(link!.getAttribute('href')).toBe('/games/2');
  });

  it('takes each game note in a vertically resizable comment box and saves it', () => {
    const { fixture, diary, root } = setup();
    root().querySelector<HTMLButtonElement>('[data-playing-chips] button')!.click();
    fixture.detectChanges();
    const note = root().querySelector<HTMLTextAreaElement>('[data-diary-row] textarea[data-game-note]')!;
    expect(note.classList).toContain('resize-y');
    note.value = 'Boss final\npor fin';
    note.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const [hours] = [...root().querySelectorAll<HTMLInputElement>('[data-diary-row] app-hours-input input')];
    hours.value = '1';
    hours.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    save(root());

    expect(diary.saveDay).toHaveBeenCalledWith(DATE, {
      note: null,
      games: [{ gameId: 1, hours: 1, note: 'Boss final\npor fin' }],
    });
  });

  it('saves hours typed as hours and minutes in decimal hours', () => {
    const { fixture, diary, root } = setup();
    root().querySelector<HTMLButtonElement>('[data-playing-chips] button')!.click();
    fixture.detectChanges();
    const [hours, minutes] = [
      ...root().querySelectorAll<HTMLInputElement>('[data-diary-row] app-hours-input input'),
    ];
    hours.value = '0';
    hours.dispatchEvent(new Event('input'));
    minutes.value = '46';
    minutes.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    save(root());

    expect(diary.saveDay).toHaveBeenCalledWith(DATE, {
      note: null,
      games: [{ gameId: 1, hours: 0.77, note: null }],
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
    clickButton(root(), '+1 h');
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
