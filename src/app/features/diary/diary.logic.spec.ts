import { HttpErrorResponse } from '@angular/common/http';
import { DiaryDay } from '../../core/models/diary.model';
import { Game } from '../../core/models/game.model';
import { InProgressExperience } from '../../core/models/stats.model';
import {
  buildMonthGrid,
  draftForGame,
  draftFromDay,
  draftTotal,
  formatDiaryHours,
  gridRange,
  intensityLevel,
  isValidDiaryDate,
  monthOf,
  monthTotal,
  parseDiaryHours,
  platformErrorIndexes,
  playingNowGames,
  runErrorIndexes,
  searchLibrary,
  shiftMonth,
  toDayRequest,
} from './diary.logic';

function day(date: string, totalHours: number, games = 1): DiaryDay {
  return {
    date,
    note: null,
    totalHours,
    games: Array.from({ length: games }, (_, i) => ({
      gameId: i + 1,
      gameName: `Game ${i + 1}`,
      coverImageUrl: null,
      experienceId: null,
      runLabel: null,
      hours: totalHours / games,
      note: null,
      countsHours: true,
      synced: false,
    })),
  };
}

function game(id: number, name: string, extra: Partial<Game> = {}): Game {
  return {
    id,
    name,
    developer: null,
    publisher: null,
    releaseDate: null,
    category: 'SINGLEPLAYER',
    sagaId: null,
    sagaName: null,
    coverImageUrl: null,
    reviewStatus: 'CONFIRMED',
    genres: [],
    updatedAt: '',
    ...extra,
  };
}

describe('intensity levels', () => {
  it('buckets the day total: nothing, under 1 h, under 3 h, under 6 h, 6 h or more', () => {
    expect([0, -1, null, 0.5, 1, 2.99, 3, 5.5, 6, 14].map((h) => intensityLevel(h))).toEqual([
      0, 0, 0, 1, 2, 2, 3, 3, 4, 4,
    ]);
  });
});

describe('month calendar', () => {
  it('spans 6 Monday-first weeks around the month', () => {
    // October 2026 starts on a Thursday.
    expect(gridRange(2026, 10)).toEqual({ from: '2026-09-28', to: '2026-11-08' });
    // February 2027 starts on a Monday: no leading days.
    expect(gridRange(2027, 2).from).toBe('2027-02-01');
  });

  it('marks the month, today, entries and days past tomorrow', () => {
    const weeks = buildMonthGrid(
      2026,
      10,
      [day('2026-10-03', 2.5, 2), day('2026-09-30', 7)],
      '2026-10-24',
      '2026-10-25',
    );
    const cells = weeks.flat();
    expect(weeks).toHaveLength(6);
    expect(weeks.every((w) => w.length === 7)).toBe(true);

    const byDate = (date: string) => cells.find((c) => c.date === date)!;
    expect(byDate('2026-09-30')).toMatchObject({
      inMonth: false,
      hours: 7,
      level: 4,
      hasEntry: true,
    });
    expect(byDate('2026-10-03')).toMatchObject({
      inMonth: true,
      day: 3,
      hours: 2.5,
      level: 2,
      gameCount: 2,
    });
    expect(byDate('2026-10-24')).toMatchObject({
      isToday: true,
      disabled: false,
      hasEntry: false,
      level: 0,
    });
    expect(byDate('2026-10-25').disabled).toBe(false);
    expect(byDate('2026-10-26').disabled).toBe(true);
  });

  it('totals only the shown month and moves across years', () => {
    expect(
      monthTotal([day('2026-09-30', 7), day('2026-10-01', 1.25), day('2026-10-02', 0.5)], 2026, 10),
    ).toBe(1.75);
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(monthOf('2026-10-24')).toEqual({ year: 2026, month: 10 });
    expect(monthOf('2026-13-01')).toBeNull();
    expect(monthOf('nope')).toBeNull();
  });

  it('accepts diary dates from 1970 to tomorrow', () => {
    expect(isValidDiaryDate('2026-10-25', '2026-10-25')).toBe(true);
    expect(isValidDiaryDate('2026-10-26', '2026-10-25')).toBe(false);
    expect(isValidDiaryDate('1969-12-31', '2026-10-25')).toBe(false);
    expect(isValidDiaryDate('24/10/2026', '2026-10-25')).toBe(false);
    expect(isValidDiaryDate(null)).toBe(false);
  });
});

describe('diary hours', () => {
  it('takes more than 0 and up to 24 hours with two decimals, comma or dot', () => {
    expect(parseDiaryHours('1,5')).toBe(1.5);
    expect(parseDiaryHours('0.25')).toBe(0.25);
    expect(parseDiaryHours('24')).toBe(24);
    for (const text of ['', '0', '-1', '24,5', '1,255', 'abc']) {
      expect(parseDiaryHours(text)).toBeNull();
    }
  });

  it('formats with up to two decimals in the UI locale', () => {
    expect(formatDiaryHours(1.25, 'es-ES')).toBe('1,25 h');
    expect(formatDiaryHours(2, 'en-US')).toBe('2 h');
  });
});

