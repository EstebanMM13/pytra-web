import {
  RUN_DATE_MIN,
  formatDayMonthYear,
  formatRunPeriod,
  isWithinRunDateLimits,
  runDateMax,
  runDuration,
  runSpan,
  runYear,
  splitLines,
  todayIso,
} from './run-dates';
import { ratingRank } from '../../features/games/experience-detail/experience-detail';

describe('run dates', () => {
  it('formats ISO dates as dd/mm/yyyy', () => {
    expect(formatDayMonthYear('2023-02-25')).toBe('25/02/2023');
    expect(formatDayMonthYear(null)).toBe('—');
  });

  it('builds today in local time', () => {
    expect(todayIso(new Date(2026, 9, 9))).toBe('2026-10-09');
  });

  it('bounds run dates from 1970-01-01 to tomorrow', () => {
    expect(RUN_DATE_MIN).toBe('1970-01-01');
    expect(runDateMax(new Date(2026, 11, 31))).toBe('2027-01-01');
    expect(isWithinRunDateLimits('', '2026-10-25')).toBe(true);
    expect(isWithinRunDateLimits(null, '2026-10-25')).toBe(true);
    expect(isWithinRunDateLimits('1970-01-01', '2026-10-25')).toBe(true);
    expect(isWithinRunDateLimits('2026-10-25', '2026-10-25')).toBe(true);
    expect(isWithinRunDateLimits('1969-12-31', '2026-10-25')).toBe(false);
    expect(isWithinRunDateLimits('2026-10-26', '2026-10-25')).toBe(false);
  });

  it('counts whole months between dates, falling back to days', () => {
    expect(runDuration('2023-02-25', '2024-06-30')).toEqual({ unit: 'months', count: 16 });
    expect(runDuration('2024-01-31', '2024-02-29')).toEqual({ unit: 'days', count: 29 });
    expect(runDuration('2024-05-01', null)).toBeNull();
    expect(runDuration('2024-05-02', '2024-05-01')).toBeNull();
  });

  it('formats a compact run period', () => {
    expect(formatRunPeriod('2025-01-10', '2025-04-02')).toBe('ene – abr 2025');
    expect(formatRunPeriod('2020-03-01', '2021-05-01')).toBe('mar 2020 – may 2021');
    expect(formatRunPeriod('2026-09-04', null)).toBe('sept 2026');
    expect(formatRunPeriod(null, null)).toBeNull();
  });

  it('resolves the run year like the API', () => {
    expect(runYear({ year: 2019, startDate: '2020-01-01', endDate: null })).toBe(2019);
    expect(runYear({ year: null, startDate: '2020-01-01', endDate: '2021-01-01' })).toBe(2021);
    expect(runYear({ year: null, startDate: null, endDate: null })).toBeNull();
  });

  it('splits list text into items, dropping bullets and blank lines', () => {
    expect(splitLines('- Combate\n\n* Arte \r\n+ Música\n• Final')).toEqual(['Combate', 'Arte', 'Música', 'Final']);
    expect(splitLines(null)).toEqual([]);
  });
});

describe('runSpan', () => {
  it('counts whole months and the days left over', () => {
    expect(runSpan('2026-10-07', '2026-11-15')).toEqual({ months: 1, days: 8 });
    expect(runSpan('2026-01-10', '2026-05-01')).toEqual({ months: 3, days: 21 });
    expect(runSpan('2026-02-01', '2026-05-01')).toEqual({ months: 3, days: 0 });
    expect(runSpan('2026-10-07', '2026-10-31')).toEqual({ months: 0, days: 24 });
  });

  it('keeps the day inside short months and refuses a missing or reversed range', () => {
    expect(runSpan('2026-01-31', '2026-03-01')).toEqual({ months: 1, days: 1 });
    expect(runSpan(null, '2026-03-01')).toBeNull();
    expect(runSpan('2026-03-02', '2026-03-01')).toBeNull();
  });
});

describe('ratingRank', () => {
  it('ranks among the best-first window, ties sharing a position', () => {
    expect(ratingRank(9, [10, 9, 9, 8])).toBe(2);
    expect(ratingRank(10, [10, 9])).toBe(1);
  });

  it('is unknown when a full window does not reach the rating', () => {
    expect(ratingRank(5, [9, 8, 7], 3)).toBeNull();
    expect(ratingRank(7, [9, 8, 7], 3)).toBe(3);
  });
});