describe('day editor payload', () => {
  it('maps the rows to the PUT body, sending the run only when chosen', () => {
    const rows = [
      { ...draftForGame(game(1, 'Hades')), hoursText: '1,5', note: '  Boss  ' },
      { ...draftForGame(game(2, 'Apex', { category: 'ONLINE' })), hoursText: '2', experienceId: 9 },
    ];

    expect(toDayRequest('  Good day ', rows)).toEqual({
      ok: true,
      request: {
        note: 'Good day',
        games: [
          { gameId: 1, hours: 1.5, note: 'Boss' },
          { gameId: 2, experienceId: 9, hours: 2, note: null },
        ],
      },
    });
    expect(draftTotal(rows)).toBe(3.5);
  });

  it('reports the rows with invalid hours and sends nothing', () => {
    const rows = [
      { ...draftForGame(game(1, 'Hades')), hoursText: '1' },
      { ...draftForGame(game(2, 'Celeste')), hoursText: '' },
      { ...draftForGame(game(3, 'Tunic')), hoursText: '30' },
    ];
    expect(toDayRequest('', rows)).toEqual({ ok: false, invalid: [1, 2] });
  });

  it('an empty day sends no note and no games (the API deletes it)', () => {
    expect(toDayRequest('   ', [])).toEqual({ ok: true, request: { note: null, games: [] } });
  });

  it('builds the rows of a saved day, completing the category from the library', () => {
    const saved: DiaryDay = {
      date: '2026-10-24',
      note: 'n',
      totalHours: 1.5,
      games: [
        {
          gameId: 2,
          gameName: 'Apex',
          coverImageUrl: null,
          experienceId: null,
          runLabel: null,
          hours: 1.5,
          note: null,
          countsHours: false,
          synced: true,
        },
      ],
    };
    expect(draftFromDay(saved, [game(2, 'Apex', { category: 'ONLINE' })], 'es')).toEqual([
      {
        gameId: 2,
        gameName: 'Apex',
        coverImageUrl: null,
        category: 'ONLINE',
        experienceId: null,
        runLabel: null,
        hoursText: '1,5',
        note: '',
        synced: true,
        platformId: null,
      },
    ]);
  });

  it('reads the rows the API could not place on a run', () => {
    const error = (message: string, fieldErrors: Record<string, string>) =>
      new HttpErrorResponse({ status: 400, error: { message, fieldErrors } });

    expect(
      runErrorIndexes(
        error('DIARY_RUN_REQUIRED', {
          'games[2].experienceId': 'DIARY_RUN_REQUIRED',
          'games[0].experienceId': 'INVALID_DIARY_RUN',
        }),
      ),
    ).toEqual([0, 2]);
    expect(runErrorIndexes(error('Validation failed', { 'games[0].hours': 'x' }))).toBeNull();
    expect(runErrorIndexes(new HttpErrorResponse({ status: 500 }))).toBeNull();
    expect(runErrorIndexes(new Error('x'))).toBeNull();
  });
});

describe('game picker', () => {
  const library = [
    game(1, 'Pokémon Escarlata'),
    game(2, 'Hades'),
    game(3, 'Hades II'),
    game(4, 'Pending', { reviewStatus: 'PENDING_REVIEW' }),
  ];

  it('searches names ignoring accents and case, without picked or pending games', () => {
    expect(searchLibrary(library, 'pokemon', new Set()).map((g) => g.id)).toEqual([1]);
    expect(searchLibrary(library, 'HADES', new Set([2])).map((g) => g.id)).toEqual([3]);
    expect(searchLibrary(library, 'pend', new Set())).toEqual([]);
    expect(searchLibrary(library, '  ', new Set())).toEqual([]);
  });

  it('offers one "playing now" chip per game not yet in the day', () => {
    const run = (experienceId: number, gameId: number): InProgressExperience =>
      ({
        experienceId,
        gameId,
        gameName: `G${gameId}`,
        coverImageUrl: null,
      }) as InProgressExperience;
    expect(playingNowGames([run(10, 1), run(11, 1), run(12, 2), run(13, 3)], new Set([3]))).toEqual(
      [
        { id: 1, name: 'G1', coverImageUrl: null },
        { id: 2, name: 'G2', coverImageUrl: null },
      ],
    );
  });
});

describe('online platform of a diary line', () => {
  const online = { id: 2, name: 'Apex', coverImageUrl: null, category: 'ONLINE' as const };

  it('keeps the saved platform in the editor row and sends it back', () => {
    const saved: DiaryDay = {
      date: '2026-10-20',
      note: null,
      totalHours: 2,
      games: [
        {
          gameId: 2,
          gameName: 'Apex',
          coverImageUrl: null,
          experienceId: null,
          runLabel: null,
          hours: 2,
          note: null,
          countsHours: true,
          synced: false,
          platformId: 5,
        },
      ],
    };
    const [row] = draftFromDay(saved, [], 'es');
    expect(row.platformId).toBe(5);
    const result = toDayRequest('', [row]);
    expect(result.ok && result.request.games[0].platformId).toBe(5);
  });

  it('starts new rows without platform and leaves it out of the request', () => {
    const row = { ...draftForGame(online), hoursText: '1' };
    expect(row.platformId).toBeNull();
    const result = toDayRequest('', [row]);
    expect(result.ok && 'platformId' in result.request.games[0]).toBe(false);
  });

  it('reads the rows the API needs a platform for', () => {
    const error = (message: string, fieldErrors: Record<string, string>) =>
      new HttpErrorResponse({ status: 400, error: { message, fieldErrors } });
    expect(
      platformErrorIndexes(
        error('DIARY_PLATFORM_REQUIRED', {
          'games[1].platformId': 'DIARY_PLATFORM_REQUIRED',
          'games[0].platformId': 'INVALID_PLATFORM',
        }),
      ),
    ).toEqual([0, 1]);
    expect(platformErrorIndexes(error('DIARY_RUN_REQUIRED', { 'games[0].experienceId': 'x' }))).toBeNull();
  });
});
